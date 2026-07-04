export interface EvalServiceTracePayload {
  agentRunId: string;
  question: string;
  answer: string;
  chunks: { chunkId: string; content: string; score?: number }[];
  citations: { chunkId: string; excerpt?: string; documentId?: string }[];
  latencyMs?: number;
  agentType?: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
}

export interface EvalServiceScores {
  mlflowRunId: string;
  evalBackend: 'mlflow';
  judgeScores: Record<string, unknown>;
  groundedness: number;
  citationAccuracy: number;
  relevance: number;
  hallucinationFlag: boolean;
  judgeSource?: string;
}

export interface EvalHarnessResult {
  passRate: number;
  passCount: number;
  totalCount: number;
  avgGroundedness: number;
  avgCitationAccuracy: number;
  avgRelevance: number;
  hallucinationRate: number;
  meetsThreshold: boolean;
  artifactPath?: string;
  results: Array<Record<string, unknown>>;
}

export class EvalServiceClient {
  constructor(private baseUrl: string) {}

  private url(path: string) {
    return `${this.baseUrl.replace(/\/$/, '')}${path}`;
  }

  async health(): Promise<boolean> {
    try {
      const res = await fetch(this.url('/health'));
      return res.ok;
    } catch {
      return false;
    }
  }

  async traceAndEvaluate(payload: EvalServiceTracePayload): Promise<EvalServiceScores> {
    const tr = await fetch(this.url('/trace'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!tr.ok) {
      throw new Error(`eval-service /trace failed: ${tr.status} ${await tr.text()}`);
    }
    const { mlflowRunId } = (await tr.json()) as { mlflowRunId: string };

    const ev = await fetch(this.url(`/evaluate/${mlflowRunId}`), { method: 'POST' });
    if (!ev.ok) {
      throw new Error(`eval-service /evaluate failed: ${ev.status} ${await ev.text()}`);
    }
    return ev.json() as Promise<EvalServiceScores>;
  }

  async runHarness(
    items: Array<{
      id?: string;
      question: string;
      answer: string;
      chunks: { chunkId: string; content: string; score?: number }[];
      citations: { chunkId: string; excerpt?: string }[];
      latencyMs?: number;
    }>,
    minPassRate = 0.6,
  ): Promise<EvalHarnessResult> {
    const res = await fetch(this.url('/harness/run'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, minPassRate }),
    });
    if (!res.ok) {
      throw new Error(`eval-service /harness/run failed: ${res.status} ${await res.text()}`);
    }
    return res.json() as Promise<EvalHarnessResult>;
  }
}

export function createEvalServiceClient(baseUrl?: string): EvalServiceClient | null {
  if (!baseUrl) return null;
  return new EvalServiceClient(baseUrl);
}
