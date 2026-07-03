import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  FEATURE_TEST_REGISTRY,
  type FeatureTestCaseStatus,
  type FeatureTestCategory,
  type FeatureTestRunView,
} from '@infraops/shared';
import { PrismaService } from '../prisma/prisma.module';
import { QueueService } from '../queue/queue.service';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class FeatureTestsService {
  private readonly logger = new Logger(FeatureTestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly settings: SettingsService,
  ) {}

  listCases() {
    return FEATURE_TEST_REGISTRY;
  }

  async listRuns(limit = 10): Promise<FeatureTestRunView[]> {
    const runs = await this.prisma.featureTestRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: limit,
      include: {
        triggeredBy: { select: { id: true, name: true, email: true } },
      },
    });
    return runs.map((run) => this.toRunView(run));
  }

  async getLatestRun(): Promise<FeatureTestRunView | null> {
    const run = await this.prisma.featureTestRun.findFirst({
      orderBy: { startedAt: 'desc' },
      include: {
        triggeredBy: { select: { id: true, name: true, email: true } },
        results: { orderBy: { testCaseId: 'asc' } },
      },
    });
    return run ? this.toRunView(run, true) : null;
  }

  async getRun(id: string): Promise<FeatureTestRunView> {
    const run = await this.prisma.featureTestRun.findUnique({
      where: { id },
      include: {
        triggeredBy: { select: { id: true, name: true, email: true } },
        results: { orderBy: { testCaseId: 'asc' } },
      },
    });
    if (!run) throw new NotFoundException('Feature test run not found');
    return this.toRunView(run, true);
  }

  async triggerRun(userId: string, source = 'admin') {
    const running = await this.prisma.featureTestRun.findFirst({
      where: { status: 'running' },
    });
    if (running) {
      return { runId: running.id, status: 'already_running' as const };
    }

    const run = await this.prisma.featureTestRun.create({
      data: {
        triggeredById: userId,
        source,
        status: 'running',
        totalCount: FEATURE_TEST_REGISTRY.length,
        retrievalBackend: this.settings.get('RETRIEVAL_BACKEND') || 'pgvector',
      },
    });

    await this.queue.getFeatureTestQueue().add(
      'run_feature_tests',
      { runId: run.id },
      { attempts: 1, removeOnComplete: 100, removeOnFail: 50 },
    );

    this.logger.log(`Feature test run ${run.id} queued by user ${userId}`);
    return { runId: run.id, status: 'started' as const };
  }

  private toRunView(
    run: {
      id: string;
      source: string;
      status: string;
      passCount: number;
      failCount: number;
      skipCount: number;
      totalCount: number;
      retrievalBackend: string | null;
      startedAt: Date;
      completedAt: Date | null;
      triggeredBy: { id: string; name: string; email: string } | null;
      results?: Array<{
        id: string;
        testCaseId: string;
        category: string;
        name: string;
        status: string;
        message: string | null;
        durationMs: number | null;
        details: unknown;
      }>;
    },
    includeResults = false,
  ): FeatureTestRunView {
    const total = run.totalCount || run.passCount + run.failCount + run.skipCount;
    return {
      id: run.id,
      source: run.source,
      status: run.status as FeatureTestRunView['status'],
      passCount: run.passCount,
      failCount: run.failCount,
      skipCount: run.skipCount,
      totalCount: total,
      passRate: total ? run.passCount / total : 0,
      retrievalBackend: run.retrievalBackend,
      triggeredBy: run.triggeredBy,
      startedAt: run.startedAt.toISOString(),
      completedAt: run.completedAt?.toISOString() ?? null,
      results: includeResults
        ? run.results?.map((r) => ({
            id: r.id,
            testCaseId: r.testCaseId,
            category: r.category as FeatureTestCategory,
            name: r.name,
            status: r.status as FeatureTestCaseStatus,
            message: r.message,
            durationMs: r.durationMs,
            details: (r.details ?? {}) as Record<string, unknown>,
          }))
        : undefined,
    };
  }
}
