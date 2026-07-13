import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { UserRepository } from '../repositories/user.repository.js';
import { EmailRecordRepository } from '../repositories/email-record.repository.js';
import { EmailRecord, EmailCategory } from '../entities/email-record.entity.js';

export interface SearchResult {
  emails: EmailRecord[];
  interpretation: string;
}

interface ExtractedSearchIntent {
  keywords: string[];
  senderRole: string | null;
  dateRange: { start: string | null; end: string | null };
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);
  private openai: OpenAI;

  constructor(
    private readonly configService: ConfigService,
    private readonly userRepo: UserRepository,
    private readonly emailRecordRepo: EmailRecordRepository,
  ) {
    this.openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: configService.get<string>('OPENROUTER_API_KEY'),
    });
  }

  async getEmails_groupedByDay(
    email: string,
    days: number = 30,
  ): Promise<Record<string, EmailRecord[]>> {
    const user = await this.userRepo.findByEmail(email);
    if (!user) return {};

    const since = new Date();
    since.setDate(since.getDate() - days);

    const emails = await this.emailRecordRepo.findByUserSince(user.id, since);

    const grouped: Record<string, EmailRecord[]> = {};
    for (const e of emails) {
      const dateKey = e.receivedAt.toISOString().split('T')[0];
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(e);
    }

    const sortedKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
    const sorted: Record<string, EmailRecord[]> = {};
    for (const key of sortedKeys) {
      sorted[key] = grouped[key];
    }
    return sorted;
  }

  async search(email: string, query: string): Promise<SearchResult> {
    const user = await this.userRepo.findByEmail(email);
    if (!user) return { emails: [], interpretation: 'User not found' };

    const intent = await this.extractIntent(query);

    const emails = await this.emailRecordRepo.searchEmails(
      user.id,
      intent.keywords,
      intent.senderRole,
      intent.dateRange.start ? new Date(intent.dateRange.start) : null,
      intent.dateRange.end ? new Date(intent.dateRange.end) : null,
    );

    const interpretation = this.buildInterpretation(
      query,
      intent,
      emails.length,
    );

    return { emails, interpretation };
  }

  async getStats(email: string): Promise<{
    total: number;
    urgent: number;
    needsReview: number;
    lowPriority: number;
    topSenders: { sender: string; count: number }[];
    upcomingDeadlines: { subject: string; deadline: string; sender: string }[];
  }> {
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      return {
        total: 0,
        urgent: 0,
        needsReview: 0,
        lowPriority: 0,
        topSenders: [],
        upcomingDeadlines: [],
      };
    }

    const stats = await this.emailRecordRepo.getStatsForUser(user.id);
    return stats;
  }

  private async extractIntent(query: string): Promise<ExtractedSearchIntent> {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.configService.get<string>(
          'LLM_MODEL',
          'anthropic/claude-sonnet-4-20250514',
        ),
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are a search intent extractor. Given a user's natural language query about their emails, extract search parameters. Always respond with valid JSON.`,
          },
          {
            role: 'user',
            content: `Extract search intent from this query:

"${query}"

Respond with a JSON object:
{
  "keywords": ["array", "of", "search", "terms"],
  "senderRole": "role if mentioned (e.g. lawyer, architect, contractor, bank) or null",
  "dateRange": {
    "start": "YYYY-MM-DD or null if not specified",
    "end": "YYYY-MM-DD or null if not specified"
  }
}

Rules:
- Extract meaningful keywords (nouns, names, topics) — skip common words
- If the user says "last week", calculate the date range relative to today
- If no time reference, set both dates to null
- senderRole should match the extractedFields.senderRole pattern (lawyer, architect, contractor, bank, municipality, etc.)`,
          },
        ],
      });

      const content = response.choices[0]?.message?.content || '{}';
      return JSON.parse(content);
    } catch (error) {
      this.logger.error('Failed to extract search intent:', error);
      return {
        keywords: query.split(/\s+/),
        senderRole: null,
        dateRange: { start: null, end: null },
      };
    }
  }

  private buildInterpretation(
    query: string,
    intent: ExtractedSearchIntent,
    resultCount: number,
  ): string {
    const parts: string[] = [];
    if (intent.keywords.length > 0) {
      parts.push(`keywords: "${intent.keywords.join(', ')}"`);
    }
    if (intent.senderRole) {
      parts.push(`sender role: ${intent.senderRole}`);
    }
    if (intent.dateRange.start || intent.dateRange.end) {
      const start = intent.dateRange.start || 'anytime';
      const end = intent.dateRange.end || 'now';
      parts.push(`date range: ${start} to ${end}`);
    }
    const filterDesc =
      parts.length > 0 ? `Filtered by ${parts.join('; ')}` : 'Full text search';
    return `${filterDesc} — ${resultCount} result${resultCount !== 1 ? 's' : ''} found`;
  }
}
