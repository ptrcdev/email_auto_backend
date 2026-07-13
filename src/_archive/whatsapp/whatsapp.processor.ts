import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { WHATSAPP_QUEUE } from '../queue.constants.js';
import { WhatsAppService } from '../../whatsapp/whatsapp.service.js';
import { UserRepository } from '../../repositories/user.repository.js';
import { ConfigService } from '@nestjs/config';

interface WhatsAppJobData {
  userId: string;
}

@Injectable()
export class WhatsAppProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppProcessor.name);
  private worker: Worker;

  constructor(
    private readonly whatsappService: WhatsAppService,
    private readonly userRepo: UserRepository,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const redisUrl = this.config.get<string>(
      'REDIS_URL',
      'redis://localhost:6379',
    );
    this.worker = new Worker(
      WHATSAPP_QUEUE,
      async (job: Job<WhatsAppJobData>) => {
        return this.handleJob(job);
      },
      { connection: { url: redisUrl } },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`WhatsApp job ${job?.id} failed: ${err.message}`);
    });
    this.worker.on('completed', (job) => {
      this.logger.log(`WhatsApp job ${job.id} completed`);
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  private async handleJob(
    job: Job<WhatsAppJobData>,
  ): Promise<{ success: boolean; skipped?: boolean }> {
    const { userId } = job.data;
    this.logger.log(
      `Processing WhatsApp prompt job ${job.id} for user ${userId}`,
    );

    const user = await this.userRepo.findById(userId);
    if (!user) {
      this.logger.warn(`User ${userId} not found, skipping WhatsApp prompt`);
      return { success: false, skipped: true };
    }

    if (!user.whatsappNumber || !user.whatsappOptedIn) {
      this.logger.warn(`User ${userId} not opted into WhatsApp, skipping`);
      return { success: true, skipped: true };
    }

    await this.whatsappService.sendPriorityPrompt(user);

    this.logger.log(
      `WhatsApp prompt job ${job.id} completed for user ${userId}`,
    );
    return { success: true };
  }
}
