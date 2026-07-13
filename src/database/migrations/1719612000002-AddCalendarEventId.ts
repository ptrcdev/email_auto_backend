import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCalendarEventId1719612000002 implements MigrationInterface {
  name = 'AddCalendarEventId1719612000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "calendarEventId" varchar
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "calendarEventId"`,
    );
  }
}
