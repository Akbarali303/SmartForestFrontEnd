import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * forest_areas jadvali boshqa schema (yoki eski migratsiya) bilan yaratilgan bo‘lsa,
 * yetishmayotgan snake_case ustunlarni qo‘shadi.
 */
export class AddForestAreasRegionName1738282000000 implements MigrationInterface {
  name = 'AddForestAreasRegionName1738282000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE forest_areas
      ADD COLUMN IF NOT EXISTS region_name VARCHAR(255);
    `);
    await queryRunner.query(`
      ALTER TABLE forest_areas
      ADD COLUMN IF NOT EXISTS name VARCHAR(255);
    `);
    await queryRunner.query(`
      ALTER TABLE forest_areas
      ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'forest';
    `);
    await queryRunner.query(`
      ALTER TABLE forest_areas
      ADD COLUMN IF NOT EXISTS area_ha DECIMAL(12,2) DEFAULT 0;
    `);
    await queryRunner.query(`
      ALTER TABLE forest_areas
      ADD COLUMN IF NOT EXISTS responsible VARCHAR(255);
    `);
    await queryRunner.query(`
      ALTER TABLE forest_areas
      ADD COLUMN IF NOT EXISTS geom GEOMETRY(Geometry, 4326);
    `);
    await queryRunner.query(`
      ALTER TABLE forest_areas
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
    `);
    await queryRunner.query(`
      ALTER TABLE forest_areas
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Ustunlarni olib tashlash mavjud ma'lumotlarni buzishi mumkin — down bo'sh qoldirildi
  }
}
