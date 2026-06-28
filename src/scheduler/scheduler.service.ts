import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EmailService } from '../email/email.service.js';
import { ClassificationService } from '../classification/classification.service.js';
import { DigestSenderService } from '../digest/digest-sender.service.js';
import { WhatsAppService } from '../whatsapp/whatsapp.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import { EmailRecordRepository } from '../repositories/email-record.repository.js';
import { PriorityRepository } from '../repositories/priority.repository.js';
import { User } from '../entities/user.entity.js';
import { EmailRecord } from '../entities/email-record.entity.js';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly classificationService: ClassificationService,
    private readonly digestSenderService: DigestSenderService,
    private readonly whatsappService: WhatsAppService,
    private readonly userRepo: UserRepository,
    private readonly emailRecordRepo: EmailRecordRepository,
    private readonly priorityRepo: PriorityRepository,
  ) { }

  @Cron('* * * * *', { name: 'check-user-schedules' })
  async handleSchedules() {
    const now = new Date();
    const users = await this.userRepo.findAll();

    this.logger.log(`Schedule check running at ${now.toISOString()}`);

    for (const user of users) {
      try {
        const userTime = this.getUserLocalTime(user.timezone);
        const [digestHour, digestMin] = user.digestTime.split(':').map(Number);
        const [promptHour, promptMin] = user.whatsappPromptTime.split(':').map(Number);

        this.logger.log(
          `User ${user.email} (${user.timezone}): ` +
          `local=${userTime.hours}:${String(userTime.minutes).padStart(2, '0')} ` +
          `digest=${user.digestTime} prompt=${user.whatsappPromptTime} ` +
          `whatsapp=${user.whatsappOptedIn}/${!!user.whatsappNumber}`,
        );

        if (userTime.hours === digestHour && userTime.minutes === digestMin) {
          this.logger.log(`Triggering digest for ${user.email}`);
          await this.processUserDigest(user);
        }

        if (userTime.hours === promptHour && userTime.minutes === promptMin) {
          this.logger.log(`Triggering WhatsApp prompt for ${user.email}`);
          await this.whatsappService.sendPriorityPrompt(user);
        }
      } catch (error) {
        this.logger.error(`Schedule check failed for user ${user.id}:`, error);
      }
    }
  }

  @Cron('0 0 * * *', { name: 'deactivate-expired-priorities' })
  async handlePriorityDecay() {
    this.logger.log('Deactivating expired priorities...');
    await this.priorityRepo.deactivateExpired();
    this.logger.log('Priority decay complete');
  }

  async processUserDigest(user: User) {
    this.logger.log(`Processing digest for user ${user.id} (${user.email})`);

    const rawEmails = await this.emailService.fetchNewEmails(user);

    if (rawEmails.length === 0) {
      this.logger.log(`No new emails for user ${user.id}`);
      return;
    }

    await this.emailService.saveEmailRecords(user.id, rawEmails);

    const activePriorities = await this.priorityRepo.findActiveForUser(user.id);

    const classifications = await this.classificationService.classifyEmails(
      rawEmails,
      activePriorities,
    );

    const emailRecords: EmailRecord[] = [];
    for (const raw of rawEmails) {
      const classification = classifications.get(raw.id);
      if (!classification) continue;

      const record = await this.emailRecordRepo.create({
        userId: user.id,
        gmailMessageId: raw.id,
        subject: raw.subject,
        sender: raw.sender,
        bodyPreview: raw.bodyPreview,
        receivedAt: raw.receivedAt,
        category: classification.category,
        summary: classification.summary,
        suggestedAction: classification.suggestedAction,
        extractedFields: classification.extractedFields,
      });
      emailRecords.push(record);
    }

    await this.digestSenderService.sendDigest(user, emailRecords);
  }

  async handleEveningPriorityPrompt() {
    this.logger.log('Running evening priority prompt...');
    const now = new Date();
    const users = await this.userRepo.findAll();

    for (const user of users) {
      try {
        const userTime = this.getUserLocalTime(user.timezone);
        const [promptHour, promptMin] = user.whatsappPromptTime.split(':').map(Number);

        if (userTime.hours === promptHour && userTime.minutes === promptMin) {
          if (userTime.dayOfWeek >= 1 && userTime.dayOfWeek <= 5) {
            await this.whatsappService.sendPriorityPrompt(user);
          }
        }
      } catch (error) {
        this.logger.error(`Failed to send WhatsApp prompt to user ${user.id}:`, error);
      }
    }
  }

  async handlePriorityDecayManual() {
    await this.priorityRepo.deactivateExpired();
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
    const minutes = parseInt(parts.find((p) => p.type === 'minute')?.value || '0');

    const dayMap: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    const dayStr = parts.find((p) => p.type === 'weekday')?.value || 'Mon';
    const dayOfWeek = dayMap[dayStr] ?? 1;

    return { hours, minutes, dayOfWeek };
  }
}
