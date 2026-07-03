import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import {
  DOCUMENT_QUEUE,
  EVALUATION_QUEUE,
  FEATURE_TEST_QUEUE,
  IOT_QUEUE,
  REDIS_CLIENT,
} from './queue.tokens';

@Injectable()
export class QueueService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: IORedis,
    @Inject(DOCUMENT_QUEUE) private readonly documentQueue: Queue,
    @Inject(IOT_QUEUE) private readonly iotQueue: Queue,
    @Inject(EVALUATION_QUEUE) private readonly evaluationQueue: Queue,
    @Inject(FEATURE_TEST_QUEUE) private readonly featureTestQueue: Queue,
  ) {}

  async ping(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  getDocumentQueue() {
    return this.documentQueue;
  }

  getIotQueue() {
    return this.iotQueue;
  }

  getEvaluationQueue() {
    return this.evaluationQueue;
  }

  getFeatureTestQueue() {
    return this.featureTestQueue;
  }

  async getMetrics() {
    const [docCounts, iotCounts, evalCounts, featureTestCounts] = await Promise.all([
      this.documentQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
      this.iotQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
      this.evaluationQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
      this.featureTestQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
    ]);

    return {
      documentProcessing: docCounts,
      iotProcessing: iotCounts,
      evaluation: evalCounts,
      featureTests: featureTestCounts,
      timestamp: new Date().toISOString(),
    };
  }
}
