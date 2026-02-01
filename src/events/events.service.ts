import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class EventsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findAll(): Promise<
    Array<{ id: string; title: string; latitude: number; longitude: number; severity: string; createdAt: string }>
  > {
    const rows = await this.dataSource.query(
      `SELECT id, title, severity, created_at,
              ST_Y(location::geometry) AS latitude,
              ST_X(location::geometry) AS longitude
       FROM events
       ORDER BY created_at DESC
       LIMIT 500`,
    );
    return rows.map((r: { id: string; title: string; severity: string; created_at: Date; latitude: number | string; longitude: number | string }) => ({
      id: r.id,
      title: r.title,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      severity: r.severity ?? 'medium',
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    }));
  }
}
