# Map Integration Strategy — Frontend Performance

**Goal:** Load thousands of spatial points without killing performance  
**Principle:** Clustering → Tiling → Caching. No overengineering.

---

## 1. The Problem

Rendering 10,000+ points on a map causes:
- Slow initial load (large JSON payload)
- Laggy pan/zoom (DOM or canvas overload)
- Memory pressure (each marker = object + event listeners)

---

## 2. Strategy: Three Layers

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: Clustering (server or client)                          │
│  "Show 47 events" instead of 10,000 markers                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 2: Tiling / Viewport filter                               │
│  Only fetch what's visible in the current map bounds             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 3: Caching                                                │
│  Avoid re-fetching the same bbox on pan-back or zoom-out         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Clustering

### What it does
Group nearby points into a single marker. User sees "47" instead of 47 individual pins. Click cluster → zoom in → clusters break apart.

### Where to cluster

| Approach | Pros | Cons |
|----------|------|------|
| **Server-side** | Small payload; client only renders clusters | Needs new endpoint; clustering algo on backend |
| **Client-side** | Reuse existing bbox API; flexible | Larger payload; client does the work |
| **Hybrid** | Server returns pre-clustered for zoom levels | Most control; more backend logic |

**Recommendation:** Start with **client-side clustering**. Use a library (e.g. Supercluster, Mapbox GL’s built-in). No backend changes. Add server-side only if payloads stay large after bbox filtering.

### Client-side flow
1. Fetch events in viewport bbox: `GET /events?bbox=...`
2. Pass points to Supercluster (or similar)
3. Render cluster markers or single markers based on zoom
4. On zoom/pan: re-run clustering on existing data if bbox unchanged; else refetch

### When to cluster
- **Zoom 5–12:** Always cluster. Thousands of points → dozens of clusters.
- **Zoom 13–15:** Cluster only if >200 points in view.
- **Zoom 16+:** Show individuals; rarely >100 in view.

---

## 4. Tiling / Viewport Filtering

### Principle
Only request data for the **visible bounding box**. Your API already supports this: `GET /events?bbox=minLon,minLat,maxLon,maxLat`.

### Add buffer (slight overfetch)
Request a bbox 10–20% larger than the viewport. Reduces requests when the user pans a bit.

```
Viewport:     [minLon, minLat, maxLon, maxLat]
Request bbox: [minLon - buffer, minLat - buffer, maxLon + buffer, maxLat + buffer]
```

### Zoom-based limit
Cap the number of points returned per request. For example:
- `limit=500` — beyond that, return 500 + `truncated: true`
- Client clusters the 500; user zooms in to see more

Prevents a single request from returning 50,000 points when the viewport covers a whole country.

---

## 5. Caching

### Client-side (in-memory)

| Key | Value | TTL |
|-----|-------|-----|
| `bbox` (rounded) | `Event[]` | 5 min |

- Hash or round bbox to a cache key (e.g. 2 decimal places).
- On pan/zoom, check cache before requesting.
- Evict old entries when cache size exceeds N entries (e.g. 20).

### HTTP cache
- `Cache-Control: private, max-age=60` on `GET /events?bbox=...`
- Browser reuses response for identical bbox within 60s.
- Use cautiously: stale data is acceptable for maps; 1–2 min is usually fine.

### What not to cache
- Don’t cache clusters (derived from points).
- Don’t persist to IndexedDB for first version; in-memory is enough.

---

## 6. API Shape for Map Use

### Current
```
GET /events?bbox=minLon,minLat,maxLon,maxLat
```

### Optional additions

| Param | Use | Default |
|-------|-----|---------|
| `limit` | Cap returned points | 500 |
| `simplify` | Future: return aggregated clusters from server | — |

For MVP, `limit` is the only one worth adding. Keep the API simple.

---

## 7. Frontend Flow (Minimal)

```
1. Map loads → get viewport bbox → GET /events?bbox=...
2. Store in memory (cache key = rounded bbox)
3. Run Supercluster on points → render cluster markers
4. User pans → new bbox → check cache
   - Hit: recluster cached points, render
   - Miss: fetch, cache, cluster, render
5. User zooms in → same bbox, more detail
   - Recluster same points at new zoom (no fetch)
   - Or: zoom crossed threshold → refetch with smaller bbox
```

### When to refetch
- Bbox changed enough (e.g. panned >20% of viewport)
- Zoom level changed by 2+ (optional; can rely on clustering)
- Manual refresh
- After 5 min (cache TTL)

---

## 8. Implementation Checklist

| Item | Effort | Impact |
|------|--------|--------|
| Bbox query (done) | — | Critical |
| Add `limit` to API | Low | High |
| Client clustering (Supercluster) | Low | High |
| In-memory bbox cache | Low | Medium |
| Viewport buffer | Low | Medium |
| HTTP Cache-Control | Low | Low |
| Server-side clustering | Medium | Only if client still struggles |

---

## 9. What to Avoid

| Avoid | Why |
|-------|-----|
| Loading all points upfront | Kills performance |
| No clustering at low zoom | Too many DOM nodes |
| Fetch on every tiny pan | Request storm |
| Complex tile protocol (WMTS/XYZ) | Overkill for points; bbox is enough |
| Web workers for clustering (initially) | Add only if main thread blocks |
| IndexedDB for first version | In-memory cache is enough |
| Custom clustering algorithm | Use Supercluster or similar |

---

## 10. Quick Reference

```
Clustering:  Client-side with Supercluster; cluster when zoom < 13 or points > 200
Tiling:      Bbox-only; request viewport + 10–20% buffer; limit 500/request
Caching:     In-memory by bbox, 5 min TTL, ~20 entries max
Refetch:     When bbox moves >20% or cache miss
```
