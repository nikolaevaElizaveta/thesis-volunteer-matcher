import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds generated geography(Point,4326) from (lon, lat) + GiST index for ST_DWithin / map queries.
 * Requires PostGIS. Source of truth for coordinates remains lat/lon columns and the matcher.
 */
export class AddPostgisGeographyColumns1738867200000 implements MigrationInterface {
  name = 'AddPostgisGeographyColumns1738867200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);

    await queryRunner.query(`
      ALTER TABLE "shelter_tasks"
      ADD COLUMN IF NOT EXISTS "geog" geography(Point,4326)
      GENERATED ALWAYS AS (
        ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography
      ) STORED
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_shelter_tasks_geog"
      ON "shelter_tasks" USING GIST ("geog")
    `);

    await queryRunner.query(`
      ALTER TABLE "volunteer_offers"
      ADD COLUMN IF NOT EXISTS "geog" geography(Point,4326)
      GENERATED ALWAYS AS (
        ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography
      ) STORED
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_volunteer_offers_geog"
      ON "volunteer_offers" USING GIST ("geog")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_volunteer_offers_geog"`,
    );
    await queryRunner.query(
      `ALTER TABLE "volunteer_offers" DROP COLUMN IF EXISTS "geog"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_shelter_tasks_geog"`);
    await queryRunner.query(
      `ALTER TABLE "shelter_tasks" DROP COLUMN IF EXISTS "geog"`,
    );
    // Do not DROP EXTENSION postgis — may be shared / used elsewhere
  }
}
