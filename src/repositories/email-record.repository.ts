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

  async countByCategory(
    userId: string,
    since?: Date,
  ): Promise<{ urgent: number; needsReview: number; lowPriority: number }> {
    const qb = this.repo.createQueryBuilder('e').where('e.userId = :userId', { userId });
    if (since) {
      qb.andWhere('e.receivedAt >= :since', { since });
    }

    const rows = await qb
      .select('e.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .groupBy('e.category')
      .getRawMany();

    const counts = { urgent: 0, needsReview: 0, lowPriority: 0 };
    for (const row of rows) {
      if (row.category === 'urgent') counts.urgent = parseInt(row.count, 10);
      else if (row.category === 'needs_review') counts.needsReview = parseInt(row.count, 10);
      else if (row.category === 'low_priority') counts.lowPriority = parseInt(row.count, 10);
    }
    return counts;
  }

  async countByAction(
    userId: string,
    action: string,
    since?: Date,
  ): Promise<number> {
    const qb = this.repo
      .createQueryBuilder('e')
      .where('e.userId = :userId', { userId })
      .andWhere('e.suggestedAction = :action', { action });
    if (since) {
      qb.andWhere('e.receivedAt >= :since', { since });
    }
    return qb.getCount();
  }

  async countByExtractedField(
    userId: string,
    field: 'amount' | 'deadline',
    since?: Date,
  ): Promise<number> {
    const qb = this.repo
      .createQueryBuilder('e')
      .where('e.userId = :userId', { userId })
      .andWhere(`e."extractedFields"->>'${field}' IS NOT NULL`)
      .andWhere(`e."extractedFields"->>'${field}' != ''`);
    if (since) {
      qb.andWhere('e.receivedAt >= :since', { since });
    }
    return qb.getCount();
  }

  async getDailyVolume(
    userId: string,
    since: Date,
  ): Promise<{ date: string; count: number }[]> {
    const rows = await this.repo
      .createQueryBuilder('e')
      .select("TO_CHAR(e.receivedAt, 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)', 'count')
      .where('e.userId = :userId', { userId })
      .andWhere('e.receivedAt >= :since', { since })
      .groupBy("TO_CHAR(e.receivedAt, 'YYYY-MM-DD')")
      .orderBy('date', 'ASC')
      .getRawMany();

    return rows.map((r) => ({ date: r.date, count: parseInt(r.count, 10) }));
  }

  async getTopSenders(
    userId: string,
    limit: number = 5,
  ): Promise<{ sender: string; count: number }[]> {
    const rows = await this.repo
      .createQueryBuilder('e')
      .select('e.sender', 'sender')
      .addSelect('COUNT(*)', 'count')
      .where('e.userId = :userId', { userId })
      .groupBy('e.sender')
      .orderBy('count', 'DESC')
      .limit(limit)
      .getRawMany();

    return rows.map((s) => ({
      sender: s.sender,
      count: parseInt(s.count, 10),
    }));
  }

  async findDistinctDatesForUser(
    userId: string,
    from?: Date,
    to?: Date,
  ): Promise<string[]> {
    const qb = this.repo
      .createQueryBuilder('e')
      .select("TO_CHAR(e.receivedAt, 'YYYY-MM-DD')", 'date')
      .where('e.userId = :userId', { userId })
      .groupBy("TO_CHAR(e.receivedAt, 'YYYY-MM-DD')")
      .orderBy('date', 'DESC');

    if (from) {
      qb.andWhere('e.receivedAt >= :from', { from });
    }
    if (to) {
      qb.andWhere('e.receivedAt <= :to', { to });
    }

    const rows = await qb.getRawMany();
    return rows.map((r) => r.date);
  }

  async findByUserForDate(userId: string, date: string): Promise<EmailRecord[]> {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(`${date}T23:59:59.999Z`);
    return this.repo
      .createQueryBuilder('e')
      .where('e.userId = :userId', { userId })
      .andWhere('e.receivedAt >= :start', { start })
      .andWhere('e.receivedAt <= :end', { end })
      .orderBy('e.receivedAt', 'DESC')
      .getMany();
  }

  async getStatsForUser(userId: string): Promise<{
    total: number;
    urgent: number;
    needsReview: number;
    lowPriority: number;
    needsReply: number;
    meetings: number;
    finance: number;
    updates: number;
    topSenders: { sender: string; count: number }[];
    upcomingDeadlines: { subject: string; deadline: string; sender: string }[];
  }> {
    const total = await this.repo.count({ where: { userId } });
    const categoryCounts = await this.countByCategory(userId);
    const needsReply = await this.countByAction(userId, 'reply');
    const meetings = await this.countByExtractedField(userId, 'deadline');
    const finance = await this.countByExtractedField(userId, 'amount');
    const updates = categoryCounts.lowPriority;
    const topSenders = await this.getTopSenders(userId, 5);

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
      urgent: categoryCounts.urgent,
      needsReview: categoryCounts.needsReview,
      lowPriority: categoryCounts.lowPriority,
      needsReply,
      meetings,
      finance,
      updates,
      topSenders,
      upcomingDeadlines,
    };
  }
}
