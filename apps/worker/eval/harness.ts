/**
 * RAG evaluation harness - runs 15 fixed test questions and outputs a scorecard.
 * Usage: npm run eval (from repo root)
 *
 * Scoring:
 *   EVAL_BACKEND=mlflow     → apps/eval-service judges (MLflow traces)
 *   EVAL_BACKEND=heuristic  → local token-overlap scorer
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import {
  EVAL_TEST_QUESTIONS,
  classifyQueryIntent,
  loadSettingsFromDb,
  settingsRecordToAppSettings,
  validateBootstrapEnv,
} from '@infraops/shared';
import {
  createEmbeddingAdapter,
  createEvalServiceClient,
  createLlmAdapter,
  createMlflowClient,
  createRetriever,
  runRagPipeline,
  scoreEvaluation,
} from '@infraops/ai-tools';

validateBootstrapEnv(process.env);

const prisma = new PrismaClient();

async function main() {
  const settingsRaw = await loadSettingsFromDb(prisma);
  const settings = settingsRecordToAppSettings(settingsRaw);

  const embedder = createEmbeddingAdapter(settings.OPENAI_API_KEY);
  const llm = createLlmAdapter({
    anthropicKey: settings.ANTHROPIC_API_KEY,
    openaiKey: settings.OPENAI_API_KEY,
  });

  const retriever = createRetriever({
    backend: settings.RETRIEVAL_BACKEND,
    pgExecuteSql: async (sql, params) =>
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
      >,
    databricks: {
      host: settings.DATABRICKS_HOST ?? '',
      token: settings.DATABRICKS_TOKEN ?? '',
      catalog: settings.DATABRICKS_CATALOG,
      goldSchema: settings.DATABRICKS_SCHEMA_GOLD,
      vectorIndexName: settings.DATABRICKS_VECTOR_INDEX,
      warehouseId: settings.DATABRICKS_WAREHOUSE_ID,
      useSqlFallback: settings.DATABRICKS_USE_SQL_FALLBACK ?? true,
    },
  });

  type Row = {
    id: string;
    question: string;
    groundedness: number;
    citationAccuracy: number;
    relevance: number;
    hallucinationFlag: boolean;
    retrievalHitRate: number;
    citationCount: number;
    latencyMs: number;
    pass: boolean;
    mlflowRunId?: string;
    answer?: string;
    chunks?: { chunkId: string; content: string; score: number }[];
    citations?: { chunkId: string; excerpt?: string }[];
  };

  const pipelineResults: Row[] = [];

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  InfraOps AI - RAG Evaluation Scorecard');
  console.log(`  Retrieval backend: ${settings.RETRIEVAL_BACKEND}`);
  console.log(`  Eval backend:      ${settings.EVAL_BACKEND}`);
  console.log('═══════════════════════════════════════════════════\n');

  for (const test of EVAL_TEST_QUESTIONS) {
    const start = Date.now();
    const embedding = await embedder.embed(test.question);
    const intentProfile = classifyQueryIntent(test.question);
    const chunks = await retriever.search(test.question, embedding, {
      projectId: 'proj-substation-alpha',
      securityLevels: ['public', 'internal', 'confidential', 'restricted'],
      intentProfile,
    });

    const rag = await runRagPipeline(llm, { question: test.question, chunks });
    const latencyMs = Date.now() - start;

    pipelineResults.push({
      id: test.id,
      question: test.question,
      groundedness: 0,
      citationAccuracy: 0,
      relevance: 0,
      hallucinationFlag: false,
      retrievalHitRate: chunks.length > 0 ? 1 : 0,
      citationCount: rag.citations.length,
      latencyMs,
      pass: false,
      answer: rag.answer,
      chunks: chunks.map((c) => ({ chunkId: c.chunkId, content: c.content, score: c.score })),
      citations: rag.citations,
    });
  }

  let results: Row[] = [];
  let artifactPath: string | undefined;

  const evalClient = createEvalServiceClient(settings.EVAL_SERVICE_URL);
  const useMlflow =
    settings.EVAL_BACKEND === 'mlflow' && evalClient && (await evalClient.health());

  if (useMlflow && evalClient) {
    const harness = await evalClient.runHarness(
      pipelineResults.map((r) => ({
        id: r.id,
        question: r.question,
        answer: r.answer!,
        chunks: r.chunks!,
        citations: r.citations!,
        latencyMs: r.latencyMs,
      })),
    );
    artifactPath = harness.artifactPath;
    results = harness.results.map((r) => {
      const row = r as Record<string, unknown>;
      const base = pipelineResults.find((p) => p.id === row.id);
      return {
        id: String(row.id),
        question: String(row.question),
        groundedness: Number(row.groundedness),
        citationAccuracy: Number(row.citationAccuracy),
        relevance: Number(row.relevance),
        hallucinationFlag: Boolean(row.hallucinationFlag),
        retrievalHitRate: base?.retrievalHitRate ?? 0,
        citationCount: base?.citationCount ?? 0,
        latencyMs: Number(row.latencyMs ?? base?.latencyMs ?? 0),
        pass: Boolean(row.pass),
        mlflowRunId: row.mlflowRunId ? String(row.mlflowRunId) : undefined,
      };
    });
    console.log('Scoring via eval-service (MLflow judges)\n');
  } else {
    if (settings.EVAL_BACKEND === 'mlflow') {
      console.warn('eval-service unavailable — scoring with heuristic fallback\n');
    }
    for (const row of pipelineResults) {
      const scores = scoreEvaluation({
        question: row.question,
        answer: row.answer!,
        citations: row.citations!,
        chunks: row.chunks!,
        latencyMs: row.latencyMs,
      });
      const pass = scores.groundedness >= 0.3 && scores.citationAccuracy >= 0.5;
      results.push({
        ...row,
        groundedness: scores.groundedness,
        citationAccuracy: scores.citationAccuracy,
        relevance: scores.relevance,
        hallucinationFlag: scores.hallucinationFlag,
        pass,
      });
    }
  }

  for (const r of results) {
    console.log(
      `${r.pass ? '✓' : '✗'} ${r.id}: groundedness=${r.groundedness.toFixed(2)} citations=${r.citationCount} ${r.pass ? 'PASS' : 'FAIL'}` +
        (r.mlflowRunId ? ` mlflow=${r.mlflowRunId.slice(0, 8)}` : ''),
    );
  }

  const passCount = results.filter((r) => r.pass).length;
  const avg = (vals: number[]) => vals.reduce((a, b) => a + b, 0) / vals.length;

  console.log('\n── Summary ──────────────────────────────────────');
  console.log(`  Eval backend:       ${useMlflow ? 'mlflow' : 'heuristic'}`);
  console.log(`  Pass rate:          ${passCount}/${results.length} (${Math.round((passCount / results.length) * 100)}%)`);
  console.log(`  Avg groundedness:   ${avg(results.map((r) => r.groundedness)).toFixed(2)}`);
  console.log(`  Avg citation acc:   ${avg(results.map((r) => r.citationAccuracy)).toFixed(2)}`);
  console.log(`  Avg relevance:      ${avg(results.map((r) => r.relevance)).toFixed(2)}`);
  console.log(
    `  Hallucination rate: ${Math.round((results.filter((r) => r.hallucinationFlag).length / results.length) * 100)}%`,
  );
  console.log(`  Retrieval hit rate: ${Math.round(avg(results.map((r) => r.retrievalHitRate)) * 100)}%`);
  console.log(`  Avg latency:        ${avg(results.map((r) => r.latencyMs)).toFixed(0)}ms`);
  if (artifactPath) console.log(`  Artifact:           ${artifactPath}`);
  console.log('═══════════════════════════════════════════════════\n');

  if (settings.MLFLOW_TRACKING_URI && settings.MLFLOW_TRACKING_URI !== 'databricks') {
    const mlflow = createMlflowClient({
      trackingUri: settings.MLFLOW_TRACKING_URI,
      token: settings.DATABRICKS_TOKEN,
      experimentName: settings.MLFLOW_EXPERIMENT_PATH || 'infraops-rag-eval',
    });
    if (mlflow) {
      try {
        const runId = await mlflow.logEvalRun(
          `eval-${new Date().toISOString().slice(0, 10)}`,
          {
            pass_rate: passCount / results.length,
            avg_groundedness: avg(results.map((r) => r.groundedness)),
            avg_citation_accuracy: avg(results.map((r) => r.citationAccuracy)),
            avg_relevance: avg(results.map((r) => r.relevance)),
            hallucination_rate: results.filter((r) => r.hallucinationFlag).length / results.length,
            retrieval_hit_rate: avg(results.map((r) => r.retrievalHitRate)),
            avg_latency_ms: avg(results.map((r) => r.latencyMs)),
          },
          { retrieval_backend: settings.RETRIEVAL_BACKEND },
        );
        console.log(`Aggregate MLflow run logged: ${runId}`);
      } catch (err) {
        console.warn('Aggregate MLflow logging skipped:', (err as Error).message);
      }
    }
  }

  await prisma.$disconnect();
  process.exit(passCount / results.length >= 0.6 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
