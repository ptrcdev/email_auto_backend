import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReminderColumns1719612000001 implements MigrationInterface {
  name = 'AddReminderColumns1719612000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Rename whatsappPromptTime -> reminderTime if it exists, otherwise add the column
    const columns = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'whatsappPromptTime'
    `);

    if (columns.length > 0) {
      await queryRunner.query(`
        ALTER TABLE "users" RENAME COLUMN "whatsappPromptTime" TO "reminderTime"
      `);
    } else {
      await queryRunner.query(`
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reminderTime" varchar NOT NULL DEFAULT '18:00'
      `);
    }

    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reminderEnabled" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "calendarConnected" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pushSubscription" json
    `);

    // Drop archived WhatsApp columns if they still exist
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "whatsappNumber"
    `);

    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "whatsappOptedIn"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "pushSubscription"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "calendarConnected"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "reminderEnabled"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" RENAME COLUMN "reminderTime" TO "whatsappPromptTime"`,
    );
  }
}
