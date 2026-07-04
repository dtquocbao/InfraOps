import { IOT_BASELINES } from '@infraops/shared';

export interface ReadingSample {
  reading: Record<string, number>;
  createdAt?: Date | string;
}

export interface IotFeatureVector {
  deviceType: string;
  /** Ordered feature names for model serving payloads */
  featureNames: string[];
  /** Values aligned with featureNames */
  values: number[];
  /** Named map for heuristic / LLM explanation */
  features: Record<string, number>;
}

/**
 * Build a compact feature vector from the current reading and a short history window.
 * Features: per-field value, mean, std, rate-of-change, and baseline deviation.
 */
export function extractFeatures(
  deviceType: string,
  current: Record<string, number>,
  history: ReadingSample[] = [],
): IotFeatureVector {
  const baseline = IOT_BASELINES[deviceType];
  const fields = baseline ? Object.keys(baseline.fields) : Object.keys(current);
  const window = [...history.map((h) => h.reading), current].slice(-5);

  const features: Record<string, number> = {};
  const featureNames: string[] = [];
  const values: number[] = [];

  const push = (name: string, value: number) => {
    features[name] = value;
    featureNames.push(name);
    values.push(value);
  };

  for (const field of fields) {
    const series = window
      .map((r) => r[field])
      .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
    const value = current[field] ?? series[series.length - 1] ?? 0;
    const mean = series.length ? series.reduce((a, b) => a + b, 0) / series.length : value;
    const variance =
      series.length > 1
        ? series.reduce((a, b) => a + (b - mean) ** 2, 0) / series.length
        : 0;
    const std = Math.sqrt(variance);
    const prev = series.length > 1 ? series[series.length - 2]! : value;
    const roc = value - prev;

    const range = baseline?.fields[field];
    const mid = range ? (range.min + range.max) / 2 : mean;
    const span = range ? range.max - range.min || 1 : std || 1;
    const baselineDev = (value - mid) / span;

    push(`${field}_value`, value);
    push(`${field}_mean`, mean);
    push(`${field}_std`, std);
    push(`${field}_roc`, roc);
    push(`${field}_baseline_dev`, baselineDev);
  }

  return { deviceType, featureNames, values, features };
}
