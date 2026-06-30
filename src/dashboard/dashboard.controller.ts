import { Controller, Get, Post, Param, Query, Body, Logger } from '@nestjs/common';
import { DashboardService } from './dashboard.service.js';

@Controller('dashboard')
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  constructor(private readonly dashboardService: DashboardService) {}

  @Get(':email/emails')
  async getEmails(
    @Param('email') email: string,
    @Query('days') days?: string,
  ) {
    const numDays = days ? parseInt(days, 10) : 30;
    return this.dashboardService.getEmails_groupedByDay(email, numDays);
  }

  @Post(':email/search')
  async search(
    @Param('email') email: string,
    @Body() body: { query: string },
  ) {
    return this.dashboardService.search(email, body.query);
  }

  @Get(':email/stats')
  async getStats(@Param('email') email: string) {
    return this.dashboardService.getStats(email);
  }
}
