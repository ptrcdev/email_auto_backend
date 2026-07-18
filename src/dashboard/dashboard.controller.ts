import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Logger,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service.js';

@Controller('dashboard')
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  constructor(private readonly dashboardService: DashboardService) {}

  @Post(':email/search')
  async search(@Param('email') email: string, @Body() body: { query: string }) {
    return this.dashboardService.search(email, body.query);
  }

  @Get(':email/stats')
  async getStats(@Param('email') email: string) {
    return this.dashboardService.getStats(email);
  }

  @Get(':email/daily-brief')
  async getDailyBrief(@Param('email') email: string) {
    return this.dashboardService.getDailyBrief(email);
  }

  @Get(':email/daily-briefs')
  async getDailyBriefs(
    @Param('email') email: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.dashboardService.getDailyBriefs(email, from, to);
  }

  @Get(':email/analytics')
  async getAnalytics(@Param('email') email: string) {
    return this.dashboardService.getAnalytics(email);
  }
}
