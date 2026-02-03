import { HttpException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

type GeoJSONFeature = {
  type: string;
  properties?: Record<string, unknown>;
  geometry?: { type: string; coordinates: unknown };
};

export type CreateForestAreaDto = {
  geojson: { type: string; features?: unknown[] };
  regionName?: string;
  forestName?: string;
};

@Injectable()
export class ForestAreasService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** forest_areas jadvali yo'q bo'lsa yaratadi (migratsiya ishlamasa ham) */
  private async ensureForestAreasTable(): Promise<void> {
    try {
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS forest_areas (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          region_name VARCHAR(255),
          name VARCHAR(255),
          type VARCHAR(50) NOT NULL DEFAULT 'forest',
          area_ha DECIMAL(12,2) NOT NULL DEFAULT 0,
          geom GEOMETRY(Geometry, 4326),
          responsible VARCHAR(255),
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          organization VARCHAR(255),
          inn VARCHAR(50)
        )
      `);
    } catch {
      // Jadval boshqa schema bilan mavjud bo'lishi mumkin
    }
  }

  /** Jadvalda kerakli ustunlar borligini ta'minlaydi (migratsiya ishlamasa ham) */
  private async ensureForestAreasColumns(): Promise<void> {
    await this.ensureForestAreasTable();
    // geom ustuni Polygon bo'lsa Geometry ga o'zgartirish (MultiPolygon qabul qilishi uchun)
    try {
      await this.dataSource.query(`
        ALTER TABLE forest_areas
        ALTER COLUMN geom TYPE GEOMETRY(Geometry, 4326)
        USING geom::geometry(Geometry, 4326)
      `);
    } catch {
      // Ustun yo'q yoki allaqachon Geometry — e'tiborsiz
    }
    const alters = [
      `ALTER TABLE forest_areas ADD COLUMN IF NOT EXISTS region_name VARCHAR(255)`,
      `ALTER TABLE forest_areas ADD COLUMN IF NOT EXISTS name VARCHAR(255)`,
      `ALTER TABLE forest_areas ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'forest'`,
      `ALTER TABLE forest_areas ADD COLUMN IF NOT EXISTS area_ha DECIMAL(12,2) DEFAULT 0`,
      `ALTER TABLE forest_areas ADD COLUMN IF NOT EXISTS responsible VARCHAR(255)`,
      `ALTER TABLE forest_areas ADD COLUMN IF NOT EXISTS geom GEOMETRY(Geometry, 4326)`,
      `ALTER TABLE forest_areas ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now()`,
      `ALTER TABLE forest_areas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()`,
      `ALTER TABLE forest_areas ADD COLUMN IF NOT EXISTS organization VARCHAR(255)`,
      `ALTER TABLE forest_areas ADD COLUMN IF NOT EXISTS inn VARCHAR(50)`,
    ];
    for (const sql of alters) {
      try {
        await this.dataSource.query(sql);
      } catch {
        // Jadval yo‘q yoki boshqa xato — asosiy INSERT xatosini ko‘rsatamiz
      }
    }
  }

  async create(dto: CreateForestAreaDto): Promise<{ saved: number; ids: string[] }> {
    const features = dto.geojson?.features ?? [];
    const regionName = dto.regionName ?? null;
    const forestName = dto.forestName ?? null;
    const ids: string[] = [];

    try {
      await this.ensureForestAreasColumns();

      for (const feat of features) {
        const f = feat as GeoJSONFeature;
        if (!f.geometry || (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon')) continue;
        const name =
          (f.properties?.name as string) ?? (f.properties?.region as string) ?? forestName ?? 'Hudud';
        const nameNorm = (name || '').trim() || 'Hudud';
        const type = ((f.properties?.type as string) ?? 'forest').toLowerCase();
        const areaHa = Number(f.properties?.area_ha) ?? 0;
        const responsible = (f.properties?.responsible as string) ?? null;
        const geomJson = JSON.stringify(f.geometry);

        const rows = await this.dataSource.query(
          `INSERT INTO forest_areas (region_name, name, type, area_ha, geom, responsible)
           VALUES ($1, $2, $3, $4, ST_SetSRID(ST_GeomFromGeoJSON($5), 4326), $6)
           RETURNING id`,
          [regionName, nameNorm, type, areaHa, geomJson, responsible],
        );
        if (rows?.[0]?.id) ids.push(rows[0].id);
      }
      return { saved: ids.length, ids };
    } catch (err: unknown) {
      if (err instanceof HttpException) throw err;
      const message = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(
        `forest_areas saqlashda xato: ${message}`,
      );
    }
  }

  async findAll(): Promise<unknown[]> {
    try {
      await this.ensureForestAreasColumns();
      const rows = await this.dataSource.query(
        `SELECT id, region_name, name, type, area_ha, responsible, created_at,
                organization, inn,
                ST_X(ST_Centroid(geom)) AS lng, ST_Y(ST_Centroid(geom)) AS lat,
                ST_AsGeoJSON(geom)::json AS geometry
         FROM forest_areas
         ORDER BY created_at DESC
         LIMIT 500`,
      );
      return rows ?? [];
    } catch {
      return [];
    }
  }

  async update(
    id: string,
    body: { name?: string; region_name?: string; type?: string; area_ha?: number; responsible?: string; organization?: string; inn?: string },
  ): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (body.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(body.name);
    }
    if (body.region_name !== undefined) {
      fields.push(`region_name = $${idx++}`);
      values.push(body.region_name);
    }
    if (body.type !== undefined) {
      fields.push(`type = $${idx++}`);
      values.push(body.type);
    }
    if (body.area_ha !== undefined) {
      fields.push(`area_ha = $${idx++}`);
      values.push(body.area_ha);
    }
    if (body.responsible !== undefined) {
      fields.push(`responsible = $${idx++}`);
      values.push(body.responsible);
    }
    if (body.organization !== undefined) {
      fields.push(`organization = $${idx++}`);
      values.push(body.organization);
    }
    if (body.inn !== undefined) {
      fields.push(`inn = $${idx++}`);
      values.push(body.inn);
    }
    if (fields.length === 0) return;
    values.push(id);
    await this.dataSource.query(
      `UPDATE forest_areas SET ${fields.join(', ')} WHERE id = $${idx}`,
      values,
    );
  }

  async remove(id: string): Promise<void> {
    await this.dataSource.query(`DELETE FROM forest_areas WHERE id = $1`, [id]);
  }

  async removeAll(): Promise<void> {
    await this.dataSource.query(`DELETE FROM forest_areas`);
  }
}
