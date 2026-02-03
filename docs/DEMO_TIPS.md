# Leadership Demo Tips

## What's Implemented

- **Auto-zoom** — Map fits to all events on load
- **Color-coded markers** — Red (high/critical), Yellow (medium), Green (low)
- **Rich popup** — Title, severity, description, created date on click
- **Event count badge** — Top-right shows "Events: N"

---

## 3 Visual Tricks for Perceived Value

### 1. Event count badge (included)
Shows "Events: N" in the corner. Leadership sees real data volume at a glance. "47 events monitored" feels more tangible than an empty map.

### 2. Smooth zoom on load (included)
Map animates to fit events instead of jumping. Small detail, but feels polished and intentional.

### 3. Severity colors (included)
Red/yellow/green creates instant "dashboard" recognition. Non-technical viewers understand status without reading.

---

## Pre-Demo: Seed Data

Run before the demo so the map isn't empty:

```bash
# Mix of severities and locations
curl -X POST http://localhost:9000/api/v1/events -H "Content-Type: application/json" -d '{"title":"Fire risk - Sector A","latitude":37.77,"longitude":-122.42,"severity":"high","description":"Elevated temperature reading"}'
curl -X POST http://localhost:9000/api/v1/events -H "Content-Type: application/json" -d '{"title":"Routine inspection","latitude":37.78,"longitude":-122.40,"severity":"medium","description":"Quarterly health check"}'
curl -X POST http://localhost:9000/api/v1/events -H "Content-Type: application/json" -d '{"title":"Minor observation","latitude":37.76,"longitude":-122.44,"severity":"low","description":"Small debris noted"}'
```

---

## Talking Points

- "Real-time monitoring" — Map loads live data from the API
- "Risk visualization" — Red = urgent, green = low priority
- "Spatial intelligence" — Events tied to GPS; scales to national coverage
