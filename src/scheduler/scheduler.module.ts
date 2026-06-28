import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service.js';
import { TestController } from './test.controller.js';
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

@Module({
  imports: [
    EmailModule,
    ClassificationModule,
    DigestModule,
    WhatsAppModule,
    TypeOrmModule.forFeature([User, EmailRecord, Priority]),
  ],
  providers: [
    SchedulerService,
    UserRepository,
    EmailRecordRepository,
    PriorityRepository,
  ],
  controllers: [TestController],
  exports: [SchedulerService],
})
export class SchedulerModule {}
