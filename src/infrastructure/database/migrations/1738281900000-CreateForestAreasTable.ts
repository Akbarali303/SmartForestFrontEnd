import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateForestAreasTable1738281900000 implements MigrationInterface {
  name = 'CreateForestAreasTable1738281900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE forest_areas (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        region_name VARCHAR(255),
        name VARCHAR(255),
        type VARCHAR(50) NOT NULL DEFAULT 'forest',
        area_ha DECIMAL(12,2) NOT NULL DEFAULT 0,
        geom GEOMETRY(Geometry, 4326),
        responsible VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`
      CREATE TRIGGER forest_areas_updated_at
      BEFORE UPDATE ON forest_areas
      FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
    `);
    await queryRunner.query(`
      CREATE INDEX idx_forest_areas_geom ON forest_areas USING GIST (geom);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_forest_areas_region ON forest_areas(region_name);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS forest_areas;`);
  }
}
