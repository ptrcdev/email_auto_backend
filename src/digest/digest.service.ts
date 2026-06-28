import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailRecord, EmailCategory } from '../entities/email-record.entity.js';
import { User } from '../entities/user.entity.js';

export interface DigestEmail {
  urgent: EmailRecord[];
  needsReview: EmailRecord[];
  lowPriority: EmailRecord[];
}

@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);

  constructor(private readonly configService: ConfigService) {}

  buildDigestEmail(emails: EmailRecord[], date: string): DigestEmail {
    const urgent = emails
      .filter((e) => e.category === 'urgent')
      .sort((a, b) => {
        const aPriority = a.extractedFields?.deadline ? 0 : 1;
        const bPriority = b.extractedFields?.deadline ? 0 : 1;
        return aPriority - bPriority;
      });

    const needsReview = emails.filter((e) => e.category === 'needs_review');
    const lowPriority = emails.filter((e) => e.category === 'low_priority');

    return { urgent, needsReview, lowPriority };
  }

  renderHtml(digest: DigestEmail, date: string): string {
    const urgentCount = digest.urgent.length;
    const needsReviewCount = digest.needsReview.length;
    const lowPriorityCount = digest.lowPriority.length;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Morning Digest</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <tr>
      <td style="padding: 32px 24px 16px;">
        <h1 style="margin: 0; font-size: 24px; color: #1a1a1a; font-weight: 600;">
          Your morning digest
        </h1>
        <p style="margin: 8px 0 0; font-size: 14px; color: #666666;">
          ${date}
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 0 24px 24px;">
        <p style="margin: 0; font-size: 15px; color: #333333;">
          ${urgentCount} urgent · ${needsReviewCount} need review · ${lowPriorityCount} low priority
        </p>
      </td>
    </tr>

    ${
      urgentCount > 0
        ? `
    <tr>
      <td style="padding: 0 24px 8px;">
        <h2 style="margin: 0; font-size: 16px; color: #cc0000; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
          Urgent
        </h2>
      </td>
    </tr>
    ${digest.urgent
      .map(
        (email) => `
    <tr>
      <td style="padding: 12px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fff5f5; border-left: 4px solid #cc0000; border-radius: 4px;">
          <tr>
            <td style="padding: 16px;">
              <p style="margin: 0 0 4px; font-size: 15px; font-weight: 600; color: #1a1a1a;">
                ${this.escapeHtml(email.subject)}
              </p>
              <p style="margin: 0 0 8px; font-size: 13px; color: #666666;">
                From: ${this.escapeHtml(email.sender)}
              </p>
              <p style="margin: 0 0 8px; font-size: 14px; color: #333333; line-height: 1.5;">
                ${this.escapeHtml(email.summary || '')}
              </p>
              ${
                email.extractedFields?.deadline
                  ? `
              <p style="margin: 0 0 4px; font-size: 13px; color: #cc0000;">
                Deadline: ${this.escapeHtml(email.extractedFields.deadline)}
              </p>`
                  : ''
              }
              ${
                email.extractedFields?.amount
                  ? `
              <p style="margin: 0 0 4px; font-size: 13px; color: #333333;">
                Amount: ${this.escapeHtml(email.extractedFields.amount)}
              </p>`
                  : ''
              }
              <p style="margin: 8px 0 0; font-size: 13px; color: #0066cc;">
                Suggested action: ${this.escapeHtml(email.suggestedAction || 'review')}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`,
      )
      .join('')}
    `
        : ''
    }

    ${
      needsReviewCount > 0
        ? `
    <tr>
      <td style="padding: 16px 24px 8px;">
        <h2 style="margin: 0; font-size: 16px; color: #cc6600; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
          Needs Review
        </h2>
      </td>
    </tr>
    ${digest.needsReview
      .map(
        (email) => `
    <tr>
      <td style="padding: 12px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fffbf0; border-left: 4px solid #cc6600; border-radius: 4px;">
          <tr>
            <td style="padding: 16px;">
              <p style="margin: 0 0 4px; font-size: 15px; font-weight: 600; color: #1a1a1a;">
                ${this.escapeHtml(email.subject)}
              </p>
              <p style="margin: 0 0 8px; font-size: 13px; color: #666666;">
                From: ${this.escapeHtml(email.sender)}
              </p>
              <p style="margin: 0 0 8px; font-size: 14px; color: #333333; line-height: 1.5;">
                ${this.escapeHtml(email.summary || '')}
              </p>
              ${
                email.extractedFields?.amount
                  ? `
              <p style="margin: 0 0 4px; font-size: 13px; color: #333333;">
                Amount: ${this.escapeHtml(email.extractedFields.amount)}
              </p>`
                  : ''
              }
              <p style="margin: 8px 0 0; font-size: 13px; color: #0066cc;">
                Suggested action: ${this.escapeHtml(email.suggestedAction || 'review')}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`,
      )
      .join('')}
    `
        : ''
    }

    ${
      lowPriorityCount > 0
        ? `
    <tr>
      <td style="padding: 16px 24px 8px;">
        <h2 style="margin: 0; font-size: 16px; color: #666666; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
          Low Priority
        </h2>
      </td>
    </tr>
    <tr>
      <td style="padding: 8px 24px 24px;">
        <p style="margin: 0; font-size: 14px; color: #666666; line-height: 1.5;">
          ${lowPriorityCount} newsletters and FYI threads — no action needed.
        </p>
      </td>
    </tr>`
        : ''
    }

    <tr>
      <td style="padding: 24px; border-top: 1px solid #eeeeee;">
        <p style="margin: 0; font-size: 12px; color: #999999; text-align: center;">
          This digest was generated automatically. No emails were sent, deleted, or modified on your behalf.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
