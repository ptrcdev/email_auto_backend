import { Controller, Put, Body, Param, Get, Logger } from '@nestjs/common';
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
      whatsappNumber?: string;
      whatsappOptedIn?: boolean;
      digestTime?: string;
      whatsappPromptTime?: string;
      timezone?: string;
    },
  ) {
    return this.usersService.updateOnboarding(email, body);
  }
}
