import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';

@Injectable()
export class EvaluationService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const [evaluations, runs, withHallucination] = await Promise.all([
      this.prisma.evaluation.findMany(),
      this.prisma.agentRun.count(),
      this.prisma.evaluation.count({ where: { hallucinationFlag: true } }),
    ]);

    const avg = (vals: (number | null)[]) => {
      const nums = vals.filter((v): v is number => v !== null);
      return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
    };

    const latencyRuns = await this.prisma.agentRun.findMany({
      where: { latencyMs: { not: null } },
      select: { latencyMs: true },
    });

    const retrievalHits = evaluations.filter((e) => (e.groundedness ?? 0) > 0).length;

    return {
      totalRuns: runs,
      totalEvaluations: evaluations.length,
      avgGroundedness: avg(evaluations.map((e) => e.groundedness)),
      avgCitationAccuracy: avg(evaluations.map((e) => e.citationAccuracy)),
      avgRelevance: avg(evaluations.map((e) => e.relevance)),
      hallucinationRate: evaluations.length ? withHallucination / evaluations.length : 0,
      avgLatencyMs: avg(latencyRuns.map((r) => r.latencyMs)),
      retrievalHitRate: evaluations.length ? retrievalHits / evaluations.length : 0,
      positiveRatings: evaluations.filter((e) => e.userRating === 1).length,
      negativeRatings: evaluations.filter((e) => e.userRating === -1).length,
    };
  }
}
