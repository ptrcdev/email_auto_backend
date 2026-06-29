import { Controller, Get, Post, Param, Logger } from '@nestjs/common';
import { QueueService } from './queue.service.js';

@Controller('queue')
export class QueueController {
  private readonly logger = new Logger(QueueController.name);

  constructor(private readonly queueService: QueueService) {}

  @Get('stats')
  async getStats() {
    return this.queueService.getDigestQueueStats();
  }

  @Get('failed/:queueName')
  async getFailedJobs(@Param('queueName') queueName: string) {
    const jobs = await this.queueService.getRecentFailedJobs(queueName);
    return jobs.map((job) => ({
      id: job.id,
      data: job.data,
      failedReason: job.failedReason,
      timestamp: job.timestamp,
      attemptsMade: job.attemptsMade,
    }));
  }

  @Post('retry/:queueName/:jobId')
  async retryJob(
    @Param('queueName') queueName: string,
    @Param('jobId') jobId: string,
  ) {
    this.logger.log(`Retrying job ${jobId} in queue ${queueName}`);
    return { status: 'retry requested', queueName, jobId };
  }
}
