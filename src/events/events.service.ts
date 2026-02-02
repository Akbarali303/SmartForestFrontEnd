import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

type EventDto = {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  severity: string;
  createdAt: string;
};

const DEMO_EVENTS: EventDto[] = [
  { id: 'demo-1', title: 'Daraxt tekshiruvi', latitude: 41.311, longitude: 69.24, severity: 'medium', createdAt: new Date().toISOString() },
  { id: 'demo-2', title: 'Yong\'in xavfi', latitude: 41.35, longitude: 69.28, severity: 'high', createdAt: new Date(Date.now() - 3600000).toISOString() },
  { id: 'demo-3', title: 'Monitoring', latitude: 41.29, longitude: 69.22, severity: 'low', createdAt: new Date(Date.now() - 7200000).toISOString() },
  { id: 'demo-4', title: 'O\'rmon zonasi', latitude: 41.33, longitude: 69.26, severity: 'medium', createdAt: new Date(Date.now() - 10800000).toISOString() },
  { id: 'demo-5', title: 'Kamera offline', latitude: 41.27, longitude: 69.25, severity: 'critical', createdAt: new Date(Date.now() - 14400000).toISOString() },
];

@Injectable()
export class EventsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findAll(): Promise<EventDto[]> {
    try {
      const rows = await this.dataSource.query(
        `SELECT id, title, severity, created_at,
                ST_Y(location::geometry) AS latitude,
                ST_X(location::geometry) AS longitude
         FROM events
         ORDER BY created_at DESC
         LIMIT 500`,
      );
      if (!rows?.length) return DEMO_EVENTS;
      return rows.map((r: { id: string; title: string; severity: string; created_at: Date; latitude: number | string; longitude: number | string }) => ({
        id: r.id,
        title: r.title,
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        severity: r.severity ?? 'medium',
        createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      }));
    } catch {
      return DEMO_EVENTS;
    }
  }
}
