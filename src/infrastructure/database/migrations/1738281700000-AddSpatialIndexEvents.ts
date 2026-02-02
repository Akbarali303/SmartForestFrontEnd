import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ensures GIST spatial index exists on events.location for fast bounding-box queries.
 * gist_geometry_ops_2d is optimal for 2D bbox (&&, ST_Within, ST_Intersects).
 * Idempotent: IF NOT EXISTS skips when index already present.
 */
export class AddSpatialIndexEvents1738281700000 implements MigrationInterface {
  name = 'AddSpatialIndexEvents1738281700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_events_location
      ON events USING GIST (location gist_geometry_ops_2d);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_events_location;`);
  }
}
