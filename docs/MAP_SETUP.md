# Map Setup — MVP Events Visualization

**Goal:** See event points on a map. Minimal setup. Speed over beauty.

---

## Stack

| Layer | Choice |
|-------|--------|
| Map library | **Leaflet** (no API key, lighter than Mapbox) |
| Tiles | OpenStreetMap (free) |
| Data | NestJS API `/api/v1/events?bbox=...` |
| State | None — vanilla JS |

---

## Setup

### 1. No extra install
Leaflet is loaded from CDN. No `npm install` for the map.

### 2. Run backend
```bash
npm run start:dev
```

### 3. Open map
```
http://localhost:3000/map/
```
or
```
http://localhost:3000/map/index.html
```

---

## What It Does

1. **Loads map** — Leaflet + OSM tiles, centered at 0,0 zoom 2
2. **Fetches events** — On load and after pan/zoom (200ms debounce)
3. **Displays markers** — One per event at (latitude, longitude)
4. **Click marker** — Popup with title + severity

---

## API Format

**Request:**
```
GET /api/v1/events?bbox=minLon,minLat,maxLon,maxLat
```

**Response:**
```json
[
  {
    "id": "uuid",
    "title": "Tree inspection",
    "description": "...",
    "latitude": 37.77,
    "longitude": -122.42,
    "severity": "medium",
    "createdAt": "2025-01-31T...",
    "updatedAt": "2025-01-31T..."
  }
]
```

---

## File Structure

```
map/
  index.html   # Single file: Leaflet + fetch + markers
```

---

## Practices

| Practice | Implementation |
|----------|----------------|
| No framework | Vanilla JS; no React/Vue |
| No state lib | Direct DOM / Leaflet APIs |
| Bbox loading | Fetch only visible area |
| Debounce | 200ms after pan/zoom |
| Popup content | Escape HTML to avoid XSS |
| Same origin | `/api/v1` relative path when served from NestJS |

---

## Standalone Use (without NestJS)

If opening `map/index.html` directly (file://):

1. Set API to full URL: `const API = 'http://localhost:3000/api/v1';`
2. Enable CORS on NestJS: `app.enableCors({ origin: '*' });` in main.ts
3. Run NestJS and open the HTML file in browser

Or run a simple server:
```bash
npx serve map
```
Then set `API = 'http://localhost:3000/api/v1'` and ensure CORS allows the serve origin.
