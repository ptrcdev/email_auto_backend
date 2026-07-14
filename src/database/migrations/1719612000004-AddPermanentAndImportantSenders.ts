import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPermanentAndImportantSenders1719612000004
  implements MigrationInterface
{
  name = 'AddPermanentAndImportantSenders1719612000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "priorities" ADD COLUMN IF NOT EXISTS "permanent" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "importantSenders" json
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "importantSenders"`,
    );
    await queryRunner.query(
      `ALTER TABLE "priorities" DROP COLUMN IF EXISTS "permanent"`,
    );
  }
}
