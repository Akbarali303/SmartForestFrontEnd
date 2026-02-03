# Events Vertical Slice — Implementation Guide

Step-by-step explanation of the first working vertical slice.

---

## Step 1: Event Entity

```typescript
// src/events/entities/event.entity.ts
@Entity('events')
export class Event {
  id: string;           // UUID, primary key
  title: string;
  description: string | null;
  severity: EventSeverity;   // enum: low, medium, high, critical
  createdAt: Date;
  updatedAt: Date;
  // location: GEOMETRY(Point) — in DB only, not in entity
}
```

**Why location is not in the entity:** TypeORM does not natively support PostGIS geometry. We manage `location` via raw SQL in the service. The entity defines the table structure for migrations and TypeORM metadata; actual geometry CRUD uses `DataSource.query()`.

---

## Step 2: PostGIS Configuration

The migration enables PostGIS and creates the table:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE events (
  ...
  location GEOMETRY(Point, 4326) NOT NULL,  -- WGS84
  ...
);
```

- **GEOMETRY(Point, 4326):** Point in WGS84 (lat/lng).
- **4326:** SRID for WGS84.
- PostGIS must be installed: `CREATE EXTENSION postgis;` (run once per database).

---

## Step 3: Spatial Indexing

```sql
CREATE INDEX idx_events_location ON events USING GIST (location);
```

- **GIST:** Generalized Search Tree — required for spatial queries.
- Without it: full table scan on bbox queries.
- The `&&` (bounding box) operator uses this index.

---

## Step 4: Migration

Run with:

```bash
npm run migration:run
```

The migration:
1. Enables PostGIS
2. Creates `events` table with `updated_at`
3. Adds trigger to auto-update `updated_at` on UPDATE
4. Creates GIST index on `location`
5. Creates B-tree indexes on `created_at` and `severity`

---

## Step 5: Service

The service uses **raw SQL** for all event operations:

| Method | Purpose |
|--------|---------|
| `create(dto)` | INSERT with `ST_SetSRID(ST_MakePoint(lng, lat), 4326)` |
| `findById(id)` | SELECT by id, extract lat/lng via `ST_X`, `ST_Y` |
| `findByBbox(...)` | SELECT where `location && ST_MakeEnvelope(...)` |

**Why raw SQL:** PostGIS functions (`ST_MakePoint`, `&&`, `ST_X`, `ST_Y`) are not expressible in TypeORM's query builder. Raw SQL is the standard approach.

---

## Step 6: Controller

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/v1/events` | Create event (body: title, description, latitude, longitude, severity) |
| GET | `/api/v1/events?bbox=minLon,minLat,maxLon,maxLat` | List events in bounding box |
| GET | `/api/v1/events/:id` | Get single event |

**Route order:** `@Get()` (list) must come before `@Get(':id')` — otherwise `"events"` could match `:id`.

---

## Step 7: DTOs

**CreateEventDto:** Validates title, description, latitude (-90..90), longitude (-180..180), severity.

**EventQueryDto:** Validates `bbox` format: `minLon,minLat,maxLon,maxLat`. Returns 400 if malformed.

---

## Step 8: POST /events — Store as Geometry

```sql
INSERT INTO events (title, description, location, severity)
VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5)
```

- `ST_MakePoint(longitude, latitude)` — PostGIS uses (x, y) = (lon, lat).
- `ST_SetSRID(..., 4326)` — Assigns WGS84.

---

## Step 9: GET /events?bbox= — Spatial Query

```sql
SELECT ... FROM events
WHERE location && ST_MakeEnvelope(minLon, minLat, maxLon, maxLat, 4326)
ORDER BY created_at DESC
```

- `&&` — Bounding box overlap (uses GIST index).
- `ST_MakeEnvelope(minx, miny, maxx, maxy, srid)` — Creates a rectangle.
- Order: minLon, minLat, maxLon, maxLat (xmin, ymin, xmax, ymax).

---

## Quick Test

```bash
# Create event
curl -X POST http://localhost:9000/api/v1/events \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","latitude":37.77,"longitude":-122.42}'

# Get by bbox (San Francisco area)
curl "http://localhost:9000/api/v1/events?bbox=-122.5,37.5,-122.3,37.9"
```
