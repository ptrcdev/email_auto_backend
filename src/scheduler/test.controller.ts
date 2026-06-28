import { Controller, Post, Param, Logger } from '@nestjs/common';
import { SchedulerService } from './scheduler.service.js';
import { UserRepository } from '../repositories/user.repository.js';

@Controller('test')
export class TestController {
  private readonly logger = new Logger(TestController.name);

  constructor(
    private readonly schedulerService: SchedulerService,
    private readonly userRepo: UserRepository,
  ) {}

  @Post('digest/:userId')
  async triggerDigest(@Param('userId') userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) return { error: 'User not found' };

    await this.schedulerService.processUserDigest(user);
    return { status: 'digest triggered', userId };
  }

  @Post('whatsapp-prompt/:userId')
  async triggerWhatsAppPrompt(@Param('userId') userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) return { error: 'User not found' };

    const { WhatsAppService } = await import('../whatsapp/whatsapp.service.js');
    return { status: 'use curl -X POST /test/digest/:userId instead' };
  }

  @Post('priority-decay')
  async triggerPriorityDecay() {
    await this.schedulerService.handlePriorityDecayManual();
    return { status: 'priority decay run' };
  }

  @Post('check-schedules')
  async triggerScheduleCheck() {
    await this.schedulerService.handleSchedules();
    return { status: 'schedule check run' };
  }
}
