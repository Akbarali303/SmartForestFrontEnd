import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface CreateForestAreaDto {
  name?: string;
  geometry: GeoJSON.Polygon;
}

@Injectable()
export class ForestAreasService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findAll(): Promise<GeoJSON.FeatureCollection> {
    const rows = await this.dataSource.query(
      `SELECT id, name, created_at, ST_AsGeoJSON(geom)::json AS geom
       FROM forest_areas
       ORDER BY created_at DESC`,
    );
    const features: GeoJSON.Feature[] = rows.map((r: { geom: { type: string; coordinates: number[][][] }; [k: string]: unknown }) => {
      const geom = r.geom as { type: string; coordinates: number[][][] };
      return {
        type: 'Feature',
        properties: { id: r.id, name: r.name || `O'rmon ${r.id}`, created_at: r.created_at },
        geometry: geom,
      };
    });
    return { type: 'FeatureCollection', features };
  }

  async create(dto: CreateForestAreaDto): Promise<{ id: number }> {
    const rows = await this.dataSource.query(
      `INSERT INTO forest_areas (name, geom)
       VALUES ($1, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326))
       RETURNING id`,
      [dto.name || null, JSON.stringify({ type: 'Polygon', coordinates: dto.geometry.coordinates })],
    );
    return { id: rows[0].id };
  }

  async remove(id: number): Promise<void> {
    await this.dataSource.query(`DELETE FROM forest_areas WHERE id = $1`, [id]);
  }
}
