# GIS Data Architecture — National-Scale Forestry Platform

**Scope:** Polygon storage, layers, GeoJSON, WGS84, performance  
**Principle:** Optimize for scale; avoid common pitfalls

---

## 1. Polygon Storage

### Geometry types

| Type | Use | When |
|------|-----|------|
| `GEOMETRY(Polygon, 4326)` | Single closed ring | Parcels that are always single polygons |
| `GEOMETRY(MultiPolygon, 4326)` | One or more polygons | Parcels with holes, disjoint parts, or variable topology |

**Recommendation:** Store as **MultiPolygon** for flexibility. A single polygon is a MultiPolygon with one element.

```sql
-- Single geometry column handles both
geometry GEOMETRY(MultiPolygon, 4326) NOT NULL
```

- **Polygon:** Forest parcel that is one contiguous shape.
- **MultiPolygon:** Parcel split by road; archipelago of stands; parcel with lake hole.

Use `ST_CollectionExtract(geom, 3)` to cast to MultiPolygon on ingest if input is Polygon.

---

### Validation on write

```sql
-- Ensure valid geometry (self-intersections, etc.)
SELECT ST_IsValid(geom);
SELECT ST_IsValidReason(geom);  -- Returns reason if invalid

-- Fix invalid geometries (use with caution)
ST_MakeValid(geom)
```

Reject or repair invalid geometries before insert. Invalid geometry breaks spatial index and queries.

---

### Storage considerations

| Factor | Guideline |
|--------|-----------|
| Vertex count | Simplify for storage if source is overly dense (>1000 vertices per polygon) |
| Precision | WGS84: 6–7 decimal places (~10cm). More is noise for forestry. |
| Size | Large polygons (>10k vertices): consider subdivision or separate “detail” table |

---

## 2. Multipolygon Support

### Input normalization

```sql
-- Normalize incoming geometry to MultiPolygon
CREATE OR REPLACE FUNCTION to_multipolygon(geom GEOMETRY)
RETURNS GEOMETRY AS $$
BEGIN
    RETURN ST_Multi(ST_CollectionExtract(geom, 3));
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

- Polygon → MultiPolygon with 1 element  
- MultiPolygon → unchanged  
- GeometryCollection → extract polygons only  

### Query patterns

```sql
-- Works for both Polygon and MultiPolygon
ST_Area(geom)           -- Total area
ST_Centroid(geom)       -- Centroid
ST_NumGeometries(geom)  -- 1 for Polygon, N for MultiPolygon
ST_GeometryN(geom, 1)   -- First polygon in collection
```

### Holes (interior rings)

MultiPolygon supports interior rings (holes). Use `ST_NumInteriorRings()` to detect. Lakes, clearings stored as holes — no extra tables.

---

## 3. Spatial Indexing

### GIST index (primary)

```sql
CREATE INDEX idx_parcels_geometry 
    ON forest_parcels USING GIST (geometry);
```

- Supports: `&&`, `@`, `~`, `ST_Contains`, `ST_Intersects`, `ST_DWithin`, etc.
- Index stores bounding boxes; PostGIS refines with exact geometry when needed.

### Index use rules

1. **Bbox first**

```sql
-- Uses index
WHERE geometry && ST_MakeEnvelope(minx, miny, maxx, maxy, 4326)

-- May not use index alone
WHERE ST_Intersects(geometry, point)
```

Always combine: bbox filter **and** predicate.

```sql
WHERE geometry && bbox 
  AND ST_Intersects(geometry, point)
```

2. **Left side indexed**

```sql
-- Good
WHERE parcel.geometry && bbox

-- Bad (index on parcel.geometry not used)
WHERE bbox && parcel.geometry
```

3. **No functions on indexed column**

```sql
-- Bad
WHERE ST_Transform(geometry, 3857) && bbox

-- Good: transform bbox instead
WHERE geometry && ST_Transform(bbox_3857, 4326)
```

### SP-GIST (optional)

For highly irregular data (e.g. points), SP-GIST can beat GIST. For polygons, GIST is usually best. Benchmark before switching.

### National-scale partitioning

For 1M+ polygons:

```sql
-- Partition by bounding box regions (e.g., grid or admin)
CREATE TABLE forest_parcels (
    ...
) PARTITION BY LIST (region_code);

CREATE TABLE forest_parcels_north PARTITION OF forest_parcels FOR VALUES IN ('N');
CREATE TABLE forest_parcels_south PARTITION OF forest_parcels FOR VALUES IN ('S');
-- etc.
```

Each partition has its own GIST index. Queries with `region_code` prune partitions.

Simpler alternative: single table + GIST; add partitioning only when queries slow down.

---

## 4. Layer Strategy

### Table-per-layer (recommended)

| Layer | Table | Geometry type | Use |
|-------|-------|---------------|-----|
| Parcels | `forest_parcels` | MultiPolygon | Management boundaries |
| Stands | `forest_stands` | MultiPolygon | Sub-units |
| Roads | `infrastructure_roads` | LineString | Roads, paths |
| Water | `infrastructure_water` | MultiPolygon/LineString | Rivers, lakes |
| Events | `events` | Point | Incidents, inspections |

- One table per logical layer  
- Clear ownership and indexing  
- Simple to cache and serve separately  

### When to avoid

- Single table with `layer_type` and generic geometry: harder indexing and mixed use cases. Prefer separate tables.
- One table for all layers: only if layers are small and always queried together.

### API mapping

```
GET /layers/parcels?bbox=...
GET /layers/stands?bbox=...
GET /layers/roads?bbox=...
```

Each endpoint maps to its table. Client composes layers.

---

## 5. GeoJSON Handling

### Output

```sql
SELECT 
    id,
    ST_AsGeoJSON(geometry)::json AS geometry,
    name
FROM forest_parcels
WHERE geometry && bbox;
```

Or use `json_build_object` for full Feature:

```sql
SELECT json_build_object(
    'type', 'Feature',
    'id', id,
    'geometry', ST_AsGeoJSON(geometry)::json,
    'properties', json_build_object('name', name, 'area_ha', area_ha)
) FROM forest_parcels WHERE geometry && bbox;
```

### Input

```sql
-- GeoJSON to geometry
ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[...]}'), 4326)
```

Always set SRID 4326. GeoJSON implies WGS84.

### Simplification by zoom

```sql
-- Tolerance: larger = simpler (for zoomed-out)
-- ~0.0001 = ~10m at equator; ~0.001 = ~100m
ST_AsGeoJSON(
    ST_SimplifyPreserveTopology(geometry, tolerance),
    6  -- coordinate precision (decimal places)
)::json
```

| Zoom | Tolerance | Vertices |
|------|-----------|----------|
| 18+ | 0 | Full resolution |
| 12–17 | 0.00001 | Simplified |
| 8–11 | 0.0001 | More simplified |
| 5–7 | 0.001 | Very simplified |

Cache per zoom or compute on demand with short TTL.

### GeoJSON gotchas

- Coordinates are `[lon, lat]`, not `[lat, lon]`.
- No CRS in GeoJSON — WGS84 is assumed.
- Bbox in GeoJSON: `[minLon, minLat, maxLon, maxLat]`.

---

## 6. Coordinate Standardization (WGS84)

### Standard: EPSG:4326

| Aspect | Choice |
|--------|--------|
| Storage | WGS84 (4326) |
| API | WGS84 |
| GeoJSON | WGS84 (implicit) |

### Ingest

```
Input (any CRS) → ST_Transform(geom, 4326) → Store
```

Detect SRID from source (Shapefile, GeoPackage, etc.) and transform once on load.

### When to use projected CRS

| Use | CRS | Why |
|-----|-----|-----|
| Storage, API | 4326 | Standard, interoperable |
| Area in m²/ha | Local UTM or `geography` | Planar or spherical area |
| Distance in m | `ST_Distance(geography)` or UTM | Accurate lengths |

For area:

```sql
-- Use geography for correct area in m²
SELECT ST_Area(geometry::geography) / 10000 AS area_ha FROM forest_parcels;
```

Or store `area_ha` on write and avoid runtime computation.

### Precision

- 6 decimals: ~0.1 m  
- 7 decimals: ~1 cm  
- 6–7 is enough for forestry.

---

## 7. Common Performance Mistakes

| Mistake | Problem | Fix |
|---------|---------|-----|
| **No bbox filter** | Full table scan for spatial queries | Always use `&&` with viewport bbox first |
| **Function on indexed column** | Index not used | Transform the other operand, not the indexed geometry |
| **Full resolution for tiles** | Huge response, slow map | Simplify by zoom level |
| **Fetch full geometry when not needed** | Extra I/O and bandwidth | Use `ST_AsGeoJSON` only when needed; consider bbox-only for list views |
| **N+1 spatial queries** | Many round-trips | Batch: single query with `ST_Collect` or `WHERE id = ANY(ids)` |
| **Invalid geometry** | Index/query errors | Validate on ingest; use `ST_IsValid` |
| **Mixed SRID** | Wrong results | Store 4326; transform on ingest |
| **No GIST index** | Sequential scan | Create GIST on all geometry columns |
| **Large polygons unmodified** | Slow bbox/index ops | Simplify or subdivide if >10k vertices |
| **GeoJSON without simplification** | Bloated payloads | Simplify for map display; full only for edit |
| **Computing area on every read** | Repeated work | Store `area_ha`; update on geometry change |
| **Spatial join without bbox** | Cartesian explosion | Pre-filter both sides with bbox before join |

---

## 8. Quick Reference

```
Storage:  GEOMETRY(MultiPolygon, 4326)
Index:    GIST on geometry
Layer:    One table per layer
GeoJSON:  ST_AsGeoJSON with simplification by zoom
CRS:      WGS84 everywhere; transform on ingest
Area:     Store area_ha or use geography for runtime
```
