import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Priority } from '../entities/priority.entity.js';

@Injectable()
export class PriorityRepository {
  constructor(
    @InjectRepository(Priority)
    private readonly repo: Repository<Priority>,
  ) {}

  async findActiveForUser(userId: string): Promise<Priority[]> {
    const now = new Date();
    return this.repo
      .find({
        where: {
          userId,
          active: true,
        },
        order: { createdAt: 'DESC' },
      })
      .then((priorities) =>
        priorities.filter((p) => !p.expiresAt || p.expiresAt > now),
      );
  }

  async create(data: Partial<Priority>): Promise<Priority> {
    const priority = this.repo.create(data);
    return this.repo.save(priority);
  }

  async deactivateExpired(): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(Priority)
      .set({ active: false })
      .where('expiresAt < :now', { now: new Date() })
      .andWhere('active = :active', { active: true })
      .execute();
  }
}
