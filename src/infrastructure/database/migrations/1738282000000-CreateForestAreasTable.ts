import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates forest_areas table for user-drawn forest zones.
 * SRID 4326 (WGS84).
 */
export class CreateForestAreasTable1738282000000 implements MigrationInterface {
  name = 'CreateForestAreasTable1738282000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE forest_areas (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        geom GEOMETRY(Polygon, 4326) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_forest_areas_geom
      ON forest_areas USING GIST (geom);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS forest_areas;`);
  }
}
