# Loading Thousands of Map Points — Best Practice

**Senior GIS architect view.** Optimize for performance. Avoid overengineering.

---

## The Hierarchy of Solutions

```
Bbox loading (always) → Clustering (usually) → Caching (always) → Vector tiles (when scale demands)
```

**Start with bbox + clustering + cache.** Add vector tiles only when you hit limits (50k+ points, sub-second pan, or multi-layer maps).

---

## 1. Bounding Box Loading

### Why it's foundational
Never load all points. Always filter by viewport. A country view might have 100k points; the visible area has 500.

### How it works
```
GET /events?bbox=minLon,minLat,maxLon,maxLat
```
- Server: `WHERE location && ST_MakeEnvelope(...)` — uses GIST index.
- Returns only points in the requested rectangle.

### Best practice
| Rule | Implementation |
|------|----------------|
| **Request slightly larger bbox** | Add 10–20% buffer so small pans don't trigger new requests |
| **Cap response size** | `limit=500` — if more points in viewport, return 500 + `truncated: true`; user zooms in for more |
| **Debounce requests** | Wait 150–300ms after pan/zoom ends before fetching; avoids request storm |
| **Cancel in-flight** | If user pans again, abort previous fetch |

### When bbox alone is enough
- <5,000 points in typical viewport after bbox filter
- Single layer (events only)
- No need for instant pan (100–300ms fetch is acceptable)

---

## 2. Clustering

### What it does
Groups nearby points into one symbol. User sees "47" instead of 47 markers. Zoom in → clusters split.

### When to use
- **Always** when zoomed out (zoom 5–12) and >100 points in view
- **Conditionally** at mid zoom: cluster if >200 points
- **Never** at high zoom (16+): show individuals

### Client-side (recommended first)
- Use **Supercluster** or map library built-in clustering (Leaflet.markercluster, Mapbox GL).
- Flow: fetch bbox → pass points to Supercluster → render clusters or single points.
- No backend changes. Fast to ship.
- Cost: client does clustering work; acceptable for 1k–10k points.

### Server-side (when client struggles)
- Pre-compute clusters per zoom level; API returns cluster centroids + counts.
- Smaller payload; client only renders.
- Needs new endpoint and clustering logic. Add when:
  - Payloads regularly >1MB after bbox
  - Clustering on client blocks main thread
  - Mobile or weak devices

### Best practice
| Rule | Implementation |
|------|----------------|
| **Start client-side** | Supercluster; no backend changes |
| **Cluster radius by zoom** | Larger radius when zoomed out (e.g. 40px → 80px at low zoom) |
| **Add server clustering** | Only when client-side clustering is proven bottleneck |

---

## 3. Vector Tiles

### What they are
Pre-rendered tiles at fixed zoom levels (like map imagery). Each tile is a small rectangular chunk of the world. Client requests tiles for visible area; renders them. Format: MVT (Mapbox Vector Tiles) or GeoJSON tile.

### When they make sense
| Scenario | Bbox + clustering | Vector tiles |
|----------|-------------------|--------------|
| 1–50k points | ✅ | Overkill |
| 50k–500k points | ⚠️ May struggle | ✅ Good fit |
| Multi-layer map (parcels, roads, events) | Custom per layer | ✅ One pipeline |
| Instant pan/zoom (no fetch delay) | ❌ | ✅ Tiles cached |
| Real-time data | ✅ | ❌ Tiles are prebuilt |

### How they work
1. Backend: generate MVT tiles (e.g. `GET /tiles/events/{z}/{x}/{y}.mvt`)
2. Tile server or PostGIS: `ST_AsMVT()` for each tile
3. Client: add as vector source; map lib renders
4. Caching: tiles are static for a time window; CDN/HTTP cache works well

### When NOT to use
- MVP or first version
- Data changes frequently
- Single point layer <50k points
- Team unfamiliar with MVT tooling

### Best practice
| Rule | Implementation |
|------|----------------|
| **Defer until needed** | Bbox + clustering handles most cases |
| **Add when** | >50k points, or need instant pan across large areas |
| **Use PostGIS `ST_AsMVT`** | No need for Tile38/tegola initially; PostGIS can serve tiles |
| **Cache tiles aggressively** | Tiles are immutable for their zoom; CDN or long max-age |

---

## 4. Caching

### Client in-memory (always)
| Key | Value | Eviction |
|-----|-------|----------|
| Rounded bbox (e.g. 2 decimals) | Points array | LRU, max 20 entries; TTL 5 min |

- Rounded bbox: `-122.41,37.77,-122.40,37.78` → key `-122.4,37.8,-122.4,37.8` (tile-like).
- Pan back to same area = cache hit; no refetch.
- Don't cache clusters; derive from cached points.

### HTTP cache
- `Cache-Control: private, max-age=60` on bbox endpoint.
- 60s is usually fine for map data.
- Tiles: `max-age=3600` or longer (tiles change rarely).

### Server-side (optional)
- Redis cache for hot bboxes (e.g. city centers, popular zooms).
- Key: `events:bbox:{rounded}`, value: JSON, TTL 5 min.
- Add when DB load from repeated identical bbox queries is high.

### Best practice
| Rule | Implementation |
|------|----------------|
| **Always** client in-memory | Simple Map/LRU; 20 entries |
| **Optional** HTTP headers | 60s for bbox, 1h+ for tiles |
| **Skip** IndexedDB for v1 | Add only for offline or very large cache |

---

## 5. Decision Tree

```
How many points in typical viewport after bbox?
├── < 500     → Bbox only. Optional clustering at low zoom.
├── 500–5k    → Bbox + client clustering. In-memory cache.
├── 5k–50k    → Bbox + limit 500 + client clustering. Strong cache.
└── > 50k     → Consider vector tiles. Or server-side clustering.
```

---

## 6. Minimal Implementation (No Overengineering)

| Layer | Do | Don't |
|-------|-----|-------|
| **Bbox** | Filter by viewport; add limit; buffer 10–20% | Load all; no limit |
| **Clustering** | Supercluster on client | Custom algo; server clustering first |
| **Caching** | In-memory by bbox, 20 entries, 5 min | IndexedDB; no cache |
| **Vector tiles** | Skip until >50k points | Build tiles for MVP |

### Recommended stack
- **Bbox API:** `GET /events?bbox=...&limit=500`
- **Client:** Map lib (Leaflet/Mapbox) + Supercluster
- **Cache:** `Map<bboxKey, points>` with simple LRU
- **Vector tiles:** Not in v1

---

## 7. Quick Reference

| Technique | When | Effort |
|-----------|------|--------|
| Bbox loading | Always | Done |
| Viewport buffer | Always | Low |
| Response limit | Always | Low |
| Client clustering | >100 points in view | Low |
| In-memory cache | Always | Low |
| HTTP Cache-Control | Optional | Low |
| Server clustering | Client bottleneck | Medium |
| Vector tiles | >50k points, instant pan | High |
