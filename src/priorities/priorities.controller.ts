import { Controller, Get, Post, Body, Param, Logger } from '@nestjs/common';
import { PrioritiesService } from './priorities.service.js';

@Controller('priorities')
export class PrioritiesController {
  private readonly logger = new Logger(PrioritiesController.name);

  constructor(private readonly prioritiesService: PrioritiesService) {}

  @Get(':email')
  async getActivePriorities(@Param('email') email: string) {
    return this.prioritiesService.getActivePriorities(email);
  }

  @Post(':email')
  async savePriorities(
    @Param('email') email: string,
    @Body() body: { priorities: string[] },
  ) {
    const result = await this.prioritiesService.savePriorities(
      email,
      body.priorities,
    );
    if (!result) {
      return { error: 'User not found' };
    }
    return { status: 'ok', count: result.length };
  }
}
