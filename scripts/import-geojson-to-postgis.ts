/**
 * Import GeoJSON polygon(s) into PostGIS.
 * Usage: npx ts-node -r tsconfig-paths/register scripts/import-geojson-to-postgis.ts <file.geojson> [table_name]
 * Creates table with geom GEOMETRY(MultiPolygon, 4326), GIST index.
 */
import 'dotenv/config';
import { readFileSync } from 'fs';
import { DataSource } from 'typeorm';

function extractGeometries(input: unknown): object[] {
  const obj = input as Record<string, unknown>;
  if (!obj || typeof obj !== 'object') throw new Error('Invalid GeoJSON');

  if (obj.type === 'Polygon') return [obj];
  if (obj.type === 'MultiPolygon') return [obj];

  if (obj.type === 'Feature') {
    const g = (obj as { geometry?: { type: string } }).geometry;
    if (g?.type === 'Polygon' || g?.type === 'MultiPolygon') return [g];
    throw new Error('Feature must have Polygon or MultiPolygon geometry');
  }

  if (obj.type === 'FeatureCollection') {
    const features = (obj as { features?: Array<{ geometry?: { type: string } }> }).features ?? [];
    const out: object[] = [];
    for (const f of features) {
      const g = f?.geometry;
      if (g?.type === 'Polygon' || g?.type === 'MultiPolygon') out.push(g);
    }
    if (!out.length) throw new Error('No Polygon/MultiPolygon in FeatureCollection');
    return out;
  }

  throw new Error('GeoJSON must be Polygon, MultiPolygon, Feature, or FeatureCollection');
}

async function main() {
  const file = process.argv[2];
  const table = (process.argv[3] ?? 'geojson_import').replace(/\W/g, '_') || 'geojson_import';

  if (!file) {
    console.error('Usage: npx ts-node scripts/import-geojson-to-postgis.ts <file.geojson> [table_name]');
    process.exit(1);
  }

  const raw = readFileSync(file, 'utf-8');
  const input = JSON.parse(raw);
  const geoms = extractGeometries(input);

  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/smart_forest',
    synchronize: false,
  });
  await ds.initialize();

  await ds.query(`DROP TABLE IF EXISTS ${table}`);
  await ds.query(`
    CREATE TABLE ${table} (
      id SERIAL PRIMARY KEY,
      geom GEOMETRY(MultiPolygon, 4326) NOT NULL
    )
  `);

  for (const g of geoms) {
    const json = JSON.stringify(g);
    await ds.query(
      `INSERT INTO ${table} (geom) SELECT ST_Multi(ST_GeomFromGeoJSON($1))::geometry(MultiPolygon, 4326)`,
      [json],
    );
  }

  const idxName = `idx_${table.replace(/\W/g, '_')}_geom`;
  await ds.query(
    `CREATE INDEX ${idxName} ON ${table} USING GIST (geom gist_geometry_ops_2d)`,
  );

  console.log(`Imported ${geoms.length} polygon(s) into ${table}.`);
  await ds.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
