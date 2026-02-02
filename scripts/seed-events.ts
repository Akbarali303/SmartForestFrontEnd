import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';

interface SeedEvent {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  severity: string;
  createdAt: string;
}

async function seed() {
  const jsonPath = path.join(__dirname, 'seed-events.json');
  const raw = fs.readFileSync(jsonPath, 'utf-8');
  const events: SeedEvent[] = JSON.parse(raw);

  if (!events.length) {
    console.log('No events in seed-events.json');
    return;
  }

  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/smart_forest',
    synchronize: false,
  });
  await ds.initialize();

  let inserted = 0;
  let skipped = 0;

  for (const e of events) {
    const createdAt = new Date(e.createdAt).toISOString();
    try {
      await ds.query(
        `INSERT INTO events (id, title, location, severity, created_at, updated_at)
         VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3::float, $4::float), 4326), $5, $6::timestamptz, $6::timestamptz)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           location = EXCLUDED.location,
           severity = EXCLUDED.severity,
           created_at = EXCLUDED.created_at`,
        [e.id, e.title, e.longitude, e.latitude, e.severity || 'medium', createdAt],
      );
      inserted++;
    } catch (err) {
      skipped++;
      if (skipped <= 3) console.warn(`Skip ${e.id}:`, (err as Error).message);
    }
  }

  console.log(`Seeded ${inserted} events${skipped ? ` (${skipped} skipped)` : ''}.`);
  await ds.destroy();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
