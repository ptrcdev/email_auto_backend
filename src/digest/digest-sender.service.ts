import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DigestService } from './digest.service.js';
import { User } from '../entities/user.entity.js';
import { EmailRecord } from '../entities/email-record.entity.js';
import { DigestRepository } from '../repositories/digest.repository.js';

@Injectable()
export class DigestSenderService {
  private readonly logger = new Logger(DigestSenderService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly digestService: DigestService,
    private readonly digestRepo: DigestRepository,
  ) {}

  async sendDigest(user: User, emails: EmailRecord[]): Promise<boolean> {
    if (emails.length === 0) {
      this.logger.log(`No emails to digest for user ${user.id}`);
      return false;
    }

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    const existing = await this.digestRepo.findTodayForUser(user.id, dateStr);
    if (existing) {
      this.logger.log(`Digest already sent today for user ${user.id}`);
      return false;
    }

    const digest = this.digestService.buildDigestEmail(emails, dateStr);
    const html = this.digestService.renderHtml(digest, dateStr);

    await this.digestRepo.create({
      userId: user.id,
      sentAt: now,
      date: dateStr,
      urgentCount: digest.urgent.length,
      needsReviewCount: digest.needsReview.length,
      lowPriorityCount: digest.lowPriority.length,
    });

    try {
      await this.sendEmail(
        user.email,
        `Your morning digest — ${this.formatDate(now)}`,
        html,
      );

      this.logger.log(
        `Digest sent to ${user.email} (${digest.urgent.length} urgent, ${digest.needsReview.length} needs review, ${digest.lowPriority.length} low priority)`,
      );
      return true;
    } catch (error) {
      this.logger.error(`Failed to send digest to ${user.email}:`, error);
      return false;
    }
  }

  private async sendEmail(
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    const from = this.configService.get<string>('DIGEST_SENDER_EMAIL');
    const fromName = this.configService.get<string>('DIGEST_SENDER_NAME');

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <${from}>`,
        to: [to],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Resend API error: ${response.status} ${body}`);
    }
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}
