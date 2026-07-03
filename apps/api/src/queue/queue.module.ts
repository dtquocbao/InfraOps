import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { QUEUE_NAMES } from '@infraops/shared';
import { QueueService } from './queue.service';
import {
  DOCUMENT_QUEUE,
  EVALUATION_QUEUE,
  FEATURE_TEST_QUEUE,
  IOT_QUEUE,
  REDIS_CLIENT,
} from './queue.tokens';

function redisConnection(config: ConfigService) {
  const url = new URL(config.get<string>('REDIS_URL')!);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
  };
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL')!;
        return new IORedis(url, { maxRetriesPerRequest: null });
      },
    },
    {
      provide: DOCUMENT_QUEUE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Queue(QUEUE_NAMES.DOCUMENT_PROCESSING, { connection: redisConnection(config) }),
    },
    {
      provide: IOT_QUEUE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Queue(QUEUE_NAMES.IOT_PROCESSING, { connection: redisConnection(config) }),
    },
    {
      provide: EVALUATION_QUEUE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Queue(QUEUE_NAMES.EVALUATION, { connection: redisConnection(config) }),
    },
    {
      provide: FEATURE_TEST_QUEUE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Queue(QUEUE_NAMES.FEATURE_TESTS, { connection: redisConnection(config) }),
    },
    QueueService,
  ],
  exports: [REDIS_CLIENT, DOCUMENT_QUEUE, IOT_QUEUE, EVALUATION_QUEUE, FEATURE_TEST_QUEUE, QueueService],
})
export class QueueModule {}
