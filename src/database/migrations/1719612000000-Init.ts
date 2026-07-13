import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1719612000000 implements MigrationInterface {
  name = 'Init1719612000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "email" varchar NOT NULL UNIQUE,
        "name" varchar,

        "whatsappNumber" varchar,
        "whatsappOptedIn" boolean NOT NULL DEFAULT false,

        "googleAccessToken" varchar,
        "googleRefreshToken" varchar,
        "googleTokenExpiry" TIMESTAMP,

        "microsoftAccessToken" varchar,
        "microsoftRefreshToken" varchar,
        "microsoftTokenExpiry" TIMESTAMP,

        "emailProvider" varchar NOT NULL DEFAULT 'google',

        "digestTime" varchar NOT NULL DEFAULT '08:00',
        "whatsappPromptTime" varchar NOT NULL DEFAULT '18:00',
        "timezone" varchar NOT NULL DEFAULT 'Europe/Lisbon',

        "priorityDecayDays" integer NOT NULL DEFAULT 3,

        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "priorities" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,

        "rawText" text NOT NULL,
        "extractedEntities" jsonb,

        "active" boolean NOT NULL DEFAULT true,
        "expiresAt" TIMESTAMP,

        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "email_records" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,

        "gmailMessageId" varchar NOT NULL,
        "subject" varchar NOT NULL,
        "sender" varchar NOT NULL,

        "bodyPreview" text,
        "receivedAt" TIMESTAMP NOT NULL,

        "category" varchar NOT NULL DEFAULT 'low_priority',
        "summary" text,
        "suggestedAction" text,
        "extractedFields" jsonb,

        "includedInDigest" boolean NOT NULL DEFAULT false,
        "digestId" varchar,

        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "digests" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,

        "sentAt" TIMESTAMP NOT NULL,
        "date" varchar NOT NULL,

        "urgentCount" integer NOT NULL DEFAULT 0,
        "needsReviewCount" integer NOT NULL DEFAULT 0,
        "lowPriorityCount" integer NOT NULL DEFAULT 0,

        "opened" boolean NOT NULL DEFAULT false,
        "openedAt" TIMESTAMP,

        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    // Foreign keys (clean + explicit)
    await queryRunner.query(`
      ALTER TABLE "priorities"
      ADD CONSTRAINT "FK_priorities_user"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "email_records"
      ADD CONSTRAINT "FK_email_records_user"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "digests"
      ADD CONSTRAINT "FK_digests_user"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "digests" DROP CONSTRAINT "FK_digests_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_records" DROP CONSTRAINT "FK_email_records_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "priorities" DROP CONSTRAINT "FK_priorities_user"`,
    );

    await queryRunner.query(`DROP TABLE "digests"`);
    await queryRunner.query(`DROP TABLE "email_records"`);
    await queryRunner.query(`DROP TABLE "priorities"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
