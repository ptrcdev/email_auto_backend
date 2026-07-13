import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCalendarTokenColumns1719612000003 implements MigrationInterface {
  name = 'AddCalendarTokenColumns1719612000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "calendarAccessToken" varchar,
        ADD COLUMN IF NOT EXISTS "calendarRefreshToken" varchar,
        ADD COLUMN IF NOT EXISTS "calendarTokenExpiry" TIMESTAMP
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "calendarAccessToken",
        DROP COLUMN IF EXISTS "calendarRefreshToken",
        DROP COLUMN IF EXISTS "calendarTokenExpiry"
    `);
  }
}
