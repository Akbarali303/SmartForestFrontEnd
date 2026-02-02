import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

type GeoJSONFeature = {
  type: string;
  properties?: Record<string, unknown>;
  geometry?: { type: string; coordinates: unknown };
};

type CreateForestAreaDto = {
  geojson: { type: string; features?: GeoJSONFeature[] };
  regionName?: string;
};

@Injectable()
export class ForestAreasService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async create(dto: CreateForestAreaDto): Promise<{ saved: number; ids: string[] }> {
    const features = dto.geojson?.features ?? [];
    const regionName = dto.regionName ?? null;
    const ids: string[] = [];

    for (const f of features) {
      if (!f.geometry || (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon')) continue;
      const name = (f.properties?.name as string) ?? (f.properties?.region as string) ?? 'Hudud';
      const type = ((f.properties?.type as string) ?? 'forest').toLowerCase();
      const areaHa = Number(f.properties?.area_ha) ?? 0;
      const responsible = (f.properties?.responsible as string) ?? null;
      const geomJson = JSON.stringify(f.geometry);

      const rows = await this.dataSource.query(
        `INSERT INTO forest_areas (region_name, name, type, area_ha, geom, responsible)
         VALUES ($1, $2, $3, $4, ST_SetSRID(ST_GeomFromGeoJSON($5), 4326), $6)
         RETURNING id`,
        [regionName, name, type, areaHa, geomJson, responsible],
      );
      if (rows?.[0]?.id) ids.push(rows[0].id);
    }

    return { saved: ids.length, ids };
  }

  async findAll(): Promise<unknown[]> {
    const rows = await this.dataSource.query(
      `SELECT id, region_name, name, type, area_ha, responsible, created_at,
              ST_AsGeoJSON(geom)::json AS geometry
       FROM forest_areas
       ORDER BY created_at DESC
       LIMIT 500`,
    );
    return rows ?? [];
  }
}
