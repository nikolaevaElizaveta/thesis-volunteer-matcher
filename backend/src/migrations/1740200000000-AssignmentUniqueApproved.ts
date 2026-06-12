import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * One approved assignment per task and per volunteer offer.
 * Removes legacy duplicates (newest row wins) before adding partial unique indexes.
 */
export class AssignmentUniqueApproved1740200000000 implements MigrationInterface {
  name = 'AssignmentUniqueApproved1740200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM assignments a
      USING assignments b
      WHERE a.status = 'approved'
        AND b.status = 'approved'
        AND a.shelter_task_id = b.shelter_task_id
        AND a.created_at < b.created_at
    `);
    await queryRunner.query(`
      DELETE FROM assignments a
      USING assignments b
      WHERE a.status = 'approved'
        AND b.status = 'approved'
        AND a.volunteer_offer_id = b.volunteer_offer_id
        AND a.created_at < b.created_at
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_assignments_approved_shelter_task_id"
      ON "assignments" ("shelter_task_id")
      WHERE "status" = 'approved'
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_assignments_approved_volunteer_offer_id"
      ON "assignments" ("volunteer_offer_id")
      WHERE "status" = 'approved'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_assignments_approved_volunteer_offer_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_assignments_approved_shelter_task_id"`,
    );
  }
}
