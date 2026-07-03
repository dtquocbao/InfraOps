import { Injectable } from '@nestjs/common';
import { AgentType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { clearanceForRole, classifyQueryIntent, type RagQueryRequest, type UserRole } from '@infraops/shared';
import { runRagPipeline } from '@infraops/ai-tools';
import { PrismaService } from '../prisma/prisma.module';
import { ReviewService } from '../review/review.service';
import { QueueService } from '../queue/queue.service';
import { RuntimeConfigService } from '../settings/runtime-config.service';

@Injectable()
export class AgentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviewService: ReviewService,
    private readonly queueService: QueueService,
    private readonly runtime: RuntimeConfigService,
  ) {}

  getRetrievalBackend() {
    return this.runtime.getRetrievalBackend();
  }

  async ragQuery(userId: string, role: UserRole, input: RagQueryRequest) {
    const traceId = uuidv4();
    const start = Date.now();
    const retrievalBackend = this.runtime.getRetrievalBackend();

    const embedder = this.runtime.createEmbedder();
    const llm = this.runtime.createLlm();
    const retriever = this.runtime.createRetriever();

    const queryEmbedding = await embedder.embed(input.question);
    const securityLevels = clearanceForRole(role);
    const intentProfile = classifyQueryIntent(input.question);

    const chunks = await retriever.search(input.question, queryEmbedding, {
      projectId: input.projectId,
      discipline: input.discipline ?? intentProfile.discipline,
      docType: input.docType,
      securityLevels,
      intentProfile,
    });

    const result = await runRagPipeline(llm, {
      question: input.question,
      chunks,
    });

    const latencyMs = Date.now() - start;

    const agentRun = await this.prisma.agentRun.create({
      data: {
        userId,
        agentType: AgentType.rag,
        input: input as object,
        output: {
          answer: result.answer,
          confidence: result.confidence,
          retrievalBackend,
          detectedIntent: {
            intent: intentProfile.intent,
            label: intentProfile.label,
            confidence: intentProfile.confidence,
          },
        },
        citations: result.citations as object[],
        traceId,
        latencyMs,
        tokenCount: result.tokenCount,
      },
    });

    await this.queueService.getEvaluationQueue().add(
      'evaluate_response',
      {
        agentRunId: agentRun.id,
        question: input.question,
        answer: result.answer,
        citations: result.citations,
        chunks: chunks.map((c) => ({
          chunkId: c.chunkId,
          content: c.content,
          score: c.score,
        })),
        latencyMs,
        retrievalBackend,
      },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
    );

    const review = await this.reviewService.createIfRequired(agentRun.id, {
      agentType: 'rag',
      question: input.question,
      answer: result.answer,
      confidence: result.confidence,
      citations: chunks.map((c) => ({ docType: c.docType, title: c.title })),
    });

    return {
      answer: result.answer,
      citations: result.citations,
      agentRunId: agentRun.id,
      traceId,
      confidence: result.confidence,
      retrievalBackend,
      detectedIntent: {
        intent: intentProfile.intent,
        label: intentProfile.label,
        confidence: intentProfile.confidence,
      },
      reviewRequired: !!review,
      reviewId: review?.id,
    };
  }

  async getRun(id: string) {
    const run = await this.prisma.agentRun.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, name: true, role: true } },
        reviews: true,
        evaluations: true,
      },
    });
    if (!run) return null;
    return {
      id: run.id,
      agentType: run.agentType,
      input: run.input,
      output: run.output,
      citations: run.citations,
      toolCalls: run.toolCalls,
      traceId: run.traceId,
      latencyMs: run.latencyMs,
      tokenCount: run.tokenCount,
      costUsd: run.costUsd,
      createdAt: run.createdAt.toISOString(),
      user: run.user,
      reviews: run.reviews,
      evaluations: run.evaluations,
    };
  }

  async listRuns(limit = 20) {
    const runs = await this.prisma.agentRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        agentType: true,
        traceId: true,
        latencyMs: true,
        createdAt: true,
        output: true,
      },
    });
    return runs;
  }
}
