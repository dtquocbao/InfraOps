import {
  IOT_ALERT_SEVERITY_THRESHOLD,
  IOT_ANOMALY_THRESHOLD,
} from '@infraops/shared';
import type { LlmAdapter } from '../llm/adapter';
import { extractFeatures, type ReadingSample } from './features';
import { scoreHeuristic } from './heuristic';
import { scoreWithModelServing } from './model-serving';

export type IotScoringBackend = 'heuristic' | 'model_serving';

export interface AnalyzeIotInput {
  deviceId: string;
  deviceType: string;
  reading: Record<string, number>;
  history?: ReadingSample[];
  scoringBackend: IotScoringBackend;
  modelEndpointUrl?: string;
  modelEndpointToken?: string;
  modelVersionLabel?: string;
  llm?: LlmAdapter;
}

export interface IotAnalysis {
  deviceId: string;
  score: number;
  flagged: boolean;
  isAlert: boolean;
  scoringBackend: IotScoringBackend;
  modelVersion: string;
  explanation?: string;
  features: Record<string, number>;
  scoringLatencyMs: number;
}

/**
 * Two-step IoT analysis:
 * 1) Fast classifier / heuristic scores anomaly likelihood
 * 2) LLM explains only when score crosses the anomaly threshold
 */
export async function analyzeIot(input: AnalyzeIotInput): Promise<IotAnalysis> {
  const features = extractFeatures(input.deviceType, input.reading, input.history ?? []);
  const start = Date.now();

  let score: number;
  let scoringBackend: IotScoringBackend = input.scoringBackend;
  let modelVersion = input.modelVersionLabel ?? 'heuristic-v1';

  if (input.scoringBackend === 'model_serving') {
    if (!input.modelEndpointUrl || !input.modelEndpointToken) {
      // Feature-flag fallback: endpoint not configured
      score = scoreHeuristic(input.deviceType, input.reading);
      scoringBackend = 'heuristic';
      modelVersion = 'heuristic-fallback';
    } else {
      try {
        const result = await scoreWithModelServing(features, {
          endpointUrl: input.modelEndpointUrl,
          token: input.modelEndpointToken,
        });
        score = result.score;
        modelVersion = result.modelVersion ?? input.modelVersionLabel ?? 'model-serving';
      } catch {
        score = scoreHeuristic(input.deviceType, input.reading);
        scoringBackend = 'heuristic';
        modelVersion = 'heuristic-fallback';
      }
    }
  } else {
    score = scoreHeuristic(input.deviceType, input.reading);
  }

  const scoringLatencyMs = Date.now() - start;
  const flagged = score >= IOT_ANOMALY_THRESHOLD;
  const isAlert = score >= IOT_ALERT_SEVERITY_THRESHOLD;

  let explanation: string | undefined;
  if (flagged && input.llm) {
    explanation = await llmExplainAnomaly(input.llm, {
      deviceId: input.deviceId,
      deviceType: input.deviceType,
      reading: input.reading,
      score,
      features: features.features,
      scoringBackend,
    });
  }

  return {
    deviceId: input.deviceId,
    score,
    flagged,
    isAlert,
    scoringBackend,
    modelVersion,
    explanation,
    features: features.features,
    scoringLatencyMs,
  };
}

async function llmExplainAnomaly(
  llm: LlmAdapter,
  ctx: {
    deviceId: string;
    deviceType: string;
    reading: Record<string, number>;
    score: number;
    features: Record<string, number>;
    scoringBackend: string;
  },
): Promise<string> {
  const result = await llm.complete(
    [
      {
        role: 'system',
        content:
          'You are an industrial IoT analyst for Meridian Grid Services. Explain sensor anomalies in 2-3 concise sentences for operators. Do not invent readings.',
      },
      {
        role: 'user',
        content: [
          `Device: ${ctx.deviceId} (${ctx.deviceType})`,
          `Anomaly score: ${ctx.score.toFixed(2)} (backend: ${ctx.scoringBackend})`,
          `Current reading: ${JSON.stringify(ctx.reading)}`,
          `Key features: ${JSON.stringify(ctx.features)}`,
          'Explain what looks abnormal and a recommended operator check.',
        ].join('\n'),
      },
    ],
    { maxTokens: 256, temperature: 0.2 },
  );
  return result.content.trim();
}
