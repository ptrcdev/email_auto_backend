import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueService } from './queue.service.js';
import { DigestProcessor } from './workers/digest.processor.js';
import { PriorityProcessor } from './workers/priority.processor.js';
import { QueueController } from './queue.controller.js';
import { EmailModule } from '../email/email.module.js';
import { ClassificationModule } from '../classification/classification.module.js';
import { DigestModule } from '../digest/digest.module.js';
import { PrioritiesModule } from '../priorities/priorities.module.js';
import { Queue } from 'bullmq';
import { DIGEST_QUEUE, PRIORITY_QUEUE } from './queue.constants.js';

const digestQueueFactory = {
  provide: DIGEST_QUEUE,
  useFactory: (config: ConfigService) => {
    const redisUrl = config.get<string>('REDIS_URL', 'redis://localhost:6379');
    return new Queue(DIGEST_QUEUE, {
      connection: { url: redisUrl },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });
  },
  inject: [ConfigService],
};

const priorityQueueFactory = {
  provide: PRIORITY_QUEUE,
  useFactory: (config: ConfigService) => {
    const redisUrl = config.get<string>('REDIS_URL', 'redis://localhost:6379');
    return new Queue(PRIORITY_QUEUE, {
      connection: { url: redisUrl },
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: false,
      },
    });
  },
  inject: [ConfigService],
};

@Module({
  imports: [ConfigModule, EmailModule, ClassificationModule, DigestModule, PrioritiesModule],
  providers: [
    digestQueueFactory,
    priorityQueueFactory,
    QueueService,
    DigestProcessor,
    PriorityProcessor,
  ],
  controllers: [QueueController],
  exports: [QueueService],
})
export class QueueModule {}
