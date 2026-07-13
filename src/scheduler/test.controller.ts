import { Controller, Post, Param, Logger } from '@nestjs/common';
import { QueueService } from '../queue/queue.service.js';
import { UserRepository } from '../repositories/user.repository.js';

@Controller('test')
export class TestController {
  private readonly logger = new Logger(TestController.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly userRepo: UserRepository,
  ) {}

  @Post('digest/:userId')
  async triggerDigest(@Param('userId') userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) return { error: 'User not found' };

    const today = new Date().toISOString().split('T')[0];
    await this.queueService.enqueueDigest(userId, today);
    return { status: 'digest enqueued', userId };
  }

  // WhatsApp prompt archived — re-activate when WhatsApp integration is enabled
  // @Post('whatsapp-prompt/:userId')
  // async triggerWhatsAppPrompt(@Param('userId') userId: string) {
  //   const user = await this.userRepo.findById(userId);
  //   if (!user) return { error: 'User not found' };
  //   await this.queueService.enqueueWhatsAppPrompt(userId);
  //   return { status: 'whatsapp prompt enqueued', userId };
  // }

  @Post('priority-decay')
  async triggerPriorityDecay() {
    await this.queueService.enqueuePriorityDecay();
    return { status: 'priority decay enqueued' };
  }

  @Post('check-schedules')
  async triggerScheduleCheck() {
    this.logger.log('Manual schedule check triggered');
    return {
      status: 'manual check — use /test/digest/:userId for direct triggers',
    };
  }
}
