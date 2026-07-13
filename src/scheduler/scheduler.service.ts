import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { QueueService } from '../queue/queue.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import { PushService } from '../push/push.service.js';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private isReady = false;

  constructor(
    private readonly queueService: QueueService,
    private readonly userRepo: UserRepository,
    private readonly pushService: PushService,
  ) {}

  async onApplicationBootstrap() {
    this.logger.log('Scheduler waiting for app readiness...');
    await new Promise((r) => setTimeout(r, 3000));
    this.isReady = true;
    this.logger.log('Scheduler is now active');
  }

  @Cron('* * * * *', { name: 'check-user-schedules' })
  async handleSchedules() {
    if (!this.isReady) {
      this.logger.warn('Scheduler not ready yet — skipping tick');
      return;
    }

    const now = new Date();
    const users = await this.userRepo.findAll();
    const today = now.toISOString().split('T')[0];

    this.logger.log(
      `Schedule check running at ${now.toISOString()} (${users.length} users)`,
    );

    for (const user of users) {
      try {
        const userTime = this.getUserLocalTime(user.timezone);
        const [digestHour, digestMin] = user.digestTime.split(':').map(Number);

        if (userTime.hours === digestHour && userTime.minutes === digestMin) {
          this.logger.log(`Enqueuing digest for ${user.email}`);
          await this.queueService.enqueueDigest(user.id, today);
        }

        if (user.reminderEnabled) {
          const [reminderHour, reminderMin] = user.reminderTime
            .split(':')
            .map(Number);
          if (
            userTime.hours === reminderHour &&
            userTime.minutes === reminderMin
          ) {
            this.logger.log(`Sending priority reminder push to ${user.email}`);
            await this.pushService.sendPush(
              user.email,
              'AMICUS',
              'Time to set your priorities for tomorrow.',
              '/prompt',
            );
          }
        }
      } catch (error) {
        this.logger.error(`Schedule check failed for user ${user.id}:`, error);
      }
    }
  }

  @Cron('0 0 * * *', { name: 'deactivate-expired-priorities' })
  async handlePriorityDecay() {
    if (!this.isReady) {
      this.logger.warn('Scheduler not ready yet — skipping tick');
      return;
    }

    this.logger.log('Enqueuing priority decay job');
    await this.queueService.enqueuePriorityDecay();
  }

  private getUserLocalTime(timezone: string): {
    hours: number;
    minutes: number;
    dayOfWeek: number;
  } {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
      weekday: 'short',
      timeZone: timezone,
    });

    const parts = formatter.formatToParts(now);
    const hours = parseInt(parts.find((p) => p.type === 'hour')?.value || '0');
    const minutes = parseInt(
      parts.find((p) => p.type === 'minute')?.value || '0',
    );

    const dayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    const dayStr = parts.find((p) => p.type === 'weekday')?.value || 'Mon';
    const dayOfWeek = dayMap[dayStr] ?? 1;

    return { hours, minutes, dayOfWeek };
  }
}
