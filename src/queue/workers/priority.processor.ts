import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { PRIORITY_QUEUE } from '../queue.constants.js';
import { PriorityRepository } from '../../repositories/priority.repository.js';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PriorityProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PriorityProcessor.name);
  private worker: Worker;

  constructor(
    private readonly priorityRepo: PriorityRepository,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const redisUrl = this.config.get<string>(
      'REDIS_URL',
      'redis://localhost:6379',
    );
    this.worker = new Worker(
      PRIORITY_QUEUE,
      async (_job: Job) => {
        return this.handleJob();
      },
      { connection: { url: redisUrl } },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Priority decay job ${job?.id} failed: ${err.message}`);
    });
    this.worker.on('completed', (job) => {
      this.logger.log(`Priority decay job ${job.id} completed`);
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  private async handleJob(): Promise<{ success: boolean }> {
    this.logger.log('Processing priority decay job');

    await this.priorityRepo.deactivateExpired();

    this.logger.log('Priority decay complete');
    return { success: true };
  }
}
