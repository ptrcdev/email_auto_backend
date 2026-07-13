import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webPush from 'web-push';
import { UserRepository } from '../repositories/user.repository.js';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private initialized = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly userRepo: UserRepository,
  ) {
    const vapidPublicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');
    const vapidSubject = this.configService.get<string>('VAPID_SUBJECT');

    if (vapidPublicKey && vapidPrivateKey && vapidSubject) {
      webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
      this.initialized = true;
      this.logger.log('Web push initialized with VAPID keys');
    } else {
      this.logger.warn('VAPID keys not configured — web push disabled');
    }
  }

  isAvailable(): boolean {
    return this.initialized;
  }

  async subscribe(email: string, subscription: Record<string, unknown>): Promise<boolean> {
    if (!this.initialized) return false;

    const user = await this.userRepo.findByEmail(email);
    if (!user) return false;

    await this.userRepo.update(user.id, { pushSubscription: subscription });
    this.logger.log(`Push subscription saved for user ${email}`);
    return true;
  }

  async unsubscribe(email: string): Promise<boolean> {
    const user = await this.userRepo.findByEmail(email);
    if (!user) return false;

    await this.userRepo.update(user.id, { pushSubscription: undefined });
    return true;
  }

  async sendPush(
    email: string,
    title: string,
    body: string,
    url: string,
  ): Promise<boolean> {
    if (!this.initialized) return false;

    const user = await this.userRepo.findByEmail(email);
    if (!user?.pushSubscription) return false;

    try {
      await webPush.sendNotification(
        user.pushSubscription as webPush.PushSubscription,
        JSON.stringify({ title, body, url }),
      );
      this.logger.log(`Push notification sent to ${email}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send push to ${email}:`, error);
      const err = error as { statusCode?: number };
      if (err.statusCode === 410) {
        await this.userRepo.update(user.id, { pushSubscription: undefined });
        this.logger.log(`Removed expired push subscription for ${email}`);
      }
      return false;
    }
  }
}
