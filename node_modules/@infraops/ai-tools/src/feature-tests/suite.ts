import {
  EVAL_TEST_QUESTIONS,
  FEATURE_TEST_REGISTRY,
  classifyQueryIntent,
  type AppSettings,
  type FeatureTestCaseDef,
  type FeatureTestCaseStatus,
  type FeatureTestOutcome,
} from '@infraops/shared';
import { createEmbeddingAdapter } from '../embeddings/adapter';
import { createLlmAdapter } from '../llm/factory';
import { createRetriever } from '../retrieval/factory';
import { runRagPipeline } from '../rag/pipeline';
import { scoreEvaluation } from '../evaluation/scorer';

export interface FeatureTestDb {
  $queryRawUnsafe: (query: string, ...values: unknown[]) => Promise<unknown>;
  user: {
    count: (args?: { where?: { email?: string } }) => Promise<number>;
    findUnique: (args: { where: { email: string } }) => Promise<{ password: string } | null>;
  };
  document: { count: () => Promise<number> };
  documentChunk: { count: () => Promise<number> };
  project: { count: () => Promise<number> };
  iotDevice: { count: () => Promise<number> };
  review: { count: () => Promise<number> };
  auditLog: { count: () => Promise<number> };
}

export interface FeatureTestSuiteOptions {
  prisma: FeatureTestDb;
  settings: AppSettings;
  redisPing?: () => Promise<boolean>;
  verifyAdminLogin?: () => Promise<boolean>;
  onProgress?: (result: FeatureTestCaseResult) => void | Promise<void>;
}

export interface FeatureTestCaseResult {
  testCaseId: string;
  category: string;
  name: string;
  status: FeatureTestCaseStatus;
  message?: string;
  durationMs: number;
  details?: Record<string, unknown>;
}

export interface FeatureTestSuiteSummary {
  passCount: number;
  failCount: number;
  skipCount: number;
  totalCount: number;
  passRate: number;
  retrievalBackend: string;
  results: FeatureTestCaseResult[];
}

async function runCase(
  testCase: FeatureTestCaseDef,
  execute: () => Promise<FeatureTestOutcome>,
): Promise<FeatureTestCaseResult> {
  const start = Date.now();
  try {
    const outcome = await execute();
    return {
      testCaseId: testCase.id,
      category: testCase.category,
      name: testCase.name,
      status: outcome.status,
      message: outcome.message,
      durationMs: Date.now() - start,
      details: outcome.details,
    };
  } catch (err) {
    return {
      testCaseId: testCase.id,
      category: testCase.category,
      name: testCase.name,
      status: 'error',
      message: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }
}

function pass(message?: string, details?: Record<string, unknown>): FeatureTestOutcome {
  return { status: 'passed', message, details };
}

function fail(message: string, details?: Record<string, unknown>): FeatureTestOutcome {
  return { status: 'failed', message, details };
}

function pgExecuteSql(prisma: FeatureTestDb) {
  return async (sql: string, params: unknown[]) =>
    prisma.$queryRawUnsafe(sql, ...params) as Promise<
      {
        chunk_id: string;
        document_id: string;
        content: string;
        title: string;
        revision: string;
        doc_type: string;
        discipline: string;
        security_level: string;
        combined_score: number;
      }[]
    >;
}

function buildRetriever(
  prisma: FeatureTestDb,
  settings: AppSettings,
  onFallback?: (error: unknown) => void,
) {
  return createRetriever({
    backend: settings.RETRIEVAL_BACKEND,
    // Always wire pgvector so Databricks failures can fall back during tests.
    pgExecuteSql: pgExecuteSql(prisma),
    databricks: {
      host: settings.DATABRICKS_HOST ?? '',
      token: settings.DATABRICKS_TOKEN ?? '',
      catalog: settings.DATABRICKS_CATALOG,
      goldSchema: settings.DATABRICKS_SCHEMA_GOLD,
      vectorIndexName: settings.DATABRICKS_VECTOR_INDEX,
      warehouseId: settings.DATABRICKS_WAREHOUSE_ID,
      useSqlFallback: settings.DATABRICKS_USE_SQL_FALLBACK ?? true,
    },
    onFallback,
  });
}

async function executeTestCase(
  testCase: FeatureTestCaseDef,
  options: FeatureTestSuiteOptions,
  ragCache: {
    embedder: ReturnType<typeof createEmbeddingAdapter>;
    llm: ReturnType<typeof createLlmAdapter>;
    retriever: ReturnType<typeof createRetriever>;
  },
): Promise<FeatureTestOutcome> {
  const { prisma, settings, redisPing, verifyAdminLogin } = options;

  switch (testCase.id) {
    case 'platform.db': {
      await prisma.$queryRawUnsafe('SELECT 1');
      return pass('Database responded to health query');
    }
    case 'platform.redis': {
      if (!redisPing) return fail('Redis ping handler not configured');
      const ok = await redisPing();
      return ok ? pass('Redis PING returned PONG') : fail('Redis ping failed');
    }
    case 'auth.admin_login': {
      if (!verifyAdminLogin) return fail('Login verifier not configured');
      const ok = await verifyAdminLogin();
      return ok ? pass('Admin demo credentials validated') : fail('Admin login failed');
    }
    case 'data.documents_seeded': {
      const count = await prisma.document.count();
      return count >= 15
        ? pass(`${count} documents in catalog`, { count })
        : fail(`Expected ≥15 documents, found ${count}`, { count });
    }
    case 'data.chunks_indexed': {
      const count = await prisma.documentChunk.count();
      return count > 0
        ? pass(`${count} chunks indexed`, { count })
        : fail('No document chunks found', { count });
    }
    case 'data.projects_seeded': {
      const count = await prisma.project.count();
      return count >= 1
        ? pass(`${count} project(s) available`, { count })
        : fail('No projects seeded', { count });
    }
    case 'data.iot_devices': {
      const count = await prisma.iotDevice.count();
      return count >= 1
        ? pass(`${count} IoT device(s) registered`, { count })
        : fail('No IoT devices seeded', { count });
    }
    case 'rag.intent_safety': {
      const profile = classifyQueryIntent('What is the lockout-tagout procedure?');
      return profile.intent === 'safety_procedure'
        ? pass(`Detected intent: ${profile.label}`, { intent: profile.intent })
        : fail(`Expected safety_procedure, got ${profile.intent}`, { intent: profile.intent });
    }
    case 'rag.intent_contract': {
      const profile = classifyQueryIntent('What liability cap applies to Helix Power?');
      return profile.intent === 'contract_terms'
        ? pass(`Detected intent: ${profile.label}`, { intent: profile.intent })
        : fail(`Expected contract_terms, got ${profile.intent}`, { intent: profile.intent });
    }
    case 'rag.retrieval': {
      const question = 'What is the lockout-tagout procedure?';
      const embedding = await ragCache.embedder.embed(question);
      const intentProfile = classifyQueryIntent(question);
      const chunks = await ragCache.retriever.search(question, embedding, {
        securityLevels: ['public', 'internal', 'confidential', 'restricted'],
        intentProfile,
      });
      return chunks.length > 0
        ? pass(`Retrieved ${chunks.length} chunk(s)`, { chunkCount: chunks.length })
        : fail('Retriever returned no chunks', { chunkCount: 0 });
    }
    case 'workflow.reviews': {
      const count = await prisma.review.count();
      return pass(`Review table accessible (${count} row(s))`, { count });
    }
    case 'workflow.audit_log': {
      const count = await prisma.auditLog.count();
      return pass(`Audit log accessible (${count} row(s))`, { count });
    }
    case 'settings.loaded': {
      const hasBackend = !!settings.RETRIEVAL_BACKEND;
      return hasBackend
        ? pass(`Retrieval backend: ${settings.RETRIEVAL_BACKEND}`, {
            retrievalBackend: settings.RETRIEVAL_BACKEND,
          })
        : fail('Settings missing RETRIEVAL_BACKEND');
    }
    default: {
      if (testCase.id.startsWith('rag.eval.')) {
        const evalId = testCase.id.replace('rag.eval.', '');
        const test = EVAL_TEST_QUESTIONS.find((q) => q.id === evalId);
        if (!test) return fail(`Unknown eval case ${evalId}`);

        const start = Date.now();
        const embedding = await ragCache.embedder.embed(test.question);
        const intentProfile = classifyQueryIntent(test.question);
        const chunks = await ragCache.retriever.search(test.question, embedding, {
          projectId: 'proj-substation-alpha',
          securityLevels: ['public', 'internal', 'confidential', 'restricted'],
          intentProfile,
        });
        const rag = await runRagPipeline(ragCache.llm, { question: test.question, chunks });
        const scores = scoreEvaluation({
          question: test.question,
          answer: rag.answer,
          citations: rag.citations,
          chunks: chunks.map((c) => ({ chunkId: c.chunkId, content: c.content, score: c.score })),
          latencyMs: Date.now() - start,
        });

        // Full quality thresholds when a real LLM is configured; in CI (stub LLM) require
        // pipeline integrity: retrieval hit + valid citations + minimal groundedness.
        const hasLlmKey = !!(options.settings.ANTHROPIC_API_KEY || options.settings.OPENAI_API_KEY);
        const passed = hasLlmKey
          ? scores.groundedness >= 0.3 && scores.citationAccuracy >= 0.5
          : chunks.length > 0 &&
            rag.citations.length > 0 &&
            scores.citationAccuracy >= 0.5 &&
            scores.groundedness >= 0.15;

        return passed
          ? pass(hasLlmKey ? 'RAG eval thresholds met' : 'RAG pipeline integrity OK (stub LLM)', {
              groundedness: scores.groundedness,
              citationAccuracy: scores.citationAccuracy,
              citationCount: rag.citations.length,
              latencyMs: Date.now() - start,
              mode: hasLlmKey ? 'llm' : 'stub',
            })
          : fail(hasLlmKey ? 'RAG eval below thresholds' : 'RAG pipeline integrity failed', {
              groundedness: scores.groundedness,
              citationAccuracy: scores.citationAccuracy,
              citationCount: rag.citations.length,
              chunkCount: chunks.length,
              latencyMs: Date.now() - start,
              mode: hasLlmKey ? 'llm' : 'stub',
            });
      }
      return { status: 'skipped', message: 'No executor registered for this test case' };
    }
  }
}

export async function runFeatureTestSuite(
  options: FeatureTestSuiteOptions,
): Promise<FeatureTestSuiteSummary> {
  let usedPgFallback = false;
  const ragCache = {
    embedder: createEmbeddingAdapter(options.settings.OPENAI_API_KEY),
    llm: createLlmAdapter({
      anthropicKey: options.settings.ANTHROPIC_API_KEY,
      openaiKey: options.settings.OPENAI_API_KEY,
    }),
    retriever: buildRetriever(options.prisma, options.settings, () => {
      usedPgFallback = true;
    }),
  };

  const results: FeatureTestCaseResult[] = [];

  for (const testCase of FEATURE_TEST_REGISTRY) {
    const result = await runCase(testCase, () => executeTestCase(testCase, options, ragCache));
    results.push(result);
    await options.onProgress?.(result);
  }

  const passCount = results.filter((r) => r.status === 'passed').length;
  const failCount = results.filter((r) => r.status === 'failed' || r.status === 'error').length;
  const skipCount = results.filter((r) => r.status === 'skipped').length;

  return {
    passCount,
    failCount,
    skipCount,
    totalCount: results.length,
    passRate: results.length ? passCount / results.length : 0,
    retrievalBackend: usedPgFallback
      ? `${options.settings.RETRIEVAL_BACKEND}+pgvector-fallback`
      : options.settings.RETRIEVAL_BACKEND,
    results,
  };
}
