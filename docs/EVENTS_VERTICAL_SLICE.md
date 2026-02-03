# Events Module — Vertical Slice

**Minimal production-ready GIS Events feature**

---

## Folder Structure

```
src/
├── main.ts
├── app.module.ts
│
├── events/
│   ├── events.module.ts
│   ├── events.controller.ts
│   ├── events.service.ts
│   ├── dto/
│   │   ├── create-event.dto.ts
│   │   └── event-query.dto.ts
│   └── entities/
│       └── event.entity.ts
│
└── infrastructure/
    └── database/
        ├── data-source.ts
        └── migrations/
            └── 1738281600000-CreateEventsTable.ts
```

---

## Entity Design

```typescript
// Event — location stored as PostGIS GEOMETRY(Point, 4326)
// TypeORM entity excludes location (managed via raw SQL)
{
  id: UUID
  title: string
  description: string | null
  severity: 'low' | 'medium' | 'high' | 'critical'
  createdAt: Date
  // location: GEOMETRY(Point, 4326) — in DB only
}
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/events` | Create event with lat/lng |
| GET | `/api/v1/events?bbox=minLon,minLat,maxLon,maxLat` | List events in bbox |
| GET | `/api/v1/events/:id` | Get single event |

---

## Example Requests

### Create event

```bash
curl -X POST http://localhost:9000/api/v1/events \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Tree health inspection",
    "description": "Pine beetle observation",
    "latitude": 37.7749,
    "longitude": -122.4194,
    "severity": "medium"
  }'
```

### Get events in bounding box

```bash
# bbox: minLon,minLat,maxLon,maxLat (WGS84)
curl "http://localhost:9000/api/v1/events?bbox=-122.5,37.5,-122.0,38.0"
```

### Get single event

```bash
curl http://localhost:9000/api/v1/events/{uuid}
```

---

## Spatial Index Setup

```sql
-- Migration creates GIST index on location
CREATE INDEX idx_events_location ON events USING GIST (location);
```

**Why GIST:** Enables `&&` (bbox), `ST_Contains`, `ST_Intersects`. Without it, spatial queries are full table scans.

---

## Example SQL Queries

### Insert (used by service)

```sql
INSERT INTO events (title, description, location, severity)
VALUES (
  'Inspection',
  'Notes',
  ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326),
  'medium'
);
```

### Bbox query (uses index)

```sql
SELECT id, title, description, severity, created_at,
       ST_X(location::geometry) as longitude,
       ST_Y(location::geometry) as latitude
FROM events
WHERE location && ST_MakeEnvelope(-122.5, 37.5, -122.0, 38.0, 4326)
ORDER BY created_at DESC;
```

### Point-in-polygon (future use)

```sql
SELECT * FROM events
WHERE ST_Contains(
  (SELECT geometry FROM parcels WHERE id = '...'),
  location
);
```

---

## Best Practices

1. **Bbox first** — Always use `&&` before other predicates. It uses the GIST index.
2. **Coordinate order** — PostGIS: (longitude, latitude). GeoJSON: [lon, lat].
3. **SRID 4326** — WGS84. Store and query in same CRS.
4. **Raw SQL for geometry** — TypeORM has no native PostGIS support. Use DataSource.query().
5. **Validation** — DTO validates lat (-90..90), lng (-180..180).

---

## Setup

```bash
# Install
npm install

# Create DB and enable PostGIS
createdb smart_forest
psql smart_forest -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# Run migration
npm run migration:run

# Start
npm run start:dev
```

---

## ORM Choice: TypeORM

**Why TypeORM over Prisma:**
- PostGIS: TypeORM works with raw SQL; Prisma has no geometry support.
- Raw queries: TypeORM's DataSource.query() fits spatial workflows.
- Prisma would require `$queryRaw` for every geometry op — same outcome, more boilerplate.
