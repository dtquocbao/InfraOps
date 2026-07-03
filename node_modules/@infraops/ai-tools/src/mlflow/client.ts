export interface MlflowConfig {
  trackingUri: string;
  token?: string;
  experimentName?: string;
}

export interface MlflowRunMetrics {
  [key: string]: number;
}

export class MlflowClient {
  constructor(private config: MlflowConfig) {}

  private get baseUrl() {
    return this.config.trackingUri.replace(/\/$/, '');
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config.token) h.Authorization = `Bearer ${this.config.token}`;
    return h;
  }

  async logEvalRun(runName: string, metrics: MlflowRunMetrics, params: Record<string, string>) {
    const experimentId = await this.getOrCreateExperiment(
      this.config.experimentName ?? 'infraops-rag-eval',
    );

    const runRes = await fetch(`${this.baseUrl}/api/2.0/mlflow/runs/create`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        experiment_id: experimentId,
        start_time: Date.now(),
        tags: [{ key: 'mlflow.runName', value: runName }],
      }),
    });

    if (!runRes.ok) {
      throw new Error(`MLflow run create failed: ${runRes.status}`);
    }

    const { run } = (await runRes.json()) as { run: { info: { run_id: string } } };
    const runId = run.info.run_id;

    await fetch(`${this.baseUrl}/api/2.0/mlflow/runs/log-parameter`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        run_id: runId,
        key: 'retrieval_backend',
        value: params.retrieval_backend ?? 'unknown',
      }),
    });

    for (const [key, value] of Object.entries(metrics)) {
      await fetch(`${this.baseUrl}/api/2.0/mlflow/runs/log-metric`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ run_id: runId, key, value, timestamp: Date.now() }),
      });
    }

    await fetch(`${this.baseUrl}/api/2.0/mlflow/runs/update`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ run_id: runId, status: 'FINISHED', end_time: Date.now() }),
    });

    return runId;
  }

  private async getOrCreateExperiment(name: string): Promise<string> {
    const createRes = await fetch(`${this.baseUrl}/api/2.0/mlflow/experiments/create`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ name }),
    });

    if (createRes.ok) {
      const data = (await createRes.json()) as { experiment_id: string };
      return data.experiment_id;
    }

    const getRes = await fetch(
      `${this.baseUrl}/api/2.0/mlflow/experiments/get-by-name?experiment_name=${encodeURIComponent(name)}`,
      { headers: this.headers() },
    );
    const data = (await getRes.json()) as { experiment: { experiment_id: string } };
    return data.experiment.experiment_id;
  }
}

export function createMlflowClient(config?: MlflowConfig): MlflowClient | null {
  if (!config?.trackingUri) return null;
  return new MlflowClient(config);
}
