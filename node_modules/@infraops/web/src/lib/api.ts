import type { Citation, DocumentResponse, LoginResponse, RagQueryResponse } from '@infraops/shared';

const TOKEN_KEY = 'infraops_token';
const USER_KEY = 'infraops_user';

export type StoredUser = LoginResponse['user'];

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): StoredUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function setSession(data: LoginResponse) {
  localStorage.setItem(TOKEN_KEY, data.accessToken);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

const API_BASE = import.meta.env.VITE_API_URL ?? '';

async function authFetch(path: string, init: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? 'Login failed');
  }
  return res.json();
}

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/api/health`);
  return res.json();
}

export interface ProjectSummary {
  id: string;
  name: string;
  discipline: string;
  status: string;
  createdAt: string;
  documentCount: number;
  iotDeviceCount: number;
}

export interface ProjectDetail extends ProjectSummary {
  readyDocumentCount: number;
  documents: Array<{
    id: string;
    title: string;
    docType: string;
    processingStatus: string;
    securityLevel: string;
    approvalStatus: string;
  }>;
  iotDevices: Array<{
    id: string;
    name: string;
    deviceType: string;
    location: string;
  }>;
}

export async function fetchProjects(): Promise<ProjectSummary[]> {
  return authFetch('/api/projects');
}

export async function fetchProject(id: string): Promise<ProjectDetail> {
  return authFetch(`/api/projects/${id}`);
}

export async function fetchDocuments(): Promise<DocumentResponse[]> {
  return authFetch('/api/documents');
}

export async function uploadDocument(
  file: File,
  meta: {
    title: string;
    docType: string;
    department: string;
    securityLevel: string;
    projectId?: string;
  },
): Promise<DocumentResponse> {
  const form = new FormData();
  form.append('file', file);
  form.append('title', meta.title);
  form.append('docType', meta.docType);
  form.append('department', meta.department);
  form.append('securityLevel', meta.securityLevel);
  if (meta.projectId) form.append('projectId', meta.projectId);

  const token = getToken();
  const res = await fetch(`${API_BASE}/api/documents/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? 'Upload failed');
  }
  return res.json();
}

export async function ragQuery(question: string, filters?: {
  projectId?: string;
  discipline?: string;
  docType?: string;
}): Promise<RagQueryResponse & { reviewRequired?: boolean; reviewId?: string }> {
  return authFetch('/api/agents/rag/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, ...filters }),
  });
}

export interface PendingReview {
  id: string;
  status: string;
  comments: string | null;
  agentRun: {
    id: string;
    agentType: string;
    input: { question?: string };
    output: { answer?: string; confidence?: number };
    citations: Citation[];
    traceId: string;
    createdAt: string;
    user: { name: string; email: string; role: string };
  };
}

export async function fetchPendingReviews(): Promise<PendingReview[]> {
  return authFetch('/api/reviews/pending');
}

export async function decideReview(
  runId: string,
  decision: 'approved' | 'rejected',
  comments?: string,
) {
  return authFetch(`/api/reviews/${runId}/decide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision, comments }),
  });
}

export interface IotDevice {
  id: string;
  name: string;
  deviceType: string;
  location: string;
  events?: { reading: Record<string, number>; anomalyScore: number | null; createdAt: string }[];
}

export interface IotAlert {
  id: string;
  deviceId: string;
  deviceName: string;
  deviceType: string;
  location: string;
  reading: Record<string, number>;
  anomalyScore: number;
  scoringBackend?: string;
  modelVersion?: string | null;
  explanation?: string | null;
  createdAt: string;
}

export async function fetchIotDevices(): Promise<IotDevice[]> {
  return authFetch('/api/iot/devices');
}

export async function fetchIotAlerts(): Promise<IotAlert[]> {
  return authFetch('/api/iot/alerts');
}

export async function fetchEvalSummary() {
  return authFetch('/api/evaluations/summary');
}

export async function fetchAuditLog(): Promise<AuditLogEntry[]> {
  return authFetch('/api/admin/audit-log');
}

export interface AuditChange {
  field: string;
  label: string;
  before: string;
  after: string;
  isSecret?: boolean;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actionLabel: string;
  resourceType: string;
  resourceId: string | null;
  createdAt: string;
  actor: {
    id: string | null;
    name: string;
    email: string | null;
    role: string;
  };
  summary: string;
  method: string;
  methodLabel: string;
  changes: AuditChange[];
  metadata: Record<string, unknown>;
}

export async function fetchQueueMetrics() {
  return authFetch('/api/admin/queue-metrics');
}

export interface SystemSettingView {
  key: string;
  label: string;
  description: string;
  category: 'llm' | 'retrieval' | 'databricks' | 'mlflow' | 'iot';
  value: string;
  displayValue: string;
  isSecret: boolean;
  options?: string[];
  updatedAt: string | null;
}

export async function fetchSettings(): Promise<SystemSettingView[]> {
  return authFetch('/api/admin/settings');
}

export async function updateSettings(values: Record<string, string>): Promise<SystemSettingView[]> {
  return authFetch('/api/admin/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  });
}

export interface AgentRunSummary {
  id: string;
  agentType: string;
  latencyMs: number | null;
  createdAt: string;
  confidence?: number;
}

export interface ExecutiveSummary {
  timestamp: string;
  retrievalBackend: string;
  databricksConfigured: boolean;
  project: {
    id: string;
    name: string;
    status: string;
    documentCount: number;
    iotDeviceCount: number;
  } | null;
  documents: {
    total: number;
    ready: number;
    byType: Record<string, number>;
  };
  agentRuns: {
    total: number;
    recent: AgentRunSummary[];
  };
  evaluations: {
    totalRuns: number;
    totalEvaluations: number;
    avgGroundedness: number | null;
    avgCitationAccuracy: number | null;
    avgRelevance: number | null;
    hallucinationRate: number;
    avgLatencyMs: number | null;
    retrievalHitRate: number;
    positiveRatings: number;
    negativeRatings: number;
  };
  reviews: { pending: number };
  iot: {
    activeAlerts: number;
    alerts: IotAlert[];
  };
  queues: Record<string, { waiting: number; active: number; completed: number; failed: number }>;
}

export async function fetchExecutiveSummary(): Promise<ExecutiveSummary> {
  return authFetch('/api/dashboard/executive');
}

export interface FeatureTestCaseView {
  id: string;
  category: string;
  name: string;
  description: string;
  tags?: string[];
}

export interface FeatureTestResultView {
  id: string;
  testCaseId: string;
  category: string;
  name: string;
  status: 'passed' | 'failed' | 'skipped' | 'error';
  message: string | null;
  durationMs: number | null;
  details: Record<string, unknown>;
}

export interface FeatureTestRunView {
  id: string;
  source: string;
  status: 'running' | 'completed' | 'failed';
  passCount: number;
  failCount: number;
  skipCount: number;
  totalCount: number;
  passRate: number;
  retrievalBackend: string | null;
  triggeredBy: { id: string; name: string; email: string } | null;
  startedAt: string;
  completedAt: string | null;
  results?: FeatureTestResultView[];
}

export async function fetchFeatureTestCases(): Promise<FeatureTestCaseView[]> {
  return authFetch('/api/admin/feature-tests/cases');
}

export async function fetchFeatureTestRuns(limit = 10): Promise<FeatureTestRunView[]> {
  return authFetch(`/api/admin/feature-tests/runs?limit=${limit}`);
}

export async function fetchFeatureTestLatestRun(): Promise<FeatureTestRunView | null> {
  return authFetch('/api/admin/feature-tests/runs/latest');
}

export async function triggerFeatureTestRun(): Promise<{ runId: string; status: string }> {
  return authFetch('/api/admin/feature-tests/run', { method: 'POST' });
}

export type { Citation, RagQueryResponse, DocumentResponse };
