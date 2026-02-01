# Ship Events Today — Fastest Execution Order

**Goal:** Working Events module in minutes. No wasted steps.

---

## Prerequisites (one-time)

- Node.js 18+
- PostgreSQL 14+ with PostGIS
- Database `smart_forest` created

---

## Execution Order (fastest path)

### 1. Install (30 sec)
```bash
npm install
```

### 2. Database (1 min)
```bash
# Create DB
createdb smart_forest

# Enable PostGIS
psql smart_forest -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

### 3. Env (10 sec)
```bash
cp .env.example .env
# Edit .env if your postgres user/pass/host differ
```

### 4. Migrate (5 sec)
```bash
npm run migration:run
```

### 5. Start (10 sec)
```bash
npm run start:dev
```

### 6. Test (30 sec)
```bash
# Create event
curl -X POST http://localhost:3000/api/v1/events -H "Content-Type: application/json" -d "{\"title\":\"Test\",\"latitude\":37.77,\"longitude\":-122.42}"

# List events (world bbox)
curl "http://localhost:3000/api/v1/events?bbox=-180,-90,180,90"
```

### 7. Map (instant)
```
http://localhost:3000/map/
```

---

## Total Time: ~3 minutes

---

## What's Included

| Item | Status |
|------|--------|
| Event entity (UUID, title, description, severity, POINT) | ✓ |
| Migration (PostGIS + GIST index) | ✓ |
| POST /api/v1/events | ✓ |
| GET /api/v1/events?bbox=... | ✓ |
| Validation (lat/lng, severity, bbox format) | ✓ |
| Map at /map/ | ✓ |

---

## API Reference

**POST /api/v1/events**
```json
{
  "title": "string (required)",
  "description": "string (optional)",
  "latitude": -90 to 90,
  "longitude": -180 to 180,
  "severity": "low|medium|high|critical (optional, default: medium)"
}
```

**GET /api/v1/events?bbox=minLon,minLat,maxLon,maxLat**
```
Example: ?bbox=-122.5,37.5,-122.0,38.0
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `connection refused` | PostgreSQL running? Check DATABASE_URL in .env |
| `relation "events" does not exist` | Run `npm run migration:run` |
| `extension "postgis" does not exist` | Install PostGIS: `CREATE EXTENSION postgis` in DB |
| Migration fails | Drop table: `psql smart_forest -c "DROP TABLE IF EXISTS events CASCADE;"` then re-run |
