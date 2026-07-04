import { analyzeIot } from './analyze';
import { extractFeatures } from './features';
import { scoreHeuristic } from './heuristic';

describe('IoT anomaly scoring', () => {
  it('extracts rolling features for a transformer reading', () => {
    const features = extractFeatures(
      'transformer',
      { temperature_c: 60, load_pct: 70, vibration_hz: 12 },
      [
        { reading: { temperature_c: 55, load_pct: 65, vibration_hz: 10 } },
        { reading: { temperature_c: 58, load_pct: 68, vibration_hz: 11 } },
      ],
    );
    expect(features.featureNames.length).toBeGreaterThan(0);
    expect(features.values.length).toBe(features.featureNames.length);
    expect(features.features.temperature_c_value).toBe(60);
  });

  it('heuristic scores normal readings low', () => {
    const score = scoreHeuristic('transformer', {
      temperature_c: 55,
      load_pct: 60,
      vibration_hz: 10,
    });
    expect(score).toBeLessThan(0.3);
  });

  it('heuristic scores injected anomalies high', () => {
    const score = scoreHeuristic('transformer', {
      temperature_c: 100,
      load_pct: 98,
      vibration_hz: 28,
    });
    expect(score).toBeGreaterThanOrEqual(0.75);
  });

  it('analyzeIot uses heuristic without LLM when not flagged', async () => {
    const result = await analyzeIot({
      deviceId: 'TXF-014',
      deviceType: 'transformer',
      reading: { temperature_c: 55, load_pct: 60, vibration_hz: 10 },
      scoringBackend: 'heuristic',
    });
    expect(result.flagged).toBe(false);
    expect(result.scoringBackend).toBe('heuristic');
    expect(result.explanation).toBeUndefined();
  });

  it('falls back to heuristic when model_serving is misconfigured', async () => {
    const result = await analyzeIot({
      deviceId: 'TXF-014',
      deviceType: 'transformer',
      reading: { temperature_c: 100, load_pct: 98, vibration_hz: 28 },
      scoringBackend: 'model_serving',
      // no endpoint URL/token
    });
    expect(result.scoringBackend).toBe('heuristic');
    expect(result.modelVersion).toBe('heuristic-fallback');
    expect(result.flagged).toBe(true);
  });
});
