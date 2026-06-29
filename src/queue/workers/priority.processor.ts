import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PRIORITY_QUEUE } from '../queue.module.js';
import { PriorityRepository } from '../../repositories/priority.repository.js';

@Processor(PRIORITY_QUEUE)
export class PriorityProcessor extends WorkerHost {
  private readonly logger = new Logger(PriorityProcessor.name);

  constructor(
    private readonly priorityRepo: PriorityRepository,
  ) {
    super();
  }

  async process(_job: Job): Promise<{ success: boolean; deactivated?: number }> {
    this.logger.log('Processing priority decay job');

    await this.priorityRepo.deactivateExpired();

    this.logger.log('Priority decay complete');
    return { success: true };
  }
}
