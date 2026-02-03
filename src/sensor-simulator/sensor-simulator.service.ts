import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventsGateway } from '../events/events.gateway';
import { TelegramService } from '../telegram/telegram.service';

// Realistic: common events more frequent
const TITLES: Array<{ name: string; weight: number }> = [
  { name: 'Smoke detected', weight: 5 },
  { name: 'Ranger alert', weight: 4 },
  { name: 'Tree disease detected', weight: 3 },
  { name: 'Forest fire', weight: 2 },
  { name: 'Illegal logging', weight: 1 },
];

// Realistic: mostly low/medium, rare critical
const SEVERITIES: Array<{ level: string; weight: number }> = [
  { level: 'low', weight: 5 },
  { level: 'medium', weight: 3 },
  { level: 'critical', weight: 1 },
];

function pickWeighted<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

@Injectable()
export class SensorSimulatorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SensorSimulatorService.name);
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly eventsGateway: EventsGateway,
    private readonly telegram: TelegramService,
  ) {}

  onModuleInit() {
    this.stopped = false;
    this.scheduleNext();
    this.logger.log('Sensor simulator started (10s interval, Uzbekistan polygon)');
  }

  onModuleDestroy() {
    this.stopped = true;
    if (this.timeout) clearTimeout(this.timeout);
  }

  private scheduleNext() {
    if (this.stopped) return;
    const delayMs = 10000;
    this.timeout = setTimeout(() => this.tick(), delayMs);
  }

  private async tick() {
    try {
      const point = await this.randomPointInUzbekistan();
      if (!point) {
        this.logger.warn('No point inside Uzbekistan (retry next cycle)');
        this.scheduleNext();
        return;
      }

      const { lat, lng } = point;
      const title = pickWeighted(TITLES).name;
      const severity = pickWeighted(SEVERITIES).level;

      const rows = await this.dataSource.query(
        `INSERT INTO events (title, description, location, severity)
         VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5)
         RETURNING id, title, severity, created_at,
                   ST_Y(location::geometry) AS latitude,
                   ST_X(location::geometry) AS longitude`,
        [title, 'sensor-simulator', lng, lat, severity],
      );
      const r = rows[0];
      if (r) {
        this.eventsGateway.broadcastEvent({
          id: r.id,
          title: r.title,
          latitude: Number(r.latitude),
          longitude: Number(r.longitude),
          severity: r.severity,
          createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
        });
        await this.telegram.sendAlert({
          title: r.title,
          severity: r.severity,
          latitude: Number(r.latitude),
          longitude: Number(r.longitude),
          source: 'Sensor simulator',
          description: 'Simulyatsiya hodisasi',
        });
      }
      this.logger.debug(`Simulated: ${title} @ ${lat.toFixed(4)}, ${lng.toFixed(4)} [${severity}]`);
    } catch (err) {
      this.logger.error(`Simulator failed: ${(err as Error).message}`);
    }
    this.scheduleNext();
  }

  private async randomPointInUzbekistan(): Promise<{ lat: number; lng: number } | null> {
    // Rejection sampling: random point in bbox, check ST_Within
    const bbox = await this.dataSource.query(
      `SELECT ST_XMin(geom) AS xmin, ST_XMax(geom) AS xmax,
              ST_YMin(geom) AS ymin, ST_YMax(geom) AS ymax
       FROM uzbekistan_boundary LIMIT 1`,
    );
    if (!bbox?.length) return null;
    const { xmin, xmax, ymin, ymax } = bbox[0];
    for (let i = 0; i < 50; i++) {
      const lng = Number(xmin) + Math.random() * (Number(xmax) - Number(xmin));
      const lat = Number(ymin) + Math.random() * (Number(ymax) - Number(ymin));
      const inside = await this.dataSource.query(
        `SELECT 1 FROM uzbekistan_boundary
         WHERE ST_Within(ST_SetSRID(ST_MakePoint($1, $2), 4326), geom)
         LIMIT 1`,
        [lng, lat],
      );
      if (inside?.length) return { lat, lng };
    }
    return null;
  }
}
