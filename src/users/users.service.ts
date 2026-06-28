import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { UserRepository } from '../repositories/user.repository.js';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly userRepo: UserRepository) {}

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
      whatsappNumber?: string;
      whatsappOptedIn?: boolean;
      digestTime?: string;
      whatsappPromptTime?: string;
      timezone?: string;
    },
  ) {
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.userRepo.update(user.id, data);
    this.logger.log(`Onboarding preferences saved for user ${email}`);
    return { status: 'ok' };
  }
}
