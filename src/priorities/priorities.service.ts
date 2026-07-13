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

  async savePriorities(email: string, rawTexts: string[]) {
    const user = await this.userRepo.findByEmail(email);
    if (!user) return null;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + user.priorityDecayDays);

    const priorities: Awaited<ReturnType<typeof this.priorityRepo.create>>[] =
      [];
    for (const rawText of rawTexts) {
      if (!rawText.trim()) continue;
      const priority = await this.priorityRepo.create({
        userId: user.id,
        rawText: rawText.trim(),
        extractedEntities: await this.extractEntities(rawText),
        active: true,
        expiresAt,
      });
      priorities.push(priority);
    }

    this.logger.log(`Saved ${priorities.length} priorities for user ${email}`);
    return priorities;
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
