import { Controller, Delete, Get, Put, Body, Param, Logger } from '@nestjs/common';
import { UsersService } from './users.service.js';

@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  @Get(':email/onboarding-status')
  async getOnboardingStatus(@Param('email') email: string) {
    return this.usersService.getOnboardingStatus(email);
  }

  @Put(':email/onboarding')
  async updateOnboarding(
    @Param('email') email: string,
    @Body()
    body: {
      name?: string;
      preferredName?: string;
      role?: string;
      addressStyle?: string;
      digestTime?: string;
      reminderTime?: string;
      reminderEnabled?: boolean;
      timezone?: string;
      importantSenders?: string[];
    },
  ) {
    return this.usersService.updateOnboarding(email, body);
  }

  @Get(':email/settings')
  async getSettings(@Param('email') email: string) {
    return this.usersService.getSettings(email);
  }

  @Put(':email/settings')
  async updateSettings(
    @Param('email') email: string,
    @Body()
    body: {
      name?: string;
      preferredName?: string;
      role?: string;
      addressStyle?: string;
      digestTime?: string;
      reminderTime?: string;
      reminderEnabled?: boolean;
      timezone?: string;
      importantSenders?: string[];
    },
  ) {
    return this.usersService.updateSettings(email, body);
  }

  @Delete(':email')
  async deleteAccount(@Param('email') email: string) {
    return this.usersService.deleteAccount(email);
  }
}
