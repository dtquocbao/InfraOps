import type { PrismaClient } from '@prisma/client';
import { runFeatureTestSuite } from '@infraops/ai-tools';
import {
  loadSettingsFromDb,
  settingsRecordToAppSettings,
} from '@infraops/shared';
import * as bcrypt from 'bcryptjs';
import type IORedis from 'ioredis';

export async function processFeatureTestRun(
  prisma: PrismaClient,
  redis: IORedis,
  runId: string,
) {
  const run = await prisma.featureTestRun.findUnique({ where: { id: runId } });
  if (!run) throw new Error(`Feature test run ${runId} not found`);

  const settingsRaw = await loadSettingsFromDb(prisma);
  const appSettings = settingsRecordToAppSettings(settingsRaw);

  try {
    const summary = await runFeatureTestSuite({
      prisma,
      settings: appSettings,
      redisPing: async () => {
        try {
          return (await redis.ping()) === 'PONG';
        } catch {
          return false;
        }
      },
      verifyAdminLogin: async () => {
        const admin = await prisma.user.findUnique({
          where: { email: 'admin@meridiangrid.com' },
        });
        if (!admin) return false;
        return bcrypt.compare('password123', admin.password);
      },
      onProgress: async (result) => {
        await prisma.featureTestResult.create({
          data: {
            runId,
            testCaseId: result.testCaseId,
            category: result.category,
            name: result.name,
            status: result.status,
            message: result.message,
            durationMs: result.durationMs,
            details: (result.details ?? {}) as object,
          },
        });
      },
    });

    await prisma.featureTestRun.update({
      where: { id: runId },
      data: {
        status: 'completed',
        passCount: summary.passCount,
        failCount: summary.failCount,
        skipCount: summary.skipCount,
        totalCount: summary.totalCount,
        retrievalBackend: summary.retrievalBackend,
        completedAt: new Date(),
        summary: {
          passRate: summary.passRate,
          avgDurationMs:
            summary.results.reduce((a, r) => a + r.durationMs, 0) / summary.results.length,
        },
      },
    });

    return summary;
  } catch (err) {
    await prisma.featureTestRun.update({
      where: { id: runId },
      data: {
        status: 'failed',
        completedAt: new Date(),
        summary: { error: err instanceof Error ? err.message : String(err) },
      },
    });
    throw err;
  }
}
