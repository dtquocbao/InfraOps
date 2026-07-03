/**
 * Feature test suite CLI for CI/CD and local verification.
 * Usage: npm run test:features
 *
 * Exit codes:
 *   0 — pass rate meets FEATURE_TEST_MIN_PASS_RATE (default 0.8)
 *   1 — suite failed or pass rate below threshold
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import IORedis from 'ioredis';
import {
  loadSettingsFromDb,
  settingsRecordToAppSettings,
  validateBootstrapEnv,
} from '@infraops/shared';
import { runFeatureTestSuite } from '@infraops/ai-tools';

validateBootstrapEnv(process.env);

const MIN_PASS_RATE = Number(process.env.FEATURE_TEST_MIN_PASS_RATE ?? '0.8');
const prisma = new PrismaClient();

async function main() {
  const settingsRaw = await loadSettingsFromDb(prisma);
  const settings = settingsRecordToAppSettings(settingsRaw);
  const redis = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  InfraOps AI — Feature Test Suite (CI)');
  console.log(`  Min pass rate: ${(MIN_PASS_RATE * 100).toFixed(0)}%`);
  console.log(`  Retrieval: ${settings.RETRIEVAL_BACKEND}`);
  console.log('═══════════════════════════════════════════════════\n');

  const summary = await runFeatureTestSuite({
    prisma,
    settings,
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
    onProgress: (result) => {
      const icon =
        result.status === 'passed' ? '✓' : result.status === 'skipped' ? '○' : '✗';
      console.log(
        `${icon} [${result.category}] ${result.testCaseId}: ${result.status} (${result.durationMs}ms)` +
          (result.message ? ` — ${result.message}` : ''),
      );
    },
  });

  await redis.quit();

  console.log('\n── Summary ──────────────────────────────────────');
  console.log(`  Total:      ${summary.totalCount}`);
  console.log(`  Passed:     ${summary.passCount}`);
  console.log(`  Failed:     ${summary.failCount}`);
  console.log(`  Skipped:    ${summary.skipCount}`);
  console.log(`  Pass rate:  ${(summary.passRate * 100).toFixed(1)}%`);
  console.log(`  Backend:    ${summary.retrievalBackend}`);
  console.log('═══════════════════════════════════════════════════\n');

  // Persist machine-readable report for CI artifacts
  const reportPath = process.env.FEATURE_TEST_REPORT_PATH ?? 'feature-test-report.json';
  const fs = await import('fs/promises');
  await fs.writeFile(
    reportPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        minPassRate: MIN_PASS_RATE,
        ...summary,
      },
      null,
      2,
    ),
  );
  console.log(`Report written to ${reportPath}`);

  const criticalFailed = summary.results.filter(
    (r) =>
      (r.status === 'failed' || r.status === 'error') &&
      !r.testCaseId.startsWith('rag.eval.'),
  );

  if (criticalFailed.length > 0) {
    console.error(
      `\nCritical failures (non-eval):\n${criticalFailed
        .map((r) => `  - ${r.testCaseId}: ${r.message ?? r.status}`)
        .join('\n')}`,
    );
    process.exit(1);
  }

  if (summary.passRate < MIN_PASS_RATE) {
    console.error(
      `\nPass rate ${(summary.passRate * 100).toFixed(1)}% is below threshold ${(MIN_PASS_RATE * 100).toFixed(0)}%`,
    );
    process.exit(1);
  }

  console.log('Feature test suite PASSED\n');
  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
