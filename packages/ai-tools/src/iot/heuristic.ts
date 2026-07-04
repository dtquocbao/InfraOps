import { IOT_BASELINES } from '@infraops/shared';

/** Original baseline-threshold heuristic (zero Databricks dependency). */
export function scoreHeuristic(
  deviceType: string,
  reading: Record<string, number>,
): number {
  const baseline = IOT_BASELINES[deviceType];
  if (!baseline) return 0;

  let totalWeight = 0;
  let anomalySum = 0;

  for (const [field, range] of Object.entries(baseline.fields)) {
    const value = reading[field];
    if (value === undefined) continue;
    totalWeight += range.weight;

    if (value >= range.min && value <= range.max) continue;

    const span = range.max - range.min || 1;
    const distance =
      value < range.min ? (range.min - value) / span : (value - range.max) / span;
    anomalySum += Math.min(1, distance) * range.weight;
  }

  if (totalWeight === 0) return 0;
  // Scale so simulator-injected anomalies (clearly out of band) reliably exceed
  // IOT_ANOMALY_THRESHOLD (0.75) and IOT_ALERT_SEVERITY_THRESHOLD (0.85).
  const raw = anomalySum / totalWeight;
  return Math.round(Math.min(1, raw * 1.8) * 100) / 100;
}
