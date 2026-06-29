import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { WHATSAPP_QUEUE } from '../queue.module.js';
import { WhatsAppService } from '../../whatsapp/whatsapp.service.js';
import { UserRepository } from '../../repositories/user.repository.js';

interface WhatsAppJobData {
  userId: string;
}

@Processor(WHATSAPP_QUEUE)
export class WhatsAppProcessor extends WorkerHost {
  private readonly logger = new Logger(WhatsAppProcessor.name);

  constructor(
    private readonly whatsappService: WhatsAppService,
    private readonly userRepo: UserRepository,
  ) {
    super();
  }

  async process(job: Job<WhatsAppJobData>): Promise<{ success: boolean; skipped?: boolean }> {
    const { userId } = job.data;
    this.logger.log(`Processing WhatsApp prompt job ${job.id} for user ${userId}`);

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

    this.logger.log(`WhatsApp prompt job ${job.id} completed for user ${userId}`);
    return { success: true };
  }
}
