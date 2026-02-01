import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface CreateLandParcelDto {
  name: string;
  region: string;
  lease_holder?: string;
  contract_number?: string;
  contract_start?: string;
  contract_expiry?: string;
  geometry: GeoJSON.Polygon;
}

export interface LandParcelRow {
  id: number;
  name: string;
  region: string;
  area_ha: number | string;
  lease_status: string;
  lease_holder: string | null;
  contract_number: string | null;
  contract_start: string | null;
  contract_expiry: string | null;
  latitude: number;
  longitude: number;
  geom: unknown;
  created_at: string;
}

@Injectable()
export class LandParcelsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findAll(): Promise<GeoJSON.FeatureCollection> {
    const rows = await this.dataSource.query(
      `SELECT id, name, region, area_ha, lease_status, lease_holder,
              contract_number, contract_start, contract_expiry, created_at,
              ST_AsGeoJSON(geom)::json AS geom
       FROM land_parcels
       ORDER BY created_at DESC`,
    );
    const features: GeoJSON.Feature[] = rows.map((r: { geom: { type: string; coordinates: number[][][] }; [k: string]: unknown }) => {
      const geom = r.geom as { type: string; coordinates: number[][][] };
      const props: Record<string, unknown> = {
        id: `L-${String(r.id).padStart(3, '0')}`,
        name: r.name,
        region: r.region,
        area_ha: r.area_ha != null ? Number(r.area_ha) : null,
        lease_status: r.lease_status,
        lease_holder: r.lease_holder,
        contract_number: r.contract_number,
        contract_start: r.contract_start ? String(r.contract_start).slice(0, 10) : null,
        contract_expiry: r.contract_expiry ? String(r.contract_expiry).slice(0, 10) : null,
      };
      return {
        type: 'Feature',
        properties: props,
        geometry: geom,
      };
    });
    return { type: 'FeatureCollection', features };
  }

  async create(dto: CreateLandParcelDto): Promise<{ id: number }> {
    const rows = await this.dataSource.query(
      `INSERT INTO land_parcels (name, region, lease_status, lease_holder, contract_number, contract_start, contract_expiry, geom)
       VALUES ($1, $2, 'leased', $3, $4, $5, $6,
               ST_SetSRID(ST_GeomFromGeoJSON($7), 4326))
       RETURNING id`,
      [
        dto.name,
        dto.region,
        dto.lease_holder ?? null,
        dto.contract_number ?? null,
        dto.contract_start ?? null,
        dto.contract_expiry ?? null,
        JSON.stringify({ type: 'Polygon', coordinates: dto.geometry.coordinates }),
      ],
    );
    return { id: rows[0].id };
  }
}
