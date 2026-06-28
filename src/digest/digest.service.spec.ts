import { Test, TestingModule } from '@nestjs/testing';
import { DigestService } from './digest.service';
import { ConfigService } from '@nestjs/config';
import { EmailRecord } from '../entities/email-record.entity';

describe('DigestService', () => {
  let service: DigestService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DigestService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(() => undefined),
          },
        },
      ],
    }).compile();

    service = module.get<DigestService>(DigestService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('buildDigestEmail', () => {
    it('should categorize emails correctly', () => {
      const emails: Partial<EmailRecord>[] = [
        {
          id: '1',
          category: 'urgent',
          subject: 'Urgent permit',
          sender: 'test@test.com',
        },
        {
          id: '2',
          category: 'needs_review',
          subject: 'Invoice',
          sender: 'test@test.com',
        },
        {
          id: '3',
          category: 'low_priority',
          subject: 'Newsletter',
          sender: 'test@test.com',
        },
        {
          id: '4',
          category: 'urgent',
          subject: 'Contract',
          sender: 'test@test.com',
        },
      ];

      const result = service.buildDigestEmail(
        emails as EmailRecord[],
        '2026-06-26',
      );

      expect(result.urgent.length).toBe(2);
      expect(result.needsReview.length).toBe(1);
      expect(result.lowPriority.length).toBe(1);
    });

    it('should sort urgent emails with deadlines first', () => {
      const emails: Partial<EmailRecord>[] = [
        {
          id: '1',
          category: 'urgent',
          subject: 'Contract',
          sender: 'test@test.com',
          extractedFields: {},
        },
        {
          id: '2',
          category: 'urgent',
          subject: 'Permit',
          sender: 'test@test.com',
          extractedFields: { deadline: 'today' },
        },
      ];

      const result = service.buildDigestEmail(
        emails as EmailRecord[],
        '2026-06-26',
      );

      expect(result.urgent[0].subject).toBe('Permit');
    });
  });

  describe('renderHtml', () => {
    it('should render HTML with correct counts', () => {
      const digest = {
        urgent: [
          {
            id: '1',
            category: 'urgent' as const,
            subject: 'Urgent permit',
            sender: 'test@test.com',
            summary: 'Permit issue',
            suggestedAction: 'reply',
            extractedFields: { deadline: 'today' },
          } as EmailRecord,
        ],
        needsReview: [
          {
            id: '2',
            category: 'needs_review' as const,
            subject: 'Invoice',
            sender: 'test@test.com',
            summary: 'Invoice review',
            suggestedAction: 'review',
            extractedFields: { amount: '€24,000' },
          } as EmailRecord,
        ],
        lowPriority: [
          {
            id: '3',
            category: 'low_priority' as const,
            subject: 'Newsletter',
            sender: 'test@test.com',
          } as EmailRecord,
        ],
      };

      const html = service.renderHtml(digest, 'Thursday, June 26');

      expect(html).toContain('1 urgent');
      expect(html).toContain('1 need review');
      expect(html).toContain('1 low priority');
      expect(html).toContain('Urgent');
      expect(html).toContain('Needs Review');
      expect(html).toContain('€24,000');
      expect(html).toContain('reply');
    });
  });
});
