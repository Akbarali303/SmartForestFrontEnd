# Events Inside Uzbekistan — PostGIS Query

## Setup

1. Run migrations: `npm run migration:run`
2. Seed boundary: `npm run seed:uzbekistan-boundary`

## Optimized Query

Use `ST_Within` for points (fastest for point-in-polygon):

```sql
SELECT e.id, e.title, e.description, e.severity,
       ST_Y(e.location::geometry) AS latitude,
       ST_X(e.location::geometry) AS longitude,
       e.created_at, e.updated_at
FROM events e
CROSS JOIN LATERAL (SELECT geom FROM uzbekistan_boundary LIMIT 1) uzb
WHERE ST_Within(e.location, uzb.geom);
```

Alternative with subquery (same plan):

```sql
SELECT e.id, e.title, e.description, e.severity,
       ST_Y(e.location::geometry) AS latitude,
       ST_X(e.location::geometry) AS longitude,
       e.created_at, e.updated_at
FROM events e
WHERE ST_Within(e.location, (SELECT geom FROM uzbekistan_boundary LIMIT 1));
```

`ST_Intersects` is equivalent for points and uses the same GIST index.

## Index Usage

- `events.location` — GIST index (`idx_events_location`)
- `uzbekistan_boundary.geom` — GIST index (`idx_uzbekistan_boundary_geom`)

Both tables use SRID 4326. No transform needed.
