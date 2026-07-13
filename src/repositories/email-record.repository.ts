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

  async findByUserSince(userId: string, since: Date): Promise<EmailRecord[]> {
    return this.repo
      .createQueryBuilder('e')
      .where('e.userId = :userId', { userId })
      .andWhere('e.receivedAt >= :since', { since })
      .orderBy('e.receivedAt', 'DESC')
      .getMany();
  }

  async searchEmails(
    userId: string,
    keywords: string[],
    senderRole: string | null,
    startDate: Date | null,
    endDate: Date | null,
  ): Promise<EmailRecord[]> {
    const qb = this.repo
      .createQueryBuilder('e')
      .where('e.userId = :userId', { userId });

    if (keywords.length > 0) {
      const keywordClauses = keywords.map((_, i) => {
        const param = `kw${i}`;
        return `(e.subject ILIKE :${param} OR e.bodyPreview ILIKE :${param} OR e.sender ILIKE :${param} OR e.summary ILIKE :${param})`;
      });
      keywords.forEach((kw, i) => {
        qb.setParameter(`kw${i}`, `%${kw}%`);
      });
      qb.andWhere(`(${keywordClauses.join(' OR ')})`);
    }

    if (startDate) {
      qb.andWhere('e.receivedAt >= :startDate', { startDate });
    }
    if (endDate) {
      qb.andWhere('e.receivedAt <= :endDate', { endDate });
    }

    qb.orderBy('e.receivedAt', 'DESC').limit(100);

    const emails = await qb.getMany();

    if (senderRole) {
      return emails.filter(
        (e) =>
          e.extractedFields?.senderRole &&
          e.extractedFields.senderRole
            .toLowerCase()
            .includes(senderRole.toLowerCase()),
      );
    }

    return emails;
  }

  async getStatsForUser(userId: string): Promise<{
    total: number;
    urgent: number;
    needsReview: number;
    lowPriority: number;
    topSenders: { sender: string; count: number }[];
    upcomingDeadlines: { subject: string; deadline: string; sender: string }[];
  }> {
    const total = await this.repo.count({ where: { userId } });

    const urgent = await this.repo.count({
      where: { userId, category: 'urgent' },
    });
    const needsReview = await this.repo.count({
      where: { userId, category: 'needs_review' },
    });
    const lowPriority = await this.repo.count({
      where: { userId, category: 'low_priority' },
    });

    const topSenders = await this.repo
      .createQueryBuilder('e')
      .select('e.sender', 'sender')
      .addSelect('COUNT(*)', 'count')
      .where('e.userId = :userId', { userId })
      .groupBy('e.sender')
      .orderBy('count', 'DESC')
      .limit(5)
      .getRawMany();

    const allEmails = await this.repo.find({
      where: { userId },
      order: { receivedAt: 'DESC' },
      take: 200,
    });

    const upcomingDeadlines = allEmails
      .filter(
        (e) =>
          e.extractedFields?.deadline &&
          e.extractedFields.deadline.trim() !== '',
      )
      .slice(0, 10)
      .map((e) => ({
        subject: e.subject,
        deadline: e.extractedFields.deadline!,
        sender: e.sender,
      }));

    return {
      total,
      urgent,
      needsReview,
      lowPriority,
      topSenders: topSenders.map((s) => ({
        sender: s.sender,
        count: parseInt(s.count, 10),
      })),
      upcomingDeadlines,
    };
  }
}
