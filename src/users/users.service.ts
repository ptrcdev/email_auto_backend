import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { UserRepository } from '../repositories/user.repository.js';
import { CalendarService } from '../calendar/calendar.service.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailRecord } from '../entities/email-record.entity.js';
import { Digest } from '../entities/digest.entity.js';
import { Priority } from '../entities/priority.entity.js';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly userRepo: UserRepository,
    private readonly calendarService: CalendarService,
    @InjectRepository(EmailRecord)
    private readonly emailRecordRepo: Repository<EmailRecord>,
    @InjectRepository(Digest)
    private readonly digestRepo: Repository<Digest>,
    @InjectRepository(Priority)
    private readonly priorityRepo: Repository<Priority>,
  ) {}

  private async syncCalendarIfNeeded(
    user: {
      id: string;
      calendarConnected: boolean;
      reminderTime: string;
      timezone: string;
    },
    data: { reminderTime?: string; timezone?: string },
  ) {
    if (!user.calendarConnected) {
      return;
    }
    const reminderChanged =
      data.reminderTime !== undefined &&
      data.reminderTime !== user.reminderTime;
    const timezoneChanged =
      data.timezone !== undefined && data.timezone !== user.timezone;
    if (!reminderChanged && !timezoneChanged) {
      return;
    }
    try {
      await this.calendarService.syncDailyReminderForUser(user.id);
    } catch (error) {
      this.logger.error(
        `Failed to sync calendar reminder for user ${user.id}:`,
        error,
      );
    }
  }

  async getOnboardingStatus(email: string): Promise<{ isNew: boolean }> {
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      return { isNew: true };
    }
    const diff = user.updatedAt.getTime() - user.createdAt.getTime();
    const isNew = diff < 5000;
    return { isNew };
  }

  async updateOnboarding(
    email: string,
    data: {
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
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.userRepo.update(user.id, data);
    await this.syncCalendarIfNeeded(user, data);
    this.logger.log(`Onboarding preferences saved for user ${email}`);
    return { status: 'ok' };
  }

  async getSettings(email: string) {
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      userId: user.id,
      name: user.name,
      preferredName: user.preferredName,
      role: user.role,
      addressStyle: user.addressStyle,
      digestTime: user.digestTime,
      reminderTime: user.reminderTime,
      reminderEnabled: user.reminderEnabled,
      timezone: user.timezone,
      calendarConnected: user.calendarConnected,
      pushSubscription: user.pushSubscription,
      importantSenders: user.importantSenders || [],
    };
  }

  async updateSettings(
    email: string,
    data: {
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
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.userRepo.update(user.id, data);
    await this.syncCalendarIfNeeded(user, data);
    this.logger.log(`Settings saved for user ${email}`);
    return { status: 'ok' };
  }

  async deleteAccount(email: string): Promise<{ status: 'ok' }> {
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.emailRecordRepo.delete({ userId: user.id });
    await this.digestRepo.delete({ userId: user.id });
    await this.priorityRepo.delete({ userId: user.id });
    await this.userRepo.delete(user.id);

    this.logger.log(`Account deleted for user ${email}`);
    return { status: 'ok' };
  }
}
