import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Logger,
} from '@nestjs/common';
import { PrioritiesService } from './priorities.service.js';

@Controller('priorities')
export class PrioritiesController {
  private readonly logger = new Logger(PrioritiesController.name);

  constructor(private readonly prioritiesService: PrioritiesService) {}

  @Get(':email')
  async getActivePriorities(@Param('email') email: string) {
    return this.prioritiesService.getActivePriorities(email);
  }

  @Get(':email/daily')
  async getDailyPriorities(@Param('email') email: string) {
    return this.prioritiesService.getDailyPriorities(email);
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

  @Get(':email/permanent')
  async getPermanentPriorities(@Param('email') email: string) {
    return this.prioritiesService.getPermanentPriorities(email);
  }

  @Post(':email/permanent')
  async addPermanentPriority(
    @Param('email') email: string,
    @Body() body: { rawText: string },
  ) {
    const result = await this.prioritiesService.addPermanentPriority(
      email,
      body.rawText,
    );
    if (!result) {
      return { error: 'User not found or empty priority' };
    }
    return { status: 'ok', priority: result };
  }

  @Put(':email/permanent/:id')
  async updatePermanentPriority(
    @Param('email') email: string,
    @Param('id') id: string,
    @Body() body: { rawText: string },
  ) {
    const result = await this.prioritiesService.updatePermanentPriority(
      email,
      id,
      body.rawText,
    );
    if (!result) {
      return { error: 'Priority not found' };
    }
    return { status: 'ok', priority: result };
  }

  @Delete(':email/permanent/:id')
  async deletePermanentPriority(
    @Param('email') email: string,
    @Param('id') id: string,
  ) {
    const result = await this.prioritiesService.deletePermanentPriority(
      email,
      id,
    );
    if (!result) {
      return { error: 'User not found' };
    }
    return { status: 'ok' };
  }

  @Delete(':email/:id')
  async deletePriority(@Param('email') email: string, @Param('id') id: string) {
    const result = await this.prioritiesService.deletePriority(email, id);
    if (!result) {
      return { error: 'User not found' };
    }
    return { status: 'ok' };
  }
}
