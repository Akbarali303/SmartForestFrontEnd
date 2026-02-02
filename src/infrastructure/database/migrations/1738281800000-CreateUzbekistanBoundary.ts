import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates uzbekistan_boundary table for spatial filtering of events.
 * SRID 4326 (WGS84). Populate via: npm run seed:uzbekistan-boundary
 */
export class CreateUzbekistanBoundary1738281800000 implements MigrationInterface {
  name = 'CreateUzbekistanBoundary1738281800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE uzbekistan_boundary (
        id SERIAL PRIMARY KEY,
        geom GEOMETRY(MultiPolygon, 4326) NOT NULL
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_uzbekistan_boundary_geom
      ON uzbekistan_boundary USING GIST (geom gist_geometry_ops_2d);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS uzbekistan_boundary;`);
  }
}
