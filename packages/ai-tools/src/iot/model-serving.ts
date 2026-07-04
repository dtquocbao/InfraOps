import type { IotFeatureVector } from './features';

export interface ModelServingConfig {
  endpointUrl: string;
  token: string;
  timeoutMs?: number;
}

export interface ModelServingScoreResult {
  score: number;
  modelVersion?: string;
  latencyMs: number;
  raw?: unknown;
}

/**
 * Invoke a Databricks Model Serving endpoint with a feature vector.
 * Supports common response shapes: { predictions: [n] } or { predictions: [{ score }] }.
 */
export async function scoreWithModelServing(
  features: IotFeatureVector,
  config: ModelServingConfig,
): Promise<ModelServingScoreResult> {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? 5000);

  try {
    const res = await fetch(config.endpointUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dataframe_split: {
          columns: features.featureNames,
          data: [features.values],
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Model Serving failed: ${res.status} ${await res.text()}`);
    }

    const body = (await res.json()) as {
      predictions?: unknown;
      model_version?: string;
    };

    const score = parsePrediction(body.predictions);
    return {
      score: Math.min(1, Math.max(0, score)),
      modelVersion: body.model_version,
      latencyMs: Date.now() - start,
      raw: body,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function parsePrediction(predictions: unknown): number {
  if (typeof predictions === 'number') return predictions;
  if (Array.isArray(predictions) && predictions.length > 0) {
    const first = predictions[0];
    if (typeof first === 'number') return first;
    if (first && typeof first === 'object') {
      const obj = first as Record<string, unknown>;
      if (typeof obj.score === 'number') return obj.score;
      if (typeof obj.prediction === 'number') return obj.prediction;
      if (typeof obj.anomaly_score === 'number') return obj.anomaly_score;
    }
  }
  throw new Error('Unrecognized Model Serving prediction payload');
}
