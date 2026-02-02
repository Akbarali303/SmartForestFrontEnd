# Geospatial Database Design — National Forestry Platform

**Principles:** Future-proof, scalable, simple. No overengineering.

---

## 1. Primary Key Strategy: UUID

### Recommendation: UUID (gen_random_uuid)

| Factor | UUID | BIGINT |
|--------|------|--------|
| **Extraction** | Domain can become its own DB/service later | Harder; ID conflicts across shards |
| **Merge/replication** | No collision across sources | Need central sequence or coordination |
| **Security** | Non-sequential; harder to enumerate | Sequential; predictable |
| **Storage** | 16 bytes | 8 bytes |
| **Index size** | Slightly larger | Slightly smaller |
| **Insert locality** | Random; B-tree fragmentation | Sequential; better locality |

### Verdict
Use **UUID** for core entities (parcels, stands, events, devices). Storage cost is small; flexibility and extraction-friendly design justify it.

**Exception:** Time-series tables (e.g. sensor readings) can use **BIGSERIAL** — append-only, never merged, high write volume.

```sql
-- Core entities
id UUID PRIMARY KEY DEFAULT gen_random_uuid()

-- Time-series (hypertables)
id BIGSERIAL  -- or let TimescaleDB manage
```

---

## 2. Geometry Column Standards

### Storage type
| Column type | Use |
|-------------|-----|
| `GEOMETRY(Point, 4326)` | Events, sensor locations, centroids |
| `GEOMETRY(MultiPolygon, 4326)` | Parcels, stands, boundaries — use MultiPolygon for flexibility (single polygon = MultiPolygon with 1 part) |
| `GEOMETRY(LineString, 4326)` | Roads, rivers |
| `GEOMETRY(Point, 4326)` | Device locations |

### Rules
- **SRID 4326 (WGS84)** everywhere. Standard for web maps, GeoJSON, APIs.
- **NOT NULL** where geometry is required.
- **No mixed geometry types** in one column — one type per column.
- **Validate on insert:** `ST_IsValid()`; reject or `ST_MakeValid()` with care.

```sql
-- Standard pattern
location GEOMETRY(Point, 4326) NOT NULL
boundary GEOMETRY(MultiPolygon, 4326) NOT NULL
```

---

## 3. Geography vs Geometry

### Recommendation: Geometry

| Aspect | Geometry | Geography |
|--------|----------|-----------|
| **Storage** | Planar; simpler | Spherical; more accurate |
| **Index** | GIST uses planar bbox | GIST uses spherical |
| **Distance/area** | Approximate (deg units) | Accurate (m, m²) |
| **Functions** | More ops; faster | Fewer; heavier |
| **Bbox queries** | Native; very fast | Slightly slower |
| **Cross-dateline** | Can misbehave | Handles correctly |

### Why Geometry for forestry
- **Bbox-first queries** dominate — geometry + GIST is fastest.
- **National scale** — if you stay within one region, planar distortion is acceptable.
- **Area in hectares** — compute with `ST_Area(geom::geography)/10000` when needed, or store denormalized `area_ha`.
- **Distance** — use `ST_DWithin(geom::geography, ...)` only where accuracy matters.
- **Simplicity** — one model; fewer edge cases.

### When to use Geography
- Global coverage with dateline crossing.
- Legal/regulatory need for precise geodesic area.
- Distance-based queries are primary (e.g. “within 5km”).

**Pattern:** Store as Geometry; cast to Geography only when computing area or distance.

```sql
-- Area in hectares (when needed)
SELECT ST_Area(boundary::geography) / 10000 AS area_ha FROM parcels;

-- Or store denormalized
area_ha NUMERIC(12, 4)  -- Updated on geometry change
```

---

## 4. Indexing Strategy

### GIST (primary for spatial)

Use for all geometry/geography columns:

```sql
CREATE INDEX idx_<table>_<column> ON <table> USING GIST (<column>);
```

- Supports: `&&`, `@`, `~`, `ST_Contains`, `ST_Intersects`, `ST_DWithin`
- Essential for bbox and spatial predicates.
- One GIST index per geometry column.

### B-tree (attributes)

```sql
CREATE INDEX idx_events_created_at ON events(created_at);
CREATE INDEX idx_parcels_status ON parcels(status);
CREATE INDEX idx_parcels_code ON parcels(code) WHERE code IS NOT NULL;
CREATE INDEX idx_readings_time_device ON sensor_readings(time, device_id);  -- time-series
```

### Composite / partial

```sql
-- "Active parcels in viewport"
CREATE INDEX idx_parcels_status_geom ON parcels USING GIST (boundary) WHERE status = 'active';

-- "Unresolved events in viewport"
CREATE INDEX idx_events_location_status ON events USING GIST (location) WHERE status = 'open';
```

### SP-GIST
- For very irregular or high-dimensional data.
- For forestry, GIST is enough. Consider SP-GIST only if GIST performs poorly on specific workloads (benchmark first).

### BRIN (time-series)
- For append-only, time-ordered tables.
- Good for sensor readings: `CREATE INDEX ON sensor_readings USING BRIN (time);`
- Much smaller than B-tree; good for time-range scans.

### Rules
1. **GIST on every geometry column.**
2. **Bbox first:** always `WHERE geom && bbox` before other predicates.
3. **No functions on indexed columns** — transform the other operand.
4. **Partial indexes** where a common filter reduces the set (e.g. status, type).

---

## 5. Table Partitioning

### When to use
| Scenario | Partition by | Example |
|----------|--------------|---------|
| **Time-series** | Time (month/week) | sensor_readings |
| **Very large tables** | Time or region | Parcels >10M rows |
| **Audit log** | Month | audit_log |
| **Clear retention** | Drop old partitions | Sensor data >2 years |

### When NOT to use
| Scenario | Reason |
|----------|--------|
| Tables <1M rows | Overhead outweighs benefit |
| No natural partition key | Arbitrary splits add complexity |
| Frequent cross-partition queries | Defeats pruning |
| Early phase | Add when scaling demands it |

### Approach
1. **Start without partitioning.** Single tables + GIST.
2. **Add when** table grows past ~5–10M rows and queries slow.
3. **Preferred keys:** time (for events, readings, audit) or region_code (for parcels).
4. **PostgreSQL native partitioning** — avoid external tools until needed.

```sql
-- Example: partition events by month (when table is huge)
CREATE TABLE events (
  ...
) PARTITION BY RANGE (created_at);

CREATE TABLE events_2025_01 PARTITION OF events
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

Each partition has its own GIST index. Queries with `created_at` in `WHERE` prune partitions.

### Verdict
**Do not partition at the start.** Add when a table reaches millions of rows and profiling shows it is needed.

---

## 6. Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Tables | snake_case, plural | `forest_parcels`, `sensor_readings` |
| Columns | snake_case | `created_at`, `area_ha` |
| Geometry columns | descriptive | `location`, `boundary`, `geometry` |
| Indexes | `idx_<table>_<columns>` | `idx_parcels_boundary` |
| Primary keys | `id` | — |
| Foreign keys | `pointer`_id | `parcel_id`, `device_id` |
| Schemas | One per domain (optional) | `forest`, `monitoring` |

### Geometry column names
- `location` — Point (event, device)
- `boundary` — Polygon/MultiPolygon (parcel, stand)
- `geometry` — Generic when table has one spatial column
- `shape` — Alternative for polygons

---

## 7. Audit Fields

### Standard columns

| Column | Type | Use |
|--------|------|-----|
| `created_at` | TIMESTAMPTZ | Set on INSERT |
| `updated_at` | TIMESTAMPTZ | Set on INSERT and UPDATE (trigger) |
| `created_by` | UUID | User who created; NULL for system |
| `updated_by` | UUID | User who last updated; NULL for system |

### Trigger for updated_at

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply per table
CREATE TRIGGER parcels_updated_at
  BEFORE UPDATE ON forest_parcels
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
```

### Optional: version for optimistic locking
- `version INTEGER DEFAULT 1` — increment on update; check in `WHERE` for conflict detection.
- Add when concurrent updates are common.

### Bulk loads
- Allow `created_at`/`updated_at` to be set explicitly for imports.
- Or keep nullable for bulk; application sets on normal writes.

---

## 8. Core Table Design

### Events (existing, refined)

```sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  location GEOMETRY(Point, 4326) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  status VARCHAR(20) DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

CREATE INDEX idx_events_location ON events USING GIST (location);
CREATE INDEX idx_events_created_at ON events(created_at);
CREATE INDEX idx_events_status ON events(status);
```

### Forest parcels (future)

```sql
CREATE TABLE forest_parcels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE,
  name VARCHAR(255),
  boundary GEOMETRY(MultiPolygon, 4326) NOT NULL,
  area_ha NUMERIC(12, 4),  -- Denormalized; trigger or app maintains
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

CREATE INDEX idx_parcels_boundary ON forest_parcels USING GIST (boundary);
CREATE INDEX idx_parcels_status ON forest_parcels(status);
CREATE INDEX idx_parcels_status_boundary ON forest_parcels USING GIST (boundary) WHERE status = 'active';
```

### Forest stands (future)

```sql
CREATE TABLE forest_stands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id UUID NOT NULL,  -- Soft ref; no FK for extraction
  boundary GEOMETRY(MultiPolygon, 4326) NOT NULL,
  area_ha NUMERIC(12, 4),
  species VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stands_boundary ON forest_stands USING GIST (boundary);
CREATE INDEX idx_stands_parcel ON forest_stands(parcel_id);
```

### IoT devices (future)

```sql
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255),
  location GEOMETRY(Point, 4326) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_devices_location ON devices USING GIST (location);
```

### Sensor readings (TimescaleDB hypertable)

```sql
CREATE TABLE sensor_readings (
  time TIMESTAMPTZ NOT NULL,
  device_id UUID NOT NULL,
  metric_type VARCHAR(50) NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  location GEOMETRY(Point, 4326)  -- Optional; if mobile
);

SELECT create_hypertable('sensor_readings', 'time');

CREATE INDEX idx_readings_device_time ON sensor_readings (device_id, time DESC);
CREATE INDEX idx_readings_location ON sensor_readings USING GIST (location) WHERE location IS NOT NULL;
```

---

## 9. Performance Tips

### Query patterns
1. **Always bbox first:** `WHERE geom && ST_MakeEnvelope(...)` before other filters.
2. **Indexed column on left:** `WHERE table.geom && bbox` not `WHERE bbox && table.geom`.
3. **No functions on indexed column:** Transform bbox, not `geom`.
4. **Simplify for display:** `ST_SimplifyPreserveTopology(geom, tolerance)` for tiles; avoid full resolution.
5. **Limit results:** `LIMIT 500` or `LIMIT 1000` for map layers; paginate if needed.

### Bulk operations
- Batch inserts (1k–5k rows per transaction).
- Drop indexes before bulk load; recreate after (for very large imports).
- Use `COPY` for bulk insert when possible.

### Maintenance
- `VACUUM ANALYZE` after large changes.
- Monitor `pg_stat_user_indexes` for index usage.
- Use `EXPLAIN (ANALYZE, BUFFERS)` to verify spatial index usage.

### Common mistakes
| Mistake | Fix |
|---------|-----|
| No bbox filter | Add `&&` before other predicates |
| Function on indexed geom | Transform bbox instead |
| Full resolution for tiles | Simplify by zoom |
| No limit on layer query | Cap at 500–1000 |
| Cross-schema FK on hot path | Prefer soft refs |
| Partitioning too early | Add at 5–10M+ rows |

---

## 10. Summary

| Decision | Choice |
|----------|--------|
| Primary keys | UUID (BIGSERIAL for time-series) |
| Geometry type | Geometry, SRID 4326 |
| Geography | Use cast when computing area/distance |
| Indexes | GIST on all geometry; B-tree on filters |
| Partitioning | Add when table >5–10M rows |
| Audit | created_at, updated_at, created_by, updated_by |
| Naming | snake_case tables/columns; idx_<table>_<col> |
| Sharding | Not in initial design |
| Microservices | Not in DB design |
