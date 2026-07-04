import { EVAL_TEST_QUESTIONS } from '../schemas/evaluation';
import type { FeatureTestCaseDef } from './types';

const PLATFORM_TESTS: FeatureTestCaseDef[] = [
  {
    id: 'platform.db',
    category: 'platform',
    name: 'Database connectivity',
    description: 'PostgreSQL responds to a health query',
  },
  {
    id: 'platform.redis',
    category: 'platform',
    name: 'Redis connectivity',
    description: 'Redis accepts PING and returns PONG',
  },
];

const AUTH_TESTS: FeatureTestCaseDef[] = [
  {
    id: 'auth.admin_login',
    category: 'auth',
    name: 'Admin demo login',
    description: 'Seed admin user authenticates with demo password',
  },
];

const DATA_TESTS: FeatureTestCaseDef[] = [
  {
    id: 'data.documents_seeded',
    category: 'data',
    name: 'Documents seeded',
    description: 'At least 15 synthetic documents exist in the catalog',
  },
  {
    id: 'data.chunks_indexed',
    category: 'data',
    name: 'Chunks indexed',
    description: 'Document chunks with embeddings are available for retrieval',
  },
  {
    id: 'data.projects_seeded',
    category: 'data',
    name: 'Projects seeded',
    description: 'At least one project exists for filtering',
  },
  {
    id: 'data.iot_devices',
    category: 'data',
    name: 'IoT devices seeded',
    description: 'IoT devices exist for monitor dashboard',
  },
];

const RAG_STATIC_TESTS: FeatureTestCaseDef[] = [
  {
    id: 'rag.intent_safety',
    category: 'rag',
    name: 'Intent: safety procedure',
    description: 'LOTO question classifies as safety_procedure',
    tags: ['intent'],
  },
  {
    id: 'rag.intent_contract',
    category: 'rag',
    name: 'Intent: contract terms',
    description: 'Liability question classifies as contract_terms',
    tags: ['intent'],
  },
  {
    id: 'rag.retrieval',
    category: 'rag',
    name: 'Tri-hybrid retrieval',
    description: 'Retriever returns chunks for a sample question',
    tags: ['retrieval'],
  },
];

const RAG_EVAL_TESTS: FeatureTestCaseDef[] = EVAL_TEST_QUESTIONS.map((q) => ({
  id: `rag.eval.${q.id}`,
  category: 'rag' as const,
  name: `RAG eval ${q.id}`,
  description: q.question,
  tags: ['eval', ...(q.expectsCitation ? ['citation'] : [])],
}));

const WORKFLOW_TESTS: FeatureTestCaseDef[] = [
  {
    id: 'workflow.reviews',
    category: 'workflow',
    name: 'Review queue accessible',
    description: 'Pending reviews can be listed from the database',
  },
  {
    id: 'workflow.audit_log',
    category: 'workflow',
    name: 'Audit log writable',
    description: 'Audit log table is queryable',
  },
];

const SETTINGS_TESTS: FeatureTestCaseDef[] = [
  {
    id: 'settings.loaded',
    category: 'settings',
    name: 'Runtime settings loaded',
    description: 'system_settings table loads application configuration',
  },
];

const IOT_TESTS: FeatureTestCaseDef[] = [
  {
    id: 'iot.heuristic_score',
    category: 'workflow',
    name: 'IoT heuristic scoring',
    description: 'Baseline heuristic flags injected anomalies without Model Serving',
    tags: ['iot'],
  },
];

/** Canonical registry — add new cases here for future features. */
export const FEATURE_TEST_REGISTRY: FeatureTestCaseDef[] = [
  ...PLATFORM_TESTS,
  ...AUTH_TESTS,
  ...DATA_TESTS,
  ...RAG_STATIC_TESTS,
  ...RAG_EVAL_TESTS,
  ...WORKFLOW_TESTS,
  ...IOT_TESTS,
  ...SETTINGS_TESTS,
];

export function getFeatureTestCase(id: string): FeatureTestCaseDef | undefined {
  return FEATURE_TEST_REGISTRY.find((t) => t.id === id);
}

export const FEATURE_TEST_CATEGORIES = [
  'platform',
  'auth',
  'data',
  'rag',
  'workflow',
  'settings',
] as const;
