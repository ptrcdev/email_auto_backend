import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { UserRepository } from '../repositories/user.repository.js';
import { EmailRecordRepository } from '../repositories/email-record.repository.js';
import { EmailRecord } from '../entities/email-record.entity.js';
import { llmWithFallback, resolveModelChain } from '../common/llm-fallback.js';

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
  private modelChain: string[];

  constructor(
    private readonly configService: ConfigService,
    private readonly userRepo: UserRepository,
    private readonly emailRecordRepo: EmailRecordRepository,
  ) {
    this.openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: configService.get<string>('OPENROUTER_API_KEY'),
    });
    this.modelChain = resolveModelChain(
      configService.get<string>('LLM_MODELS'),
    );
  }

  async getDailyBriefs(email: string, from?: string, to?: string) {
    const user = await this.userRepo.findByEmail(email);
    if (!user) return [];

    const fromDate = from ? new Date(`${from}T00:00:00.000Z`) : undefined;
    const toDate = to ? new Date(`${to}T23:59:59.999Z`) : undefined;

    const dates = await this.emailRecordRepo.findDistinctDatesForUser(
      user.id,
      fromDate,
      toDate,
    );

    const briefs = await Promise.all(
      dates.map((date) => this.buildDailyBriefForDate(user, date)),
    );

    return briefs;
  }

  async getDailyBriefForDate(email: string, date: string) {
    const user = await this.userRepo.findByEmail(email);
    if (!user) return null;

    return this.buildDailyBriefForDate(user, date);
  }

  private async buildDailyBriefForDate(
    user: { id: string; name?: string; preferredName?: string; timezone?: string; email: string },
    date: string,
  ) {
    const emails = await this.emailRecordRepo.findByUserForDate(user.id, date);

    const highPriority = emails.filter((e) => e.category === 'urgent');
    const needsReply = emails.filter((e) => e.suggestedAction === 'reply');
    const meetings = emails.filter((e) => e.extractedFields?.deadline);
    const finance = emails.filter((e) => e.extractedFields?.amount);
    const updates = emails.filter((e) => e.category === 'low_priority');

    const urgentCount = highPriority.length;
    const needsReviewCount = emails.filter(
      (e) => e.category === 'needs_review',
    ).length;
    const lowPriorityCount = updates.length;

    const summary = emails
      .sort((a, b) => {
        const order = { urgent: 0, needs_review: 1, low_priority: 2 };
        return (order[a.category] ?? 3) - (order[b.category] ?? 3);
      })
      .slice(0, 5)
      .map((e) => e.summary || e.subject);

    const name = user.preferredName || user.name || user.email.split('@')[0];
    const greeting = this.buildGreeting(user.timezone || 'Europe/Lisbon', name);

    return {
      date,
      greeting,
      summary,
      stats: {
        emailsProcessed: emails.length,
        highPriority: urgentCount,
        needReply: needsReply.length,
        informational: lowPriorityCount,
      },
      categories: {
        highPriority: { count: urgentCount, emails: highPriority.slice(0, 3) },
        needsReply: {
          count: needsReply.length,
          emails: needsReply.slice(0, 3),
        },
        meetings: { count: meetings.length, emails: meetings.slice(0, 3) },
        finance: { count: finance.length, emails: finance.slice(0, 3) },
        updates: { count: lowPriorityCount, emails: updates.slice(0, 3) },
      },
    };
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

  async getStats(email: string) {
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      return {
        total: 0,
        urgent: 0,
        needsReview: 0,
        lowPriority: 0,
        needsReply: 0,
        meetings: 0,
        finance: 0,
        updates: 0,
        topSenders: [],
        upcomingDeadlines: [],
      };
    }

    return this.emailRecordRepo.getStatsForUser(user.id);
  }

  async getDailyBrief(email: string) {
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      return {
        date: new Date().toISOString().split('T')[0],
        greeting: 'Good Day',
        summary: [],
        stats: { emailsProcessed: 0, highPriority: 0, needReply: 0, informational: 0 },
        categories: {
          highPriority: { count: 0, emails: [] },
          needsReply: { count: 0, emails: [] },
          meetings: { count: 0, emails: [] },
          finance: { count: 0, emails: [] },
          updates: { count: 0, emails: [] },
        },
      };
    }

    const today = new Date().toISOString().split('T')[0];
    return this.buildDailyBriefForDate(user, today);
  }

  async getAnalytics(email: string) {
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      return {
        emailsThisWeek: 0,
        averagePerDay: 0,
        categoryBreakdown: { urgent: 0, needsReview: 0, lowPriority: 0 },
        topSenders: [],
        highPriorityCount: 0,
        dailyVolume: [],
      };
    }

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [categoryCounts, weeklyEmails, dailyVolume, topSenders] = await Promise.all([
      this.emailRecordRepo.countByCategory(user.id),
      this.emailRecordRepo.findByUserSince(user.id, weekAgo),
      this.emailRecordRepo.getDailyVolume(user.id, thirtyDaysAgo),
      this.emailRecordRepo.getTopSenders(user.id, 5),
    ]);

    const averagePerDay = dailyVolume.length > 0
      ? Math.round((dailyVolume.reduce((sum, d) => sum + d.count, 0) / dailyVolume.length) * 10) / 10
      : 0;

    return {
      emailsThisWeek: weeklyEmails.length,
      averagePerDay,
      categoryBreakdown: {
        urgent: categoryCounts.urgent,
        needsReview: categoryCounts.needsReview,
        lowPriority: categoryCounts.lowPriority,
      },
      topSenders,
      highPriorityCount: categoryCounts.urgent,
      dailyVolume,
    };
  }

  private buildGreeting(timezone: string, name: string): string {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone: timezone || 'Europe/Lisbon',
      });
      const hour = parseInt(formatter.format(now), 10);

      let period: string;
      if (hour >= 5 && hour < 12) period = 'Morning';
      else if (hour >= 12 && hour < 17) period = 'Afternoon';
      else period = 'Evening';

      return `Good ${period}, ${name}`;
    } catch {
      return `Good Day, ${name}`;
    }
  }

  private async extractIntent(query: string): Promise<ExtractedSearchIntent> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
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
    ];

    try {
      const content = await llmWithFallback(
        this.modelChain,
        async (model) => {
          const response = await this.openai.chat.completions.create({
            model,
            response_format: { type: 'json_object' },
            messages,
          });
          return response.choices[0]?.message?.content || '{}';
        },
        this.logger,
      );
      return JSON.parse(this.repairJson(content));
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

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
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
    ];

    const content = await llmWithFallback(
      this.modelChain,
      async (model) => {
        const response = await this.openai.chat.completions.create({
          model,
          response_format: { type: 'json_object' },
          messages,
        });
        return response.choices[0]?.message?.content || '{}';
      },
      this.logger,
    );

    const parsed = JSON.parse(this.repairJson(content));
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

  /**
   * Attempts to recover a truncated JSON string by closing any open
   * braces/brackets and stripping trailing incomplete key-value pairs.
   * Falls back to '{}' if the result still won't parse.
   */
  private repairJson(raw: string): string {
    // Strip markdown code fences if present
    const stripped = raw.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim();

    // If it already parses, nothing to do
    try {
      JSON.parse(stripped);
      return stripped;
    } catch {
      // fall through to repair
    }

    // Truncate at the last complete value by finding the last full property boundary.
    // Walk backwards and close open structures.
    const stack: string[] = [];
    let inString = false;
    let escape = false;

    for (const ch of stripped) {
      if (escape) { escape = false; continue; }
      if (ch === '\\' && inString) { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{' || ch === '[') stack.push(ch);
      else if (ch === '}' || ch === ']') stack.pop();
    }

    // Close open structures in reverse
    let repaired = stripped;
    // Remove any trailing incomplete token (e.g. partial string or key without value)
    repaired = repaired.replace(/,?\s*"[^"]*$/, '').replace(/,\s*$/, '');

    for (let i = stack.length - 1; i >= 0; i--) {
      repaired += stack[i] === '{' ? '}' : ']';
    }

    try {
      JSON.parse(repaired);
      return repaired;
    } catch {
      return '{}';
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
