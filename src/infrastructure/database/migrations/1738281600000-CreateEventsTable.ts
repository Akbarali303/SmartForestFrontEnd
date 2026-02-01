import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEventsTable1738281600000 implements MigrationInterface {
  name = 'CreateEventsTable1738281600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS postgis;
    `);

    await queryRunner.query(`
      CREATE TABLE events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        location GEOMETRY(Point, 4326) NOT NULL,
        severity VARCHAR(20) NOT NULL DEFAULT 'medium',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION set_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER events_updated_at
      BEFORE UPDATE ON events
      FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
    `);

    await queryRunner.query(`
      CREATE INDEX idx_events_location ON events USING GIST (location gist_geometry_ops_2d);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_events_created_at ON events(created_at);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_events_severity ON events(severity);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS events;`);
  }
}
