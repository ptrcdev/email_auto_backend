import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { UserRepository } from '../repositories/user.repository.js';

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly userRepo: UserRepository,
  ) {}

  private get calendarRedirectUri(): string {
    return (
      this.configService.get<string>('GOOGLE_CALENDAR_REDIRECT_URI') ||
      this.configService.get<string>('GOOGLE_REDIRECT_URI')!
    );
  }

  getCalendarAuthUrl(userId: string): string {
    const oauth2Client = new google.auth.OAuth2(
      this.configService.get('GOOGLE_CLIENT_ID'),
      this.configService.get('GOOGLE_CLIENT_SECRET'),
      this.calendarRedirectUri,
    );

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar.events'],
      prompt: 'consent',
      state: `calendar:${userId}`,
    });
  }

  async handleCalendarCallback(code: string, userId: string): Promise<void> {
    const oauth2Client = new google.auth.OAuth2(
      this.configService.get('GOOGLE_CLIENT_ID'),
      this.configService.get('GOOGLE_CLIENT_SECRET'),
      this.calendarRedirectUri,
    );

    const { tokens } = await oauth2Client.getToken(code);

    await this.userRepo.update(userId, {
      googleAccessToken: tokens.access_token!,
      googleRefreshToken: tokens.refresh_token || undefined,
      googleTokenExpiry: new Date(tokens.expiry_date!),
      calendarConnected: true,
    });

    this.logger.log(`Calendar connected for user ${userId}`);

    // Create the daily reminder event immediately after connecting
    const user = await this.userRepo.findById(userId);
    if (user) {
      await this.createDailyReminder({
        id: user.id,
        email: user.email,
        reminderTime: user.reminderTime,
        timezone: user.timezone,
        googleAccessToken: tokens.access_token!,
        googleRefreshToken: tokens.refresh_token || user.googleRefreshToken,
      });
    }
  }

  async createDailyReminder(user: {
    id: string;
    email: string;
    reminderTime: string;
    timezone: string;
    googleAccessToken: string;
    googleRefreshToken: string;
  }): Promise<void> {
    const oauth2Client = new google.auth.OAuth2(
      this.configService.get('GOOGLE_CLIENT_ID'),
      this.configService.get('GOOGLE_CLIENT_SECRET'),
      this.configService.get('GOOGLE_REDIRECT_URI'),
    );

    oauth2Client.setCredentials({
      access_token: user.googleAccessToken,
      refresh_token: user.googleRefreshToken,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const [hours, minutes] = (user.reminderTime || '18:00').split(':').map(Number);
    const startDateTime = this.getNextDateTimeISO(hours, minutes);
    const endDateTime = this.getNextDateTimeISO(hours, minutes + 15);

    const event = {
      summary: "Set tomorrow's priorities",
      description:
        'Open AMICUS to set your priorities for tomorrow: ' +
        this.configService.get('FRONTEND_URL', 'http://localhost:5173') +
        '/prompt?email=' +
        encodeURIComponent(user.email),
      recurrence: ['RRULE:FREQ=DAILY'],
      start: {
        dateTime: startDateTime,
        timeZone: user.timezone,
      },
      end: {
        dateTime: endDateTime,
        timeZone: user.timezone,
      },
      reminders: {
        useDefault: false,
        overrides: [{ method: 'popup', minutes: 0 }],
      },
    };

    try {
      await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
      });
      this.logger.log(`Daily reminder created for user ${user.email}`);
    } catch (error) {
      this.logger.error(
        `Failed to create calendar event for ${user.email}:`,
        error,
      );
    }
  }

  generateIcsContent(user: {
    email: string;
    reminderTime: string;
    timezone: string;
  }): string {
    const [hours, minutes] = user.reminderTime.split(':').map(Number);
    const icsLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//AMICUS//Daily Priority Reminder//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `DTSTART;TZID=${user.timezone}:${this.getNextDateICS()}T${String(hours).padStart(2, '0')}${String(minutes).padStart(2, '0')}00`,
      `DTEND;TZID=${user.timezone}:${this.getNextDateICS()}T${String(hours).padStart(2, '0')}${String(minutes + 15).padStart(2, '0')}00`,
      'RRULE:FREQ=DAILY',
      "SUMMARY:Set tomorrow's priorities",
      `DESCRIPTION:Open AMICUS to set your priorities for tomorrow`,
      `URL:${this.configService.get('FRONTEND_URL', 'http://localhost:5173')}/prompt?email=${encodeURIComponent(user.email)}`,
      'STATUS:CONFIRMED',
      `UID:${user.email}-daily-priority@amicus`,
      'END:VEVENT',
      'END:VCALENDAR',
    ];
    return icsLines.join('\r\n');
  }

  private getNextDate(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }

  private getNextDateTimeISO(hours: number, minutes: number): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = tomorrow.toISOString().split('T')[0];
    const h = String(hours).padStart(2, '0');
    const m = String(minutes % 60).padStart(2, '0');
    return `${date}T${h}:${m}:00`;
  }

  private getNextDateICS(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0].replace(/-/g, '');
  }
}
