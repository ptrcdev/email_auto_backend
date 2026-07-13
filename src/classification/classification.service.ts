import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { EmailCategory } from '../entities/email-record.entity.js';
import { RawEmail } from '../email/email.service.js';
import { Priority } from '../entities/priority.entity.js';

export interface ClassificationResult {
  category: EmailCategory;
  summary: string;
  suggestedAction: string;
  extractedFields: {
    amount?: string;
    projectName?: string;
    deadline?: string;
    senderRole?: string;
  };
}

@Injectable()
export class ClassificationService {
  private readonly logger = new Logger(ClassificationService.name);
  private openai: OpenAI;

  constructor(private readonly configService: ConfigService) {
    this.openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: configService.get<string>('OPENROUTER_API_KEY'),
    });
  }

  async classifyEmails(
    emails: RawEmail[],
    priorities: Priority[],
  ): Promise<Map<string, ClassificationResult>> {
    const results = new Map<string, ClassificationResult>();

    const priorityContext =
      priorities.length > 0
        ? `\n\nUser's stated priorities for tomorrow:\n${priorities.map((p) => `- "${p.rawText}"`).join('\n')}`
        : '';

    for (const email of emails) {
      try {
        const result = await this.classifyOne(email, priorityContext);
        results.set(email.id, result);
      } catch (error) {
        this.logger.error(`Failed to classify email ${email.id}:`, error);
        results.set(email.id, {
          category: 'low_priority',
          summary: email.subject,
          suggestedAction: 'no action',
          extractedFields: {},
        });
      }
    }

    return results;
  }

  private async classifyOne(
    email: RawEmail,
    priorityContext: string,
  ): Promise<ClassificationResult> {
    const response = await this.openai.chat.completions.create({
      model: this.configService.get<string>(
        'LLM_MODEL',
        'anthropic/claude-sonnet-4-20250514',
      ),
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are an email classifier for a busy real estate/construction professional. Classify emails and extract key information. Always respond with valid JSON matching the required schema.`,
        },
        {
          role: 'user',
          content: `Classify this email:

From: ${email.sender}
Subject: ${email.subject}
Preview: ${email.bodyPreview}
${priorityContext}

Respond with a JSON object with these fields:
{
  "category": "urgent" | "needs_review" | "low_priority",
  "summary": "one plain-language sentence describing what this email is about",
  "suggestedAction": "reply" | "approve" | "forward" | "no action",
  "extractedFields": {
    "amount": "monetary amount if present, or null",
    "projectName": "project name if mentioned, or null",
    "deadline": "deadline if mentioned, or null",
    "senderRole": "role of sender if inferable (e.g. architect, contractor, lawyer, bank, municipality), or null"
  }
}

Classification rules:
- "urgent": time-sensitive, blocks a project/deal, or matches a stated priority
- "needs_review": requires a decision or careful reading but not immediately blocking
- "low_priority": informational, newsletters, FYI, no action needed

Prioritize user's stated priorities. If an email matches someone or something the user mentioned, it's more likely urgent.`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed: {
      category?: string;
      summary?: string;
      suggestedAction?: string;
      extractedFields?: {
        amount?: string;
        projectName?: string;
        deadline?: string;
        senderRole?: string;
      };
    } = JSON.parse(content);

    return {
      category: (parsed.category || 'low_priority') as EmailCategory,
      summary: parsed.summary || email.subject,
      suggestedAction: parsed.suggestedAction || 'no action',
      extractedFields: {
        amount: parsed.extractedFields?.amount || undefined,
        projectName: parsed.extractedFields?.projectName || undefined,
        deadline: parsed.extractedFields?.deadline || undefined,
        senderRole: parsed.extractedFields?.senderRole || undefined,
      },
    };
  }
}
