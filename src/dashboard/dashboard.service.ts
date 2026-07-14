import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { UserRepository } from '../repositories/user.repository.js';
import { EmailRecordRepository } from '../repositories/email-record.repository.js';
import { EmailRecord, EmailCategory } from '../entities/email-record.entity.js';

export interface IntelligentSearchResult {
  answer: EmailRecord | null;
  related: EmailRecord[];
  results: EmailRecord[];
  interpretation: string;
  explanation: string;
}

interface ExtractedSearchIntent {
  keywords: string[];
  topic: string | null;
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

  async search(email: string, query: string): Promise<IntelligentSearchResult> {
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      return {
        answer: null,
        related: [],
        results: [],
        interpretation: 'User not found',
        explanation: '',
      };
    }

    const intent = await this.extractIntent(query);

    const candidates = await this.emailRecordRepo.searchEmails(
      user.id,
      intent.keywords,
      intent.senderRole,
      intent.dateRange.start ? new Date(intent.dateRange.start) : null,
      intent.dateRange.end ? new Date(intent.dateRange.end) : null,
    );

    const interpretation = this.buildInterpretation(
      query,
      intent,
      candidates.length,
    );

    let answer: EmailRecord | null = null;
    let related: EmailRecord[] = [];
    let explanation = '';

    if (candidates.length > 0) {
      try {
        const selection = await this.selectAnswer(
          query,
          candidates.slice(0, 40),
        );
        answer =
          candidates.find((c) => c.id === selection.answerEmailId) || null;
        related = candidates.filter(
          (c) =>
            selection.relatedEmailIds.includes(c.id) &&
            c.id !== (answer?.id ?? null),
        );
        explanation = selection.explanation || '';
      } catch (error) {
        this.logger.error('AI answer selection failed, using fallback:', error);
        answer = this.fallbackAnswer(candidates, intent);
        related = this.fallbackRelated(candidates, answer, intent);
      }
      if (!answer) {
        answer = candidates[0];
        related = candidates.slice(1, 6);
      }
    }

    return {
      answer,
      related,
      results: candidates,
      interpretation,
      explanation,
    };
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
          'nvidia/nemotron-3-ultra-550b-a55b:free',
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
  "topic": "short topic/project phrase the question is about (e.g. 'Forest property', 'loan refinance') or null",
  "senderRole": "role if mentioned (e.g. lawyer, architect, contractor, bank) or null",
  "dateRange": {
    "start": "YYYY-MM-DD or null if not specified",
    "end": "YYYY-MM-DD or null if not specified"
  }
}

Rules:
- Extract meaningful keywords (nouns, names, topics) — skip common words
- topic should capture the specific subject the user is asking about
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
        topic: null,
        senderRole: null,
        dateRange: { start: null, end: null },
      };
    }
  }

  private async selectAnswer(
    query: string,
    candidates: EmailRecord[],
  ): Promise<{
    answerEmailId: string;
    relatedEmailIds: string[];
    explanation: string;
  }> {
    const compact = candidates
      .map((e, i) => {
        const date = new Date(e.receivedAt).toISOString().split('T')[0];
        const project = e.extractedFields?.projectName
          ? ` | project: ${e.extractedFields.projectName}`
          : '';
        const summary = e.summary ? ` | ${e.summary}` : '';
        return `${i + 1}. [${e.id}] ${e.subject} | from ${e.sender} on ${date} (${e.category})${project}${summary}`;
      })
      .join('\n');

    const response = await this.openai.chat.completions.create({
      model: this.configService.get<string>(
        'LLM_MODEL',
        'nvidia/nemotron-3-ultra-550b-a55b:free',
      ),
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are an email search ranker. Given a user's question and a list of candidate emails, pick the single best email that directly answers the question (e.g. the specific event the user asked about, such as when a deal closed). Then list related emails that are about the same topic or project even if less directly relevant. Always respond with valid JSON.`,
        },
        {
          role: 'user',
          content: `Question: "${query}"

Candidate emails:
${compact}

Respond with a JSON object:
{
  "answerEmailId": "<id of the single best email that answers the question>",
  "relatedEmailIds": ["<ids of other emails on the same topic/project>", "..."],
  "explanation": "<one short sentence explaining the choice>"
}

Rules:
- answerEmailId must be one of the provided [id] values
- relatedEmailIds must NOT include the answerEmailId
- If nothing matches well, set answerEmailId to the closest candidate and relatedEmailIds to []
- Only use ids from the candidate list`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    const answerEmailId = String(parsed.answerEmailId || '');
    const relatedEmailIds = Array.isArray(parsed.relatedEmailIds)
      ? parsed.relatedEmailIds.map(String)
      : [];
    return {
      answerEmailId,
      relatedEmailIds,
      explanation: parsed.explanation || '',
    };
  }

  private fallbackAnswer(
    candidates: EmailRecord[],
    intent: ExtractedSearchIntent,
  ): EmailRecord {
    if (intent.topic) {
      const byTopic = candidates.find(
        (c) =>
          c.extractedFields?.projectName &&
          c.extractedFields.projectName
            .toLowerCase()
            .includes(intent.topic!.toLowerCase()),
      );
      if (byTopic) return byTopic;
    }
    return candidates[0];
  }

  private fallbackRelated(
    candidates: EmailRecord[],
    answer: EmailRecord,
    intent: ExtractedSearchIntent,
  ): EmailRecord[] {
    const answerTopic = answer.extractedFields?.projectName?.toLowerCase();
    const keywords = (intent.keywords || []).map((k) => k.toLowerCase());
    return candidates
      .filter((c) => c.id !== answer.id)
      .filter((c) => {
        if (
          answerTopic &&
          c.extractedFields?.projectName?.toLowerCase() === answerTopic
        ) {
          return true;
        }
        const text = `${c.subject} ${c.summary || ''}`.toLowerCase();
        const overlap = keywords.filter((k) => text.includes(k)).length;
        return overlap >= 2;
      })
      .slice(0, 8);
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
