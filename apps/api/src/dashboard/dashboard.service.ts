import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import { EvaluationService } from '../evaluation/evaluation.service';
import { ReviewService } from '../review/review.service';
import { IotService } from '../iot/iot.service';
import { QueueService } from '../queue/queue.service';
import { AgentsService } from '../agents/agents.service';
import { RuntimeConfigService } from '../settings/runtime-config.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evaluation: EvaluationService,
    private readonly review: ReviewService,
    private readonly iot: IotService,
    private readonly queue: QueueService,
    private readonly agents: AgentsService,
    private readonly runtime: RuntimeConfigService,
  ) {}

  async getExecutiveSummary() {
    const [
      evalSummary,
      pendingReviews,
      iotAlerts,
      documents,
      recentRuns,
      queueMetrics,
      project,
    ] = await Promise.all([
      this.evaluation.getSummary(),
      this.review.listPending(),
      this.iot.getAlerts(10),
      this.prisma.document.findMany({
        select: { id: true, processingStatus: true, docType: true },
      }),
      this.prisma.agentRun.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          agentType: true,
          latencyMs: true,
          createdAt: true,
          output: true,
        },
      }),
      this.queue.getMetrics(),
      this.prisma.project.findFirst({
        where: { id: 'proj-substation-alpha' },
        include: { _count: { select: { documents: true, iotDevices: true } } },
      }),
    ]);

    const readyDocs = documents.filter((d) => d.processingStatus === 'ready').length;
    const docsByType = documents.reduce<Record<string, number>>((acc, d) => {
      acc[d.docType] = (acc[d.docType] ?? 0) + 1;
      return acc;
    }, {});

    return {
      timestamp: new Date().toISOString(),
      retrievalBackend: this.agents.getRetrievalBackend(),
      databricksConfigured: this.runtime.isDatabricksConfigured(),
      project: project
        ? {
            id: project.id,
            name: project.name,
            status: project.status,
            documentCount: project._count.documents,
            iotDeviceCount: project._count.iotDevices,
          }
        : null,
      documents: {
        total: documents.length,
        ready: readyDocs,
        byType: docsByType,
      },
      agentRuns: {
        total: evalSummary.totalRuns,
        recent: recentRuns.map((r) => ({
          id: r.id,
          agentType: r.agentType,
          latencyMs: r.latencyMs,
          createdAt: r.createdAt.toISOString(),
          confidence: (r.output as { confidence?: number })?.confidence,
        })),
      },
      evaluations: evalSummary,
      reviews: { pending: pendingReviews.length },
      iot: { activeAlerts: iotAlerts.length, alerts: iotAlerts.slice(0, 5) },
      queues: queueMetrics,
    };
  }
}
