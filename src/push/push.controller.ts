import { Controller, Post, Get, Body, Logger } from '@nestjs/common';
import { PushService } from './push.service.js';

@Controller('push')
export class PushController {
  private readonly logger = new Logger(PushController.name);

  constructor(private readonly pushService: PushService) {}

  @Get('vapid-public-key')
  getVapidPublicKey() {
    return {
      publicKey: process.env.VAPID_PUBLIC_KEY || null,
      available: this.pushService.isAvailable(),
    };
  }

  @Post('subscribe')
  async subscribe(@Body() body: { email: string; subscription: object }) {
    const success = await this.pushService.subscribe(
      body.email,
      body.subscription as Record<string, unknown>,
    );
    return { status: success ? 'ok' : 'failed' };
  }

  @Post('unsubscribe')
  async unsubscribe(@Body() body: { email: string }) {
    const success = await this.pushService.unsubscribe(body.email);
    return { status: success ? 'ok' : 'failed' };
  }
}
