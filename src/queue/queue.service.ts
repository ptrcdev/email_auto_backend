import { Injectable, Logger, Inject } from '@nestjs/common';
import { Queue } from 'bullmq';
import { DIGEST_QUEUE, WHATSAPP_QUEUE, PRIORITY_QUEUE } from './queue.constants.js';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @Inject(DIGEST_QUEUE) private readonly digestQueue: Queue,
    @Inject(WHATSAPP_QUEUE) private readonly whatsappQueue: Queue,
    @Inject(PRIORITY_QUEUE) private readonly priorityQueue: Queue,
  ) {}

  async enqueueDigest(userId: string, date: string): Promise<void> {
    const jobId = `digest-${userId}-${date}`;
    const job = await this.digestQueue.add('process', { userId, date }, { jobId });
    this.logger.log(`Enqueued digest job ${job.id} for user ${userId} (${date})`);
  }

  async enqueueWhatsAppPrompt(userId: string): Promise<void> {
    const jobId = `whatsapp-${userId}-${new Date().toISOString().split('T')[0]}`;
    const job = await this.whatsappQueue.add('prompt', { userId }, { jobId });
    this.logger.log(`Enqueued WhatsApp prompt job ${job.id} for user ${userId}`);
  }

  async enqueuePriorityDecay(): Promise<void> {
    const jobId = `priority-decay-${new Date().toISOString().split('T')[0]}`;
    const job = await this.priorityQueue.add('decay', {}, { jobId });
    this.logger.log(`Enqueued priority decay job ${job.id}`);
  }

  async getDigestQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.digestQueue.getWaitingCount(),
      this.digestQueue.getActiveCount(),
      this.digestQueue.getCompletedCount(),
      this.digestQueue.getFailedCount(),
      this.digestQueue.getDelayedCount(),
    ]);
    return { waiting, active, completed, failed, delayed };
  }

  async getRecentFailedJobs(queueName: string, start = 0, end = 10) {
    const queue = this.getQueueByName(queueName);
    if (!queue) return [];
    return queue.getJobs(['failed'], start, end);
  }

  private getQueueByName(name: string): Queue | undefined {
    switch (name) {
      case DIGEST_QUEUE: return this.digestQueue;
      case WHATSAPP_QUEUE: return this.whatsappQueue;
      case PRIORITY_QUEUE: return this.priorityQueue;
      default: return undefined;
    }
  }
}
