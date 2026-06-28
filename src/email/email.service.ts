import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { AuthService } from '../auth/auth.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import { EmailRecordRepository } from '../repositories/email-record.repository.js';
import { User } from '../entities/user.entity.js';

export interface RawEmail {
  id: string;
  subject: string;
  sender: string;
  bodyPreview: string;
  receivedAt: Date;
  snippet: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly authService: AuthService,
    private readonly userRepo: UserRepository,
    private readonly emailRecordRepo: EmailRecordRepository,
  ) {}

  async fetchNewEmails(user: User): Promise<RawEmail[]> {
    if (user.emailProvider === 'microsoft') {
      return this.fetchMicrosoftEmails(user);
    }
    return this.fetchGoogleEmails(user);
  }

  // ── Google Gmail ──

  private async fetchGoogleEmails(user: User): Promise<RawEmail[]> {
    if (!user.googleAccessToken || !user.googleRefreshToken) {
      this.logger.warn(`User ${user.id} has no Google credentials`);
      return [];
    }

    const authClient = this.authService.createGoogleClient(
      user.googleAccessToken,
      user.googleRefreshToken,
    );

    const gmail = google.gmail({ version: 'v1', auth: authClient as any });

    try {
      const lastRecord = await this.emailRecordRepo.findUnprocessedForUser(user.id);
      const afterDate = lastRecord.length > 0
        ? Math.floor(lastRecord[0].receivedAt.getTime() / 1000)
        : Math.floor(Date.now() / 1000) - 86400;

      const response = await gmail.users.messages.list({
        userId: 'me',
        q: `after:${afterDate}`,
        maxResults: 100,
      });

      const messages = response.data.messages || [];
      const emails: RawEmail[] = [];

      for (const msg of messages) {
        if (!msg.id) continue;

        const exists = await this.emailRecordRepo.findByGmailId(user.id, msg.id);
        if (exists) continue;

        const full = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'Date'],
        });

        const headers = full.data.payload?.headers || [];
        const subject = headers.find((h) => h.name === 'Subject')?.value || '(no subject)';
        const from = headers.find((h) => h.name === 'From')?.value || '';
        const dateStr = headers.find((h) => h.name === 'Date')?.value || '';

        emails.push({
          id: msg.id,
          subject,
          sender: from,
          bodyPreview: full.data.snippet || '',
          receivedAt: dateStr ? new Date(dateStr) : new Date(),
          snippet: full.data.snippet || '',
        });
      }

      this.logger.log(`Fetched ${emails.length} new emails for user ${user.id} (Google)`);
      return emails;
    } catch (error) {
      this.logger.error(`Failed to fetch Google emails for user ${user.id}:`, error);
      return [];
    }
  }

  // ── Microsoft Graph ──

  private async fetchMicrosoftEmails(user: User): Promise<RawEmail[]> {
    if (!user.microsoftAccessToken || !user.microsoftRefreshToken) {
      this.logger.warn(`User ${user.id} has no Microsoft credentials`);
      return [];
    }

    let accessToken = user.microsoftAccessToken;

    if (user.microsoftTokenExpiry && user.microsoftTokenExpiry <= new Date()) {
      try {
        const refreshed = await this.authService.refreshMicrosoftToken(user);
        accessToken = refreshed.accessToken;
        await this.userRepo.update(user.id, {
          microsoftAccessToken: accessToken,
          microsoftTokenExpiry: refreshed.expiryDate,
        });
      } catch (error) {
        this.logger.error(`Failed to refresh Microsoft token for user ${user.id}:`, error);
        return [];
      }
    }

    try {
      const lastRecord = await this.emailRecordRepo.findUnprocessedForUser(user.id);
      const afterDate = lastRecord.length > 0
        ? lastRecord[0].receivedAt.toISOString()
        : new Date(Date.now() - 86400000).toISOString();

      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/messages?$filter=receivedDateTime ge ${afterDate}&$top=100&$orderby=receivedDateTime desc&$select=id,subject,from,bodyPreview,receivedDateTime`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(`Microsoft Graph API error for user ${user.id}: ${errorBody}`);
        return [];
      }

      const data = await response.json() as {
        value: Array<{
          id: string;
          subject: string;
          from: { emailAddress: { address: string; name: string } };
          bodyPreview: string;
          receivedDateTime: string;
        }>;
      };

      const emails: RawEmail[] = [];

      for (const msg of data.value) {
        const exists = await this.emailRecordRepo.findByGmailId(user.id, msg.id);
        if (exists) continue;

        emails.push({
          id: msg.id,
          subject: msg.subject || '(no subject)',
          sender: msg.from?.emailAddress?.address || '',
          bodyPreview: msg.bodyPreview || '',
          receivedAt: new Date(msg.receivedDateTime),
          snippet: msg.bodyPreview || '',
        });
      }

      this.logger.log(`Fetched ${emails.length} new emails for user ${user.id} (Microsoft)`);
      return emails;
    } catch (error) {
      this.logger.error(`Failed to fetch Microsoft emails for user ${user.id}:`, error);
      return [];
    }
  }

  async saveEmailRecords(userId: string, emails: RawEmail[]): Promise<void> {
    for (const email of emails) {
      const exists = await this.emailRecordRepo.findByGmailId(userId, email.id);
      if (!exists) {
        await this.emailRecordRepo.create({
          userId,
          gmailMessageId: email.id,
          subject: email.subject,
          sender: email.sender,
          bodyPreview: email.bodyPreview,
          receivedAt: email.receivedAt,
        });
      }
    }
  }
}
