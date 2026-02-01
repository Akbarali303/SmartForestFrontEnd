# Map Data Loading Architecture — Production Recommendation

**Goal:** Prevent map freezing with thousands or millions of points  
**Stack:** NestJS, PostgreSQL + PostGIS, Leaflet/Mapbox  
**Principle:** Start simple; add complexity only when proven necessary

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 1 (MVP — 0 to ~100k points)                                          │
│  Bbox API + Client clustering + In-memory cache                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ When: >50k points in typical view,
                                    │       or pan/zoom feels slow
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 2 (Scale)                                                             │
│  Add: API limit, zoom-based filtering, HTTP cache                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ When: >200k points, need instant pan,
                                    │       or multi-layer heavy maps
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 3 (Optional)                                                          │
│  Vector tiles for static/frequently-accessed layers                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Start with Phase 1. Most forestry platforms never need Phase 3.**

---

## 1. Bounding Box Queries

### Implementation
```
GET /api/v1/events?bbox=minLon,minLat,maxLon,maxLat
```

- Backend: `WHERE location && ST_MakeEnvelope($1,$2,$3,$4, 4326)`
- GIST index makes this O(log n) — sub-10ms for millions of rows
- Always filter by viewport; never return all points

### Best practice
| Rule | Implementation |
|------|----------------|
| **Viewport only** | Request only what's visible |
| **Buffer 15%** | Request bbox 15% larger than viewport — fewer requests on small pans |
| **Limit response** | `limit=500` — cap per request; zoom in for more |
| **Debounce 200ms** | Wait for pan/zoom to settle before fetching |
| **Cancel previous** | Abort in-flight request when user pans again |

### API shape
```
GET /events?bbox=-122.5,37.5,-122.0,38.0&limit=500
```
- Return `{ data: [...], truncated: true }` if more points exist in bbox
- Client clusters the 500; user zooms in to see remainder

---

## 2. Server-Side vs Client-Side Clustering

### Recommendation: Client-side first

| Approach | When to use | Effort |
|----------|-------------|--------|
| **Client-side** | Default. Works for 1k–50k points in view. | Low — add Supercluster |
| **Server-side** | Payload >200KB regularly; weak devices; mobile-first | Medium — new endpoint |

### Client-side (Phase 1)
- Fetch bbox → pass to Supercluster (or Mapbox/Leaflet built-in)
- No backend changes
- Clustering is cheap: 10k points in ~10–20ms
- Add only when points in viewport >100

### Server-side (Phase 2, if needed)
- New endpoint: `GET /events/clusters?bbox=...&zoom=12`
- Server returns cluster centroids + counts
- Smaller payload; client just renders
- Add when: client clustering blocks UI, or payloads consistently >200KB

### Decision rule
```
Points in viewport after bbox fetch:
< 500   → No clustering needed
500–10k → Client clustering (Supercluster)
> 10k   → Add limit=500; if still slow, add server clustering
```

---

## 3. Vector Tiles vs GeoJSON

| Format | Pros | Cons | When |
|--------|------|------|------|
| **GeoJSON** | Simple; works with bbox API; flexible | Larger payload; client does work | Phase 1–2; dynamic data |
| **Vector tiles (MVT)** | Small; CDN cacheable; instant pan | Pre-built; stale; more setup | Phase 3; static/semi-static layers |

### Recommendation
- **Phase 1–2: GeoJSON** via bbox API
- **Phase 3: MVT** only for layers that are large, mostly static, and need instant pan (e.g. parcel boundaries for whole country)
- Events (dynamic) → GeoJSON. Parcel boundaries (static) → consider MVT when >100k polygons

### Don't mix early
- One GeoJSON bbox pipeline handles 99% of use cases
- Add MVT only for a specific layer that demands it

---

## 4. Tile-Based Loading Strategy

### Two models

| Model | How it works | Use |
|-------|--------------|-----|
| **Bbox (dynamic)** | Request current viewport bbox | Points, dynamic data, events |
| **XYZ tiles (static)** | Request /z/x/y tiles | Base maps, parcel boundaries (Phase 3) |

### For your use case (events, parcels, devices)
- **Use bbox, not XYZ tiles** for Phase 1–2
- Bbox = one request per viewport change
- XYZ = many small requests; adds complexity; only worth it when you have pre-built tiles

### When to use XYZ
- Serving raster/vector base maps (roads, imagery)
- Pre-generated MVT layers (e.g. parcels)
- Not for real-time or frequently-updated point data

**Verdict:** Bbox-based loading. Add tile endpoint only when introducing MVT (Phase 3).

---

## 5. Caching Map Queries

### Client in-memory (always)
| Key | Value | Eviction |
|-----|-------|----------|
| Rounded bbox (e.g. 3 decimals) | GeoJSON points | LRU, 20 entries; 5 min TTL |

- Round bbox so similar pans hit cache: `-122.41,37.77,-122.40,37.78` → `-122.4,37.8,-122.4,37.8`
- On cache hit: recluster from cached points; no fetch
- Don't cache clusters — derive from cached points

### HTTP cache (low effort)
```http
Cache-Control: private, max-age=60
```
- 60s for events; 5 min for parcels if they change rarely
- Same bbox within 60s = browser uses cached response

### Server cache (Phase 2, optional)
- Redis: key `events:bbox:{rounded}`, TTL 2–5 min
- Add when same bboxes are requested frequently (e.g. popular areas)
- Invalidate on event create/update (or accept stale for 2 min)

### What not to cache
- Clusters (derived)
- IndexedDB in v1 (overkill)

---

## 6. Zoom-Level Data Filtering

### Backend zoom hint (optional)
```
GET /events?bbox=...&zoom=14
```
- Low zoom (5–10): return fewer points or pre-clustered; high zoom: more detail
- Implementation: `limit = zoom < 12 ? 200 : 500`
- Or: server-side clustering returns different cluster radii by zoom

### Client-side
- Supercluster naturally adapts: low zoom = big clusters; high zoom = small clusters or points
- No backend change needed if using client clustering

### When to add zoom param
- Server-side clustering
- Reducing payload at country/region zoom
- Simple: `limit=100` when zoom<10, `limit=500` when zoom>=10

**Verdict:** Optional. Client clustering handles zoom. Add zoom param when doing server clustering.

---

## 7. When to Introduce Vector Tiles

| Trigger | Action |
|---------|--------|
| Parcel layer >100k polygons; pan feels sluggish | Consider MVT for parcels |
| Need instant pan (no fetch delay) | MVT or aggressive caching |
| Same layer requested by many users | MVT + CDN |
| Dynamic events, IoT points | Stay with GeoJSON bbox |
| MVP, <50k points total | Don't add MVT |

### MVT implementation (when needed)
1. Endpoint: `GET /tiles/parcels/{z}/{x}/{y}.mvt`
2. PostGIS: `ST_AsMVT()` from parcels for tile bounds
3. Cache: CDN or `max-age=3600` (tiles change rarely)
4. Client: Add as vector source to Mapbox/Leaflet

**Don't build this until you have the problem.**

---

## 8. Common Mistakes That Kill GIS Performance

| Mistake | Impact | Fix |
|---------|--------|-----|
| **Load all points** | Freeze, OOM | Always bbox filter |
| **No GIST index** | Full table scan | `CREATE INDEX USING GIST (geom)` |
| **Function on indexed column** | Index not used | Transform bbox, not geometry |
| **No bbox in WHERE** | Scans everything | `WHERE geom && bbox` first |
| **Fetch on every pan pixel** | Request storm | Debounce 200ms |
| **No limit** | 50k points in one response | `limit=500` |
| **Render 10k DOM markers** | Lag | Cluster or use canvas |
| **No client cache** | Redundant fetches | In-memory by bbox |
| **Full resolution for tiles** | Huge payloads | Simplify by zoom |
| **MVT for dynamic data** | Stale data | Use GeoJSON for real-time |
| **Over-fetch** | Wasted bandwidth | Buffer 15%, not 50% |
| **Synchronous spatial query in hot path** | Blocking | Already async; ensure connection pool |

---

## 9. Recommended Architecture (Startup → Scale)

### Phase 1 — Ship it (weeks)
```
[NestJS] GET /events?bbox=...&limit=500
    ↓
[PostgreSQL] WHERE location && bbox, LIMIT 500
    ↓
[Client] Supercluster → render clusters/points
[Client] In-memory cache (20 entries, 5 min)
```

**Backend:** Bbox + limit. **Frontend:** Supercluster + cache. **No vector tiles.**

### Phase 2 — Optimize (when needed)
- Add `zoom` param: reduce limit at low zoom
- HTTP `Cache-Control: max-age=60`
- Optional: Redis cache for hot bboxes
- Optional: Server-side clustering endpoint if client struggles

### Phase 3 — Scale (only if required)
- MVT for parcel/boundary layers (static)
- Keep events/devices on GeoJSON bbox (dynamic)
- CDN for tile static assets

---

## 10. Checklist

| Item | Phase | Effort |
|------|-------|--------|
| Bbox query with GIST | 1 | Done |
| limit=500 on API | 1 | Low |
| Client Supercluster | 1 | Low |
| Viewport buffer 15% | 1 | Low |
| Debounce 200ms | 1 | Low |
| In-memory bbox cache | 1 | Low |
| HTTP Cache-Control | 2 | Low |
| Zoom-based limit | 2 | Low |
| Server clustering | 2 | Medium |
| MVT tiles | 3 | High |

---

## Summary

**Best production approach for a scaling startup:**

1. **Bbox API** with `limit=500`, GIST index, 15% buffer
2. **Client clustering** (Supercluster) — no backend change
3. **GeoJSON** — skip vector tiles until a layer demands it
4. **Bbox loading** — no XYZ for points; one request per viewport
5. **Cache** — client in-memory (20 entries) + optional HTTP 60s
6. **Zoom filtering** — optional; client clustering usually enough
7. **Vector tiles** — only for large, static polygon layers (e.g. parcels)
8. **Avoid** — load-all, no limit, no index, fetch-every-pan, 10k DOM markers
