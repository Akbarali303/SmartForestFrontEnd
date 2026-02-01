import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates land_parcels table for lease/available areas with PostGIS geometry.
 * SRID 4326 (WGS84).
 */
export class CreateLandParcelsTable1738281900000 implements MigrationInterface {
  name = 'CreateLandParcelsTable1738281900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE land_parcels (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        region VARCHAR(100) NOT NULL,
        area_ha DECIMAL(12,2),
        lease_status VARCHAR(20) NOT NULL DEFAULT 'leased',
        lease_holder VARCHAR(255),
        contract_number VARCHAR(100),
        contract_start DATE,
        contract_expiry DATE,
        geom GEOMETRY(Polygon, 4326) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_land_parcels_geom
      ON land_parcels USING GIST (geom);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_land_parcels_lease_status
      ON land_parcels (lease_status);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS land_parcels;`);
  }
}
