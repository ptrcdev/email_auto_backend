import { Controller, Get, Param, Query, Res, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { CalendarService } from './calendar.service.js';
import { UserRepository } from '../repositories/user.repository.js';

@Controller('calendar')
export class CalendarController {
  private readonly logger = new Logger(CalendarController.name);

  constructor(
    private readonly calendarService: CalendarService,
    private readonly userRepo: UserRepository,
  ) {}

  @Get('connect/:userId')
  async connectCalendar(@Param('userId') userId: string, @Res() res: Response) {
    // Frontend may pass an email address instead of a UUID — resolve to UUID first
    let resolvedId = userId;
    if (userId.includes('@')) {
      const user = await this.userRepo.findByEmail(userId);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      resolvedId = user.id;
    }
    const url = this.calendarService.getCalendarAuthUrl(resolvedId);
    res.redirect(url);
  }

  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    try {
      const userId = state.replace('calendar:', '');
      await this.calendarService.handleCalendarCallback(code, userId);
      const user = await this.userRepo.findById(userId);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(
        `${frontendUrl}/settings?email=${encodeURIComponent(user?.email || '')}&calendar=connected`,
      );
    } catch (error) {
      this.logger.error('Calendar callback failed:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/settings?calendar=error`);
    }
  }

  @Get('ics/:email')
  async downloadIcs(@Param('email') email: string, @Res() res: Response) {
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const icsContent = this.calendarService.generateIcsContent({
      email: user.email,
      reminderTime: user.reminderTime,
      timezone: user.timezone,
    });

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="amicus-daily-reminder.ics"`,
    );
    res.send(icsContent);
  }
}
