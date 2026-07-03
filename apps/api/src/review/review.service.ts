import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ReviewStatus } from '@prisma/client';
import { shouldRequireReview, type ReviewDecideRequest, type ReviewTriggerContext } from '@infraops/shared';
import { PrismaService } from '../prisma/prisma.module';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  evaluateTriggers(ctx: ReviewTriggerContext) {
    return shouldRequireReview(ctx);
  }

  async createIfRequired(agentRunId: string, ctx: ReviewTriggerContext) {
    const { required, reasons } = shouldRequireReview(ctx);
    if (!required) return null;

    const existing = await this.prisma.review.findFirst({
      where: { agentRunId, status: { in: [ReviewStatus.pending_review, ReviewStatus.draft] } },
    });
    if (existing) return existing;

    const review = await this.prisma.review.create({
      data: {
        agentRunId,
        status: ReviewStatus.pending_review,
        comments: `Auto-flagged: ${reasons.join(', ')}`,
      },
    });

    await this.audit.log({
      action: 'review_created',
      resourceType: 'review',
      resourceId: review.id,
      metadata: {
        summary: 'System queued an agent response for human review',
        method: 'system.review_rules',
        agentRunId,
        reasons,
        changes: [
          {
            field: 'review.status',
            label: 'Review status',
            before: '(none)',
            after: 'pending_review',
          },
        ],
      },
    });

    return review;
  }

  async listPending() {
    const reviews = await this.prisma.review.findMany({
      where: { status: ReviewStatus.pending_review },
      orderBy: { id: 'desc' },
      include: {
        agentRun: {
          include: { user: { select: { id: true, name: true, email: true, role: true } } },
        },
      },
    });

    return reviews.map((r) => ({
      id: r.id,
      status: r.status,
      comments: r.comments,
      agentRun: {
        id: r.agentRun.id,
        agentType: r.agentRun.agentType,
        input: r.agentRun.input,
        output: r.agentRun.output,
        citations: r.agentRun.citations,
        traceId: r.agentRun.traceId,
        createdAt: r.agentRun.createdAt.toISOString(),
        user: r.agentRun.user,
      },
    }));
  }

  async decide(reviewerId: string, runId: string, body: ReviewDecideRequest) {
    const agentRun = await this.prisma.agentRun.findUnique({ where: { id: runId } });
    if (!agentRun) throw new NotFoundException('Agent run not found');

    let review = await this.prisma.review.findFirst({
      where: { agentRunId: runId },
      orderBy: { id: 'desc' },
    });

    if (!review) {
      review = await this.prisma.review.create({
        data: { agentRunId: runId, status: ReviewStatus.pending_review },
      });
    }

    if (review.status !== ReviewStatus.pending_review && review.status !== ReviewStatus.draft) {
      throw new BadRequestException(`Review already decided: ${review.status}`);
    }

    const finalStatus =
      body.decision === 'approved' ? ReviewStatus.published : ReviewStatus.draft;

    const [reviewer, evaluation] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: reviewerId }, select: { name: true } }),
      this.prisma.evaluation.findFirst({
        where: { agentRunId: runId },
        orderBy: { evaluatedAt: 'desc' },
      }),
    ]);

    const updated = await this.prisma.review.update({
      where: { id: review.id },
      data: {
        reviewerId,
        status: finalStatus,
        comments: body.comments ?? review.comments,
        decidedAt: new Date(),
      },
    });

    await this.audit.log({
      userId: reviewerId,
      action: `review_${body.decision}`,
      resourceType: 'review',
      resourceId: review.id,
      metadata: {
        summary: `${reviewer?.name ?? 'Reviewer'} ${body.decision} a flagged agent response`,
        method: 'human_review.decide',
        agentRunId: runId,
        comments: body.comments,
        changes: [
          {
            field: 'review.status',
            label: 'Review status',
            before: review.status,
            after: finalStatus,
          },
          {
            field: 'evaluation.user_rating',
            label: 'User feedback rating',
            before: evaluation?.userRating?.toString() ?? '(none)',
            after: body.decision === 'approved' ? '1' : '-1',
          },
        ],
      },
    });

    if (evaluation) {
      await this.prisma.evaluation.update({
        where: { id: evaluation.id },
        data: {
          userRating: body.decision === 'approved' ? 1 : -1,
        },
      });
    } else {
      await this.prisma.evaluation.create({
        data: {
          agentRunId: runId,
          userRating: body.decision === 'approved' ? 1 : -1,
          groundedness: body.decision === 'approved' ? 0.8 : 0.3,
        },
      });
    }

    return {
      id: updated.id,
      status: finalStatus,
      decidedAt: updated.decidedAt?.toISOString(),
    };
  }
}
