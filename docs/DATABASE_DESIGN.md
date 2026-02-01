# PostgreSQL + PostGIS Database Design

**Target:** Forestry GIS platform, large geospatial datasets  
**Principles:** Optimize for spatial queries, avoid premature complexity

---

## Schema Overview

```
┌─────────────────┐       ┌─────────────────┐
│ forest_parcels  │──────<│ forest_stands   │
│ (polygons)      │  1:N  │ (polygons)      │
└────────┬────────┘       └────────┬────────┘
         │                         │
         │    ┌────────────────────┘
         │    │
         ▼    ▼
┌─────────────────┐       ┌─────────────────┐
│ events          │       │ audit_log       │
│ (point + link)  │       │ (append-only)   │
└─────────────────┘       └─────────────────┘
```

---

## Tables

### 1. forest_parcels

Forest management units (polygons). Primary spatial entity.

```sql
CREATE TABLE forest_parcels (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(50) UNIQUE,           -- External/admin code
    name            VARCHAR(255),
    geometry        GEOMETRY(Polygon, 4326) NOT NULL,
    area_ha         NUMERIC(12, 4),               -- Denormalized; sync via trigger or app
    status          VARCHAR(20) DEFAULT 'active', -- active, archived, pending
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID,
    updated_by      UUID
);

COMMENT ON COLUMN forest_parcels.geometry IS 'WGS84 polygon boundary';
COMMENT ON COLUMN forest_parcels.area_ha IS 'Area in hectares; denormalized for query performance';
```

---

### 2. forest_stands

Subdivisions within parcels (e.g., by species, age). Optional for MVP — add when needed.

```sql
CREATE TABLE forest_stands (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_id       UUID NOT NULL REFERENCES forest_parcels(id) ON DELETE CASCADE,
    code            VARCHAR(50),
    geometry        GEOMETRY(Polygon, 4326) NOT NULL,
    area_ha         NUMERIC(12, 4),
    species         VARCHAR(100),                 -- Or FK to species table if needed
    age_class       VARCHAR(20),
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID,
    updated_by      UUID
);

CREATE INDEX idx_stands_parcel ON forest_stands(parcel_id);
```

---

### 3. events

Inspections, incidents, scheduled events. Point location + optional link to parcel/stand.

```sql
CREATE TABLE events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type            VARCHAR(50) NOT NULL,         -- inspection, incident, maintenance
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    occurred_at     TIMESTAMPTZ NOT NULL,
    location        GEOMETRY(Point, 4326),        -- Where event happened
    parcel_id       UUID REFERENCES forest_parcels(id) ON DELETE SET NULL,
    stand_id        UUID REFERENCES forest_stands(id) ON DELETE SET NULL,
    status          VARCHAR(20) DEFAULT 'open',
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID,
    updated_by      UUID
);

CREATE INDEX idx_events_parcel ON events(parcel_id);
CREATE INDEX idx_events_occurred ON events(occurred_at);
```

---

### 4. audit_log

Append-only change log for sensitive tables. No FKs to avoid locking.

```sql
CREATE TABLE audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name      VARCHAR(100) NOT NULL,
    record_id       UUID NOT NULL,
    action          VARCHAR(10) NOT NULL,         -- INSERT, UPDATE, DELETE
    old_values      JSONB,
    new_values      JSONB,
    changed_by      UUID,
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partitioning by month when table grows (>10M rows). Defer until needed.
```

---

## Indexing Strategy

### Spatial indexes (GIST) — mandatory

```sql
CREATE INDEX idx_parcels_geometry 
    ON forest_parcels USING GIST (geometry);

CREATE INDEX idx_stands_geometry 
    ON forest_stands USING GIST (geometry);

CREATE INDEX idx_events_location 
    ON events USING GIST (location);
```

**Why:** B-tree cannot index geometry. GIST enables `ST_Contains`, `ST_Intersects`, `&&` (bbox) and spatial joins. Without it, spatial queries are full table scans.

---

### B-tree indexes

```sql
-- Parcels
CREATE INDEX idx_parcels_status ON forest_parcels(status);
CREATE INDEX idx_parcels_created_at ON forest_parcels(created_at);
CREATE INDEX idx_parcels_code ON forest_parcels(code) WHERE code IS NOT NULL;

-- Stands
CREATE INDEX idx_stands_parcel ON forest_stands(parcel_id);

-- Events
CREATE INDEX idx_events_parcel ON events(parcel_id);
CREATE INDEX idx_events_occurred ON events(occurred_at);
CREATE INDEX idx_events_type ON events(type);
CREATE INDEX idx_events_status ON events(status);

-- Audit (time-range queries)
CREATE INDEX idx_audit_changed_at ON audit_log(changed_at);
CREATE INDEX idx_audit_table_record ON audit_log(table_name, record_id);
```

---

### Composite index for common query pattern

```sql
-- "Active parcels modified in date range"
CREATE INDEX idx_parcels_status_updated 
    ON forest_parcels(status, updated_at) 
    WHERE status = 'active';
```

---

## Spatial Query Patterns

### Bounding box filter (always do this first)

```sql
-- Filter by map viewport before complex predicates
SELECT id, name, ST_AsGeoJSON(geometry) AS geometry
FROM forest_parcels
WHERE geometry && ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326)
  AND status = 'active';
```

**Why:** `&&` uses GIST index. Reduces rows before `ST_Contains`/`ST_Intersects`.

---

### Point-in-polygon (event in parcel)

```sql
SELECT p.id, p.name
FROM forest_parcels p
WHERE ST_Contains(p.geometry, ST_SetSRID(ST_MakePoint(lon, lat), 4326));
```

---

### Simplify for display (map tiles)

```sql
-- Reduce vertex count for zoomed-out views
SELECT id, ST_Simplify(geometry, 0.001) AS geometry
FROM forest_parcels
WHERE geometry && bbox;
```

---

## Audit Fields Convention

| Column      | Type        | Use                                      |
|-------------|-------------|------------------------------------------|
| `created_at`| TIMESTAMPTZ | Set on INSERT, never update              |
| `updated_at`| TIMESTAMPTZ | Set on INSERT and UPDATE (trigger or app)|
| `created_by`| UUID        | User who created; NULL for system        |
| `updated_by`| UUID        | User who last modified                   |

**Trigger for `updated_at`:**

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER parcels_updated_at
    BEFORE UPDATE ON forest_parcels
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- Repeat for stands, events
```

---

## UUID Usage

| Use              | Approach                               |
|------------------|----------------------------------------|
| Primary keys     | `UUID DEFAULT gen_random_uuid()`       |
| Foreign keys     | `UUID REFERENCES parent(id)`           |
| `created_by`     | `UUID` (references users; no FK if users in separate schema) |
| Audit `record_id`| `UUID` (no FK to avoid cross-table locks) |

---

## Scaling Notes

| When                         | Action                                              |
|------------------------------|-----------------------------------------------------|
| Parcels >1M                  | Consider partitioning by region (e.g., state)       |
| Audit log >10M rows          | Partition by `changed_at` (monthly); archive old    |
| Slow bbox queries            | Ensure `&&` before `ST_Intersects`; check EXPLAIN   |
| Large geometry imports       | Batch inserts (1k–5k rows); commit per batch        |
| `area_ha` drift              | Trigger to recompute on geometry UPDATE             |

---

## What to Avoid

- **FK from audit_log to tables** — Causes locks on parent; audit is append-only.
- **Geometry in Redis** — Store in PostGIS only; cache simplified GeoJSON if needed.
- **Full geometry in indexes** — GIST indexes metadata, not full geometry.
- **SRID 0 or mixed** — Use 4326 consistently; transform on ingest.
