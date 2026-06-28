import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Digest } from '../entities/digest.entity.js';

@Injectable()
export class DigestRepository {
  constructor(
    @InjectRepository(Digest)
    private readonly repo: Repository<Digest>,
  ) {}

  async findTodayForUser(userId: string, date: string): Promise<Digest | null> {
    return this.repo.findOne({ where: { userId, date } });
  }

  async create(data: Partial<Digest>): Promise<Digest> {
    const digest = this.repo.create(data);
    return this.repo.save(digest);
  }

  async markOpened(id: string): Promise<void> {
    await this.repo.update(id, { opened: true, openedAt: new Date() });
  }
}
