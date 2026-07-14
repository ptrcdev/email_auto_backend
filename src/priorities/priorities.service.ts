import { Injectable, Logger } from '@nestjs/common';
import { PriorityRepository } from '../repositories/priority.repository.js';
import { UserRepository } from '../repositories/user.repository.js';

@Injectable()
export class PrioritiesService {
  private readonly logger = new Logger(PrioritiesService.name);

  constructor(
    private readonly priorityRepo: PriorityRepository,
    private readonly userRepo: UserRepository,
  ) {}

  async getActivePriorities(email: string) {
    const user = await this.userRepo.findByEmail(email);
    if (!user) return [];
    return this.priorityRepo.findActiveForUser(user.id);
  }

  async getDailyPriorities(email: string) {
    const user = await this.userRepo.findByEmail(email);
    if (!user) return [];
    return this.priorityRepo.findDailyForUser(user.id);
  }

  async getPermanentPriorities(email: string) {
    const user = await this.userRepo.findByEmail(email);
    if (!user) return [];
    return this.priorityRepo.findPermanentForUser(user.id);
  }

  async savePriorities(email: string, rawTexts: string[]) {
    const user = await this.userRepo.findByEmail(email);
    if (!user) return null;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + user.priorityDecayDays);

    const existing = await this.priorityRepo.findDailyForUser(user.id);
    const existingTexts = new Set(
      existing.map((p) => p.rawText.trim().toLowerCase()),
    );

    const priorities: Awaited<ReturnType<typeof this.priorityRepo.create>>[] =
      [];
    for (const rawText of rawTexts) {
      const trimmed = rawText.trim();
      if (!trimmed) continue;
      if (existingTexts.has(trimmed.toLowerCase())) continue;
      const priority = await this.priorityRepo.create({
        userId: user.id,
        rawText: trimmed,
        extractedEntities: await this.extractEntities(rawText),
        active: true,
        expiresAt,
        permanent: false,
      });
      priorities.push(priority);
    }

    this.logger.log(`Saved ${priorities.length} priorities for user ${email}`);
    return priorities;
  }

  async addPermanentPriority(email: string, rawText: string) {
    const user = await this.userRepo.findByEmail(email);
    if (!user) return null;

    const trimmed = rawText.trim();
    if (!trimmed) return null;

    const priority = await this.priorityRepo.create({
      userId: user.id,
      rawText: trimmed,
      extractedEntities: await this.extractEntities(rawText),
      active: true,
      expiresAt: null,
      permanent: true,
    });

    this.logger.log(`Added permanent priority for user ${email}`);
    return priority;
  }

  async updatePermanentPriority(email: string, id: string, rawText: string) {
    const user = await this.userRepo.findByEmail(email);
    if (!user) return null;

    const trimmed = rawText.trim();
    if (!trimmed) return null;

    const existing = await this.priorityRepo
      .findPermanentForUser(user.id)
      .then((list) => list.find((p) => p.id === id));
    if (!existing) return null;

    existing.rawText = trimmed;
    existing.extractedEntities = await this.extractEntities(rawText);
    const updated = await this.priorityRepo.create(existing);
    this.logger.log(`Updated permanent priority ${id} for user ${email}`);
    return updated;
  }

  async deletePermanentPriority(email: string, id: string) {
    const user = await this.userRepo.findByEmail(email);
    if (!user) return null;

    await this.priorityRepo.deactivateById(user.id, id);
    this.logger.log(`Deleted permanent priority ${id} for user ${email}`);
    return { status: 'ok' };
  }

  async deletePriority(email: string, id: string) {
    const user = await this.userRepo.findByEmail(email);
    if (!user) return null;

    await this.priorityRepo.deactivateAnyById(user.id, id);
    this.logger.log(`Deleted priority ${id} for user ${email}`);
    return { status: 'ok' };
  }

  private extractEntities(text: string): Promise<{
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

    const namePatterns =
      text.match(/\b[A-Z][a-z]+ (?:de |da |do )?[A-Z][a-z]+\b/g) || [];
    if (namePatterns.length > 0) entities.people = namePatterns;

    const projectPatterns =
      text.match(/(?:project|projeto|obra)\s+\w+/gi) || [];
    if (projectPatterns.length > 0) entities.projects = projectPatterns;

    const deadlinePatterns =
      text.match(
        /\b(today|tomorrow|this week|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|hoje|amanhã|esta semana|próxima semana)\b/gi,
      ) || [];
    if (deadlinePatterns.length > 0) entities.deadlines = deadlinePatterns;

    return Promise.resolve(entities);
  }
}
