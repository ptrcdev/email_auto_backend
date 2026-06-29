import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueService } from './queue.service.js';
import { DigestProcessor } from './workers/digest.processor.js';
import { WhatsAppProcessor } from './workers/whatsapp.processor.js';
import { PriorityProcessor } from './workers/priority.processor.js';
import { QueueController } from './queue.controller.js';
import { EmailModule } from '../email/email.module.js';
import { ClassificationModule } from '../classification/classification.module.js';
import { DigestModule } from '../digest/digest.module.js';
import { WhatsAppModule } from '../whatsapp/whatsapp.module.js';
import { UserRepository } from '../repositories/user.repository.js';
import { EmailRecordRepository } from '../repositories/email-record.repository.js';
import { PriorityRepository } from '../repositories/priority.repository.js';
import { User } from '../entities/user.entity.js';
import { EmailRecord } from '../entities/email-record.entity.js';
import { Priority } from '../entities/priority.entity.js';
import { TypeOrmModule } from '@nestjs/typeorm';

export const DIGEST_QUEUE = 'digest-daily';
export const WHATSAPP_QUEUE = 'whatsapp-prompt';
export const PRIORITY_QUEUE = 'priority-decay';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL', 'redis://localhost:6379');
        return { connection: { url: redisUrl } };
      },
    }),
    BullModule.registerQueue(
      { name: DIGEST_QUEUE, defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true, removeOnFail: false } },
      { name: WHATSAPP_QUEUE, defaultJobOptions: { attempts: 2, backoff: { type: 'fixed', delay: 30000 }, removeOnComplete: true, removeOnFail: false } },
      { name: PRIORITY_QUEUE, defaultJobOptions: { attempts: 1, removeOnComplete: true, removeOnFail: false } },
    ),
    EmailModule,
    ClassificationModule,
    DigestModule,
    WhatsAppModule,
    TypeOrmModule.forFeature([User, EmailRecord, Priority]),
  ],
  providers: [
    QueueService,
    DigestProcessor,
    WhatsAppProcessor,
    PriorityProcessor,
    UserRepository,
    EmailRecordRepository,
    PriorityRepository,
  ],
  controllers: [QueueController],
  exports: [QueueService],
})
export class QueueModule {}
