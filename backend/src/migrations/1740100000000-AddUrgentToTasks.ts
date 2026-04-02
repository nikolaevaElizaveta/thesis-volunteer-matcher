import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUrgentToTasks1740100000000 implements MigrationInterface {
  name = 'AddUrgentToTasks1740100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "shelter_tasks" ADD COLUMN IF NOT EXISTS "urgent" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "shelter_tasks" DROP COLUMN IF EXISTS "urgent"`,
    );
  }
}
