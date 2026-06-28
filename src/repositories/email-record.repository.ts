import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailRecord } from '../entities/email-record.entity.js';

@Injectable()
export class EmailRecordRepository {
  constructor(
    @InjectRepository(EmailRecord)
    private readonly repo: Repository<EmailRecord>,
  ) {}

  async findByGmailId(
    userId: string,
    gmailMessageId: string,
  ): Promise<EmailRecord | null> {
    return this.repo.findOne({ where: { userId, gmailMessageId } });
  }

  async findUnprocessedForUser(userId: string): Promise<EmailRecord[]> {
    return this.repo.find({
      where: { userId, includedInDigest: false },
      order: { receivedAt: 'DESC' },
    });
  }

  async create(data: Partial<EmailRecord>): Promise<EmailRecord> {
    const record = this.repo.create(data);
    return this.repo.save(record);
  }

  async update(id: string, data: Partial<EmailRecord>): Promise<void> {
    await this.repo.update(id, data);
  }

  async markIncluded(ids: string[], digestId: string): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(EmailRecord)
      .set({ includedInDigest: true, digestId })
      .whereInIds(ids)
      .execute();
  }
}
