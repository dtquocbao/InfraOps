import 'dotenv/config';
import { Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import pino from 'pino';
import { loadSettingsFromDb, validateBootstrapEnv, QUEUE_NAMES } from '@infraops/shared';
import { processDocument } from '@infraops/ai-tools';
import { processEvaluation, processIotEvent } from './processors/iot.processor';
import { processFeatureTestRun } from './processors/feature-tests.processor';
import IORedis from 'ioredis';

const logger = pino({ name: 'infraops-worker' });
const prisma = new PrismaClient();

function getRedisConnection() {
  const env = validateBootstrapEnv(process.env);
  const url = new URL(env.REDIS_URL);
  return { host: url.hostname, port: Number(url.port || 6379) };
}

async function getOpenAiKey() {
  const settings = await loadSettingsFromDb(prisma);
  return settings.OPENAI_API_KEY || undefined;
}

async function main() {
  validateBootstrapEnv(process.env);
  await prisma.$connect();
  const connection = getRedisConnection();

  new Worker(
    QUEUE_NAMES.DOCUMENT_PROCESSING,
    async (job) => {
      if (job.name === 'process_document') {
        const { documentId } = job.data as { documentId: string };
        return processDocument(prisma, documentId, await getOpenAiKey());
      }
      return { status: 'ignored' };
    },
    { connection },
  );

  new Worker(
    QUEUE_NAMES.IOT_PROCESSING,
    async (job) => {
      if (job.name === 'process_iot_event') {
        const { payload, userId } = job.data as {
          payload: Parameters<typeof processIotEvent>[1];
          userId?: string;
        };
        return processIotEvent(prisma, payload, userId);
      }
      return { status: 'ignored' };
    },
    { connection },
  );

  new Worker(
    QUEUE_NAMES.EVALUATION,
    async (job) => {
      if (job.name === 'evaluate_response') {
        return processEvaluation(prisma, job.data as Parameters<typeof processEvaluation>[1]);
      }
      return { status: 'ignored' };
    },
    { connection },
  );

  const env = validateBootstrapEnv(process.env);
  const redis = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

  new Worker(
    QUEUE_NAMES.FEATURE_TESTS,
    async (job) => {
      if (job.name === 'run_feature_tests') {
        const { runId } = job.data as { runId: string };
        return processFeatureTestRun(prisma, redis, runId);
      }
      return { status: 'ignored' };
    },
    { connection },
  );

  logger.info('InfraOps worker started - document, IoT, evaluation, and feature-test processors active');
}

main().catch((err) => {
  logger.error(err, 'Worker failed to start');
  process.exit(1);
});
