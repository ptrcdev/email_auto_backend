import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRepository } from '../repositories/user.repository.js';
import { PriorityRepository } from '../repositories/priority.repository.js';
import { User } from '../entities/user.entity.js';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly apiUrl: string;
  private readonly token: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly userRepo: UserRepository,
    private readonly priorityRepo: PriorityRepository,
  ) {
    const phoneNumberId = this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID');
    this.token = this.configService.get<string>('WHATSAPP_TOKEN')!;
    this.apiUrl = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
  }

  async sendPriorityPrompt(user: User): Promise<void> {
    if (!user.whatsappNumber || !user.whatsappOptedIn) {
      this.logger.warn(`User ${user.id} has no WhatsApp number or hasn't opted in`);
      return;
    }

    const templateName = this.configService.get<string>('WHATSAPP_TEMPLATE_NAME');
    const languageCode = this.configService.get<string>('WHATSAPP_TEMPLATE_LANG', 'en');

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: user.whatsappNumber,
          type: 'template',
          template: {
            name: templateName,
            language: { code: languageCode },
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        this.logger.error(`Meta API error sending prompt to ${user.id}:`, error);
        return;
      }

      this.logger.log(`Priority prompt sent to user ${user.id}`);
    } catch (error) {
      this.logger.error(`Failed to send WhatsApp prompt to user ${user.id}:`, error);
    }
  }

  async handleIncomingMessage(
    from: string,
    body: string,
  ): Promise<{ success: boolean; userId?: string }> {
    const phoneNumber = from.replace('+', '');
    const user = await this.userRepo.findByWhatsAppNumber(phoneNumber);

    if (!user) {
      this.logger.warn(`No user found for WhatsApp number: ${phoneNumber}`);
      return { success: false };
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + user.priorityDecayDays);

    await this.priorityRepo.create({
      userId: user.id,
      rawText: body,
      extractedEntities: await this.extractEntities(body),
      active: true,
      expiresAt,
    });

    await this.sendTextMessage(
      user.whatsappNumber,
      'Got it — your priorities are set for tomorrow.',
    );

    this.logger.log(`Priority captured for user ${user.id}: "${body}"`);
    return { success: true, userId: user.id };
  }

  async sendTextMessage(to: string, text: string): Promise<void> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: text },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        this.logger.error(`Meta API error sending message to ${to}:`, error);
      }
    } catch (error) {
      this.logger.error(`Failed to send message to ${to}:`, error);
    }
  }

  private async extractEntities(text: string): Promise<{
    people?: string[];
    projects?: string[];
    topics?: string[];
    deadlines?: string[];
  }> {
    const entities: {
      people?: string[];
      projects?: string[];
      topics?: string[];
      deadlines?: string[];
    } = {};

    const namePatterns = text.match(/\b[A-Z][a-z]+ (?:de |da |do )?[A-Z][a-z]+\b/g) || [];
    if (namePatterns.length > 0) entities.people = namePatterns;

    const projectPatterns = text.match(/(?:project|projeto|obra)\s+\w+/gi) || [];
    if (projectPatterns.length > 0) entities.projects = projectPatterns;

    const deadlinePatterns = text.match(/\b(today|tomorrow|this week|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|hoje|amanhã|esta semana|próxima semana)\b/gi) || [];
    if (deadlinePatterns.length > 0) entities.deadlines = deadlinePatterns;

    return entities;
  }

  async optIn(user: User, whatsappNumber: string): Promise<void> {
    await this.userRepo.update(user.id, {
      whatsappNumber,
      whatsappOptedIn: true,
    });

    await this.sendTextMessage(
      whatsappNumber,
      'You are now opted in to daily priority check-ins. You will receive a message each evening asking what matters most for tomorrow.',
    );
  }
}
