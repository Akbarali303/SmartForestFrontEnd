import 'dotenv/config';
import * as turf from '@turf/turf';
import { DataSource } from 'typeorm';

const GEOJSON_URL =
  'https://raw.githubusercontent.com/akbartus/GeoJSON-Uzbekistan/main/geojson/uzbekistan_regional.geojson';

async function seed() {
  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/smart_forest',
    synchronize: false,
  });
  await ds.initialize();

  const geojson = await fetch(GEOJSON_URL).then((r) => r.json());
  const flat = turf.flatten(geojson);
  const polys = flat.features.filter(
    (f: { geometry: { type: string } }) =>
      f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon',
  );
  if (!polys.length) throw new Error('No polygons in GeoJSON');

  const uzb = turf.union(turf.featureCollection(polys) as any);
  if (!uzb) throw new Error('Union failed');

  const geomJson = JSON.stringify(uzb.geometry);

  await ds.query('DELETE FROM uzbekistan_boundary');
  await ds.query(
    `INSERT INTO uzbekistan_boundary (geom)
     SELECT ST_Multi(ST_GeomFromGeoJSON($1))::geometry(MultiPolygon, 4326)`,
    [geomJson],
  );

  console.log('Uzbekistan boundary seeded.');
  await ds.destroy();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
