import { PrismaClient } from '@prisma/client';
import pino from 'pino';
import {
  loadSettingsFromDb,
  settingsRecordToAppSettings,
  type IotEventPayload,
} from '@infraops/shared';
import {
  analyzeIot,
  createLlmAdapter,
  scoreEvaluation,
} from '@infraops/ai-tools';

const logger = pino({ name: 'iot-processor' });

export async function processIotEvent(
  prisma: PrismaClient,
  payload: IotEventPayload,
  userId?: string,
) {
  const device = await prisma.iotDevice.findUnique({
    where: { id: payload.device_id },
  });
  if (!device) throw new Error(`Device ${payload.device_id} not found`);

  const settingsRaw = await loadSettingsFromDb(prisma);
  const settings = settingsRecordToAppSettings(settingsRaw);

  const recent = await prisma.iotEvent.findMany({
    where: { deviceId: payload.device_id },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  const history = recent
    .reverse()
    .map((e) => ({
      reading: e.reading as Record<string, number>,
      createdAt: e.createdAt,
    }));

  const llm = createLlmAdapter({
    anthropicKey: settings.ANTHROPIC_API_KEY,
    openaiKey: settings.OPENAI_API_KEY,
  });

  const analysis = await analyzeIot({
    deviceId: payload.device_id,
    deviceType: device.deviceType,
    reading: payload.reading as Record<string, number>,
    history,
    scoringBackend: settings.IOT_SCORING_BACKEND,
    modelEndpointUrl: settings.IOT_MODEL_ENDPOINT_URL,
    modelEndpointToken: settings.IOT_MODEL_ENDPOINT_TOKEN || settings.DATABRICKS_TOKEN,
    modelVersionLabel:
      settings.IOT_SCORING_BACKEND === 'model_serving'
        ? settings.IOT_MODEL_VERSION || 'model-serving'
        : 'heuristic-v1',
    llm,
  });

  const event = await prisma.iotEvent.create({
    data: {
      deviceId: payload.device_id,
      reading: payload.reading as object,
      anomalyScore: analysis.score,
      scoringBackend: analysis.scoringBackend,
      modelVersion: analysis.modelVersion,
      explanation: analysis.explanation,
    },
  });

  if (analysis.isAlert) {
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'iot_alert',
        resourceType: 'iot_event',
        resourceId: event.id,
        metadata: {
          summary: analysis.explanation
            ? `IoT alert on ${payload.device_id}: ${analysis.explanation.slice(0, 120)}`
            : `IoT alert on ${payload.device_id} (score ${analysis.score})`,
          deviceId: payload.device_id,
          deviceType: device.deviceType,
          anomalyScore: analysis.score,
          scoringBackend: analysis.scoringBackend,
          modelVersion: analysis.modelVersion,
          explanation: analysis.explanation,
          reading: payload.reading,
          scoringLatencyMs: analysis.scoringLatencyMs,
        },
      },
    });
    logger.warn(
      {
        deviceId: payload.device_id,
        anomalyScore: analysis.score,
        scoringBackend: analysis.scoringBackend,
        modelVersion: analysis.modelVersion,
      },
      'IoT anomaly alert created',
    );
  }

  return {
    eventId: event.id,
    anomalyScore: analysis.score,
    isAlert: analysis.isAlert,
    scoringBackend: analysis.scoringBackend,
    modelVersion: analysis.modelVersion,
    explanation: analysis.explanation,
  };
}

export async function processEvaluation(
  prisma: PrismaClient,
  data: {
    agentRunId: string;
    question: string;
    answer: string;
    citations: { chunkId: string; excerpt?: string }[];
    chunks: { chunkId: string; content: string; score: number }[];
    latencyMs: number;
  },
) {
  const scores = scoreEvaluation({
    question: data.question,
    answer: data.answer,
    citations: data.citations,
    chunks: data.chunks,
    latencyMs: data.latencyMs,
  });

  const evaluation = await prisma.evaluation.create({
    data: {
      agentRunId: data.agentRunId,
      groundedness: scores.groundedness,
      citationAccuracy: scores.citationAccuracy,
      relevance: scores.relevance,
      hallucinationFlag: scores.hallucinationFlag,
    },
  });

  return { evaluationId: evaluation.id, scores };
}
