import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { DIGEST_QUEUE } from '../queue.constants.js';
import { EmailService } from '../../email/email.service.js';
import { ClassificationService } from '../../classification/classification.service.js';
import { DigestSenderService } from '../../digest/digest-sender.service.js';
import { UserRepository } from '../../repositories/user.repository.js';
import { EmailRecordRepository } from '../../repositories/email-record.repository.js';
import { PriorityRepository } from '../../repositories/priority.repository.js';
import { EmailRecord } from '../../entities/email-record.entity.js';
import { ConfigService } from '@nestjs/config';

interface DigestJobData {
  userId: string;
  date: string;
}

@Injectable()
export class DigestProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DigestProcessor.name);
  private worker: Worker;

  constructor(
    private readonly emailService: EmailService,
    private readonly classificationService: ClassificationService,
    private readonly digestSenderService: DigestSenderService,
    private readonly userRepo: UserRepository,
    private readonly emailRecordRepo: EmailRecordRepository,
    private readonly priorityRepo: PriorityRepository,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const redisUrl = this.config.get<string>(
      'REDIS_URL',
      'redis://localhost:6379',
    );
    this.worker = new Worker(
      DIGEST_QUEUE,
      async (job: Job<DigestJobData>) => {
        return this.handleJob(job);
      },
      { connection: { url: redisUrl } },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Digest job ${job?.id} failed: ${err.message}`);
    });
    this.worker.on('completed', (job) => {
      this.logger.log(`Digest job ${job.id} completed`);
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  private async handleJob(
    job: Job<DigestJobData>,
  ): Promise<{ success: boolean; skipped?: boolean; emailCount?: number }> {
    const { userId, date } = job.data;
    this.logger.log(
      `Processing digest job ${job.id} for user ${userId} (${date})`,
    );

    const user = await this.userRepo.findById(userId);
    if (!user) {
      this.logger.warn(`User ${userId} not found, skipping digest`);
      return { success: false, skipped: true };
    }

    const rawEmails = await this.emailService.fetchNewEmails(user);
    if (rawEmails.length === 0) {
      this.logger.log(`No new emails for user ${userId}, skipping digest`);
      return { success: true, skipped: true };
    }

    await this.emailService.saveEmailRecords(userId, rawEmails);

    const activePriorities = await this.priorityRepo.findActiveForUser(userId);

    const classifications = await this.classificationService.classifyEmails(
      rawEmails,
      activePriorities,
      user.importantSenders || [],
    );

    const emailRecords: EmailRecord[] = [];
    for (const raw of rawEmails) {
      const classification = classifications.get(raw.id);
      if (!classification) continue;

      const record = await this.emailRecordRepo.create({
        userId,
        gmailMessageId: raw.id,
        subject: raw.subject,
        sender: raw.sender,
        bodyPreview: raw.bodyPreview,
        receivedAt: raw.receivedAt,
        category: classification.category,
        summary: classification.summary,
        suggestedAction: classification.suggestedAction,
        extractedFields: classification.extractedFields,
      });
      emailRecords.push(record);
    }

    await this.digestSenderService.sendDigest(user, emailRecords);

    this.logger.log(
      `Digest job ${job.id} completed for user ${userId} (${emailRecords.length} emails)`,
    );
    return { success: true, emailCount: emailRecords.length };
  }
}
