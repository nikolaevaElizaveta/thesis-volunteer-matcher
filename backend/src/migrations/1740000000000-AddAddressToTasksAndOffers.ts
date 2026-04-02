import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAddressToTasksAndOffers1740000000000
  implements MigrationInterface
{
  name = 'AddAddressToTasksAndOffers1740000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "shelter_tasks" ADD COLUMN IF NOT EXISTS "address" character varying(512)`,
    );
    await queryRunner.query(
      `ALTER TABLE "volunteer_offers" ADD COLUMN IF NOT EXISTS "address" character varying(512)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "volunteer_offers" DROP COLUMN IF EXISTS "address"`,
    );
    await queryRunner.query(
      `ALTER TABLE "shelter_tasks" DROP COLUMN IF EXISTS "address"`,
    );
  }
}
