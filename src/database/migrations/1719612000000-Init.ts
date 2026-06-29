import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1719612000000 implements MigrationInterface {
  name = 'Init1719612000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "name" character varying,
        "whatsappNumber" character varying,
        "whatsappOptedIn" boolean NOT NULL DEFAULT false,
        "googleAccessToken" character varying,
        "googleRefreshToken" character varying,
        "googleTokenExpiry" TIMESTAMP,
        "microsoftAccessToken" character varying,
        "microsoftRefreshToken" character varying,
        "microsoftTokenExpiry" TIMESTAMP,
        "emailProvider" character varying NOT NULL DEFAULT 'google',
        "digestTime" character varying NOT NULL DEFAULT '08:00',
        "whatsappPromptTime" character varying NOT NULL DEFAULT '18:00',
        "timezone" character varying NOT NULL DEFAULT 'Europe/Lisbon',
        "priorityDecayDays" integer NOT NULL DEFAULT 3,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "priorities" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "rawText" text NOT NULL,
        "extractedEntities" json,
        "active" boolean NOT NULL DEFAULT true,
        "expiresAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_priorities" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "email_records" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "gmailMessageId" character varying NOT NULL,
        "subject" character varying NOT NULL,
        "sender" character varying NOT NULL,
        "bodyPreview" text,
        "receivedAt" TIMESTAMP NOT NULL,
        "category" character varying NOT NULL DEFAULT 'low_priority',
        "summary" text,
        "suggestedAction" text,
        "extractedFields" json,
        "includedInDigest" boolean NOT NULL DEFAULT false,
        "digestId" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_email_records" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "digests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "sentAt" TIMESTAMP NOT NULL,
        "date" character varying NOT NULL,
        "urgentCount" integer NOT NULL DEFAULT 0,
        "needsReviewCount" integer NOT NULL DEFAULT 0,
        "lowPriorityCount" integer NOT NULL DEFAULT 0,
        "opened" boolean NOT NULL DEFAULT false,
        "openedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_digests" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "priorities" ADD CONSTRAINT "FK_priorities_userId"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "email_records" ADD CONSTRAINT "FK_email_records_userId"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "digests" ADD CONSTRAINT "FK_digests_userId"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "digests" DROP CONSTRAINT "FK_digests_userId"`);
    await queryRunner.query(`ALTER TABLE "email_records" DROP CONSTRAINT "FK_email_records_userId"`);
    await queryRunner.query(`ALTER TABLE "priorities" DROP CONSTRAINT "FK_priorities_userId"`);
    await queryRunner.query(`DROP TABLE "digests"`);
    await queryRunner.query(`DROP TABLE "email_records"`);
    await queryRunner.query(`DROP TABLE "priorities"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
