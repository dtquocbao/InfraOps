import * as fs from 'fs/promises';
import { PrismaClient } from '@prisma/client';
import pino from 'pino';
import {
  IOT_ALERT_SEVERITY_THRESHOLD,
  type IotEventPayload,
} from '@infraops/shared';
import { detectAnomaly, scoreEvaluation } from '@infraops/ai-tools';

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

  const anomalyScore = detectAnomaly(device.deviceType, payload.reading as Record<string, number>);

  const event = await prisma.iotEvent.create({
    data: {
      deviceId: payload.device_id,
      reading: payload.reading as object,
      anomalyScore,
    },
  });

  if (anomalyScore >= IOT_ALERT_SEVERITY_THRESHOLD) {
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'iot_alert',
        resourceType: 'iot_event',
        resourceId: event.id,
        metadata: {
          deviceId: payload.device_id,
          deviceType: device.deviceType,
          anomalyScore,
          reading: payload.reading,
        },
      },
    });
    logger.warn({ deviceId: payload.device_id, anomalyScore }, 'IoT anomaly alert created');
  }

  return { eventId: event.id, anomalyScore, isAlert: anomalyScore >= IOT_ALERT_SEVERITY_THRESHOLD };
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
