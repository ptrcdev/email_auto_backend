import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Res,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { WhatsAppService } from './whatsapp.service.js';
import { UserRepository } from '../repositories/user.repository.js';

@Controller('whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(
    private readonly whatsappService: WhatsAppService,
    private readonly userRepo: UserRepository,
  ) {}

  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

    if (mode === 'subscribe' && token === verifyToken) {
      this.logger.log('Webhook verified');
      res.status(200).send(challenge);
    } else {
      this.logger.warn('Webhook verification failed');
      res.status(403).send('Forbidden');
    }
  }

  @Post('webhook')
  async handleWebhook(@Body() body: any, @Res() res: Response) {
    try {
      if (body.object !== 'whatsapp_business_account') {
        res.status(200).send('OK');
        return;
      }

      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          if (change.field !== 'messages') continue;

          const value = change.value;
          const messages = value.messages || [];

          for (const message of messages) {
            if (message.type !== 'text') continue;

            const from = message.from;
            const text = message.text?.body || '';

            this.logger.log(`WhatsApp message from ${from}: ${text}`);
            await this.whatsappService.handleIncomingMessage(from, text);
          }
        }
      }

      res.status(200).send('OK');
    } catch (error) {
      this.logger.error('Webhook error:', error);
      res.status(200).send('OK');
    }
  }

  @Post('opt-in')
  async optIn(@Body() body: { whatsappNumber: string }, @Res() res: Response) {
    const user = await this.userRepo.findByWhatsAppNumber(body.whatsappNumber);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await this.whatsappService.optIn(user, body.whatsappNumber);
    res.json({ status: 'opt-in complete' });
  }
}
