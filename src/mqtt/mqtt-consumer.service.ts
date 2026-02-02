import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import mqtt, { MqttClient } from 'mqtt';
import { EventsGateway } from '../events/events.gateway';
import { TelegramService } from '../telegram/telegram.service';

const TOPIC = 'forest/sensors/#';
const DEDUPE_MAX = 10000;
const DEDUPE_TTL_MS = 60_000;

interface SensorPayload {
  sensorId: string;
  latitude: number;
  longitude: number;
  timestamp?: number;
  messageId?: string;
  title?: string;
  severity?: string;
}

function parsePayload(raw: Buffer): SensorPayload | null {
  try {
    const data = JSON.parse(raw.toString());
    if (!data || typeof data !== 'object') return null;
    const sensorId = data.sensorId ?? data.sensor_id;
    const lat = data.latitude ?? data.lat;
    const lng = data.longitude ?? data.lng ?? data.lon;
    if (typeof sensorId !== 'string' || !sensorId.trim()) return null;
    if (typeof lat !== 'number' || typeof lng !== 'number') return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    const severity = ['low', 'medium', 'high', 'critical'].includes(data.severity?.toLowerCase())
      ? data.severity.toLowerCase()
      : 'medium';
    return {
      sensorId: String(sensorId).trim(),
      latitude: lat,
      longitude: lng,
      timestamp: typeof data.timestamp === 'number' ? data.timestamp : undefined,
      messageId: typeof data.messageId === 'string' ? data.messageId : undefined,
      title: typeof data.title === 'string' ? data.title.slice(0, 255) : 'Sensor alert',
      severity,
    };
  } catch {
    return null;
  }
}

@Injectable()
export class MqttConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttConsumerService.name);
  private client: MqttClient | null = null;
  private readonly seen = new Map<string, number>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly eventsGateway: EventsGateway,
    private readonly telegram: TelegramService,
  ) {}

  async onModuleInit() {
    const enabled = process.env.ENABLE_MQTT === 'true' || process.env.ENABLE_MQTT === '1';
    if (!enabled) {
      this.logger.log('MQTT disabled (ENABLE_MQTT not set to true)');
      return;
    }

    const url = process.env.MQTT_URL ?? 'mqtt://localhost:1883';
    this.client = mqtt.connect(url, {
      reconnectPeriod: 5000,
      connectTimeout: 10000,
      clean: true,
    });

    this.client.on('connect', () => {
      this.logger.log('Connected to MQTT broker');
      this.client!.subscribe(TOPIC, { qos: 1 }, (err) => {
        if (err) this.logger.error(`Subscribe failed: ${err.message}`);
      });
    });

    this.client.on('message', (topic, payload) => this.handleMessage(topic, payload));
    this.client.on('error', (err) => this.logger.error(`MQTT error: ${err.message}`));
    this.client.on('offline', () => this.logger.warn('MQTT offline'));
    this.client.on('reconnect', () => this.logger.log('MQTT reconnecting'));

    this.cleanupTimer = setInterval(() => this.evictDedupe(), 10_000);
  }

  async onModuleDestroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    if (this.client) {
      this.client.end(true);
      this.client = null;
    }
  }

  private evictDedupe() {
    const cutoff = Date.now() - DEDUPE_TTL_MS;
    for (const [k, ts] of this.seen) {
      if (ts < cutoff) this.seen.delete(k);
    }
    if (this.seen.size > DEDUPE_MAX) {
      const entries = [...this.seen.entries()].sort((a, b) => a[1] - b[1]);
      const toDel = entries.slice(0, entries.length - DEDUPE_MAX + 1000);
      toDel.forEach(([k]) => this.seen.delete(k));
    }
  }

  private dedupeKey(p: SensorPayload): string {
    if (p.messageId) return p.messageId;
    const ts = p.timestamp ? Math.floor(p.timestamp / 1000) : Math.floor(Date.now() / 1000);
    return `${p.sensorId}:${p.latitude.toFixed(4)}:${p.longitude.toFixed(4)}:${ts}`;
  }

  private async isPointInUzbekistan(lat: number, lng: number): Promise<boolean> {
    const rows = await this.dataSource.query(
      `SELECT 1 FROM uzbekistan_boundary
       WHERE ST_Within(ST_SetSRID(ST_MakePoint($1, $2), 4326), geom)
       LIMIT 1`,
      [lng, lat],
    );
    return (rows?.length ?? 0) > 0;
  }

  private async handleMessage(topic: string, payload: Buffer) {
    if (!this.client) return;
    const p = parsePayload(payload);
    if (!p) {
      this.logger.debug(`Invalid payload on ${topic}`);
      return;
    }

    const key = this.dedupeKey(p);
    if (this.seen.has(key)) {
      this.logger.debug(`Duplicate ignored: sensorId=${p.sensorId}`);
      return;
    }
    this.seen.set(key, Date.now());

    const inside = await this.isPointInUzbekistan(p.latitude, p.longitude);
    if (!inside) {
      this.logger.warn(
        `Rejected: coordinates outside Uzbekistan sensorId=${p.sensorId} lat=${p.latitude} lng=${p.longitude}`,
      );
      return;
    }

    this.logger.log(`sensorId=${p.sensorId} topic=${topic}`);

    try {
      const rows = await this.dataSource.query(
        `INSERT INTO events (title, description, location, severity)
         VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5)
         RETURNING id, title, severity, created_at,
                   ST_Y(location::geometry) AS latitude,
                   ST_X(location::geometry) AS longitude`,
        [p.title, `sensorId: ${p.sensorId}`, p.longitude, p.latitude, p.severity],
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
          source: 'MQTT',
          description: `sensorId: ${p.sensorId}`,
        });
      }
    } catch (err) {
      this.seen.delete(key);
      this.logger.error(`Store failed sensorId=${p.sensorId}: ${(err as Error).message}`);
    }
  }
}
