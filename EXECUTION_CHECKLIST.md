# Backend Ship Checklist — GIS Events (Days, Not Weeks)

**Most efficient order.** No fluff. Do in sequence.

---

## Phase 0: Prerequisites (30 min)

- [ ] Node 18+, PostgreSQL 14+
- [ ] `npm init` or NestJS CLI: `npx @nestjs/cli new backend`
- [ ] Install: `pg`, `typeorm`, `@nestjs/typeorm`, `class-validator`, `class-transformer`
- [ ] Create DB: `createdb smart_forest`
- [ ] Enable PostGIS: `psql smart_forest -c "CREATE EXTENSION postgis;"`

---

## Phase 1: Database (1 hour)

### Step 1: Migration file
- [ ] Create migration: `CREATE TABLE events` with `location GEOMETRY(Point, 4326)`
- [ ] Add GIST index: `CREATE INDEX ON events USING GIST (location)`
- [ ] Add `id`, `title`, `description`, `severity`, `created_at`, `updated_at`
- [ ] Run: `npm run migration:run`

### Step 2: Entity (TypeORM)
- [ ] Create Event entity with columns (skip `location` in entity — use raw SQL)
- [ ] Severity enum: low, medium, high, critical
- [ ] `synchronize: false` — migrations only

---

## Phase 2: API (2 hours)

### Step 3: POST /events (create)
- [ ] CreateEventDto: title, latitude, longitude, description?, severity?
- [ ] Validate: lat -90..90, lng -180..180
- [ ] Service: `INSERT ... ST_SetSRID(ST_MakePoint($lng, $lat), 4326)`
- [ ] Return created event with lat/lng from `ST_X`, `ST_Y`
- [ ] Test: `curl -X POST .../events -d '{"title":"X","latitude":37,"longitude":-122}'`

### Step 4: GET /events?bbox= (spatial)
- [ ] Query param: `bbox=minLon,minLat,maxLon,maxLat`
- [ ] Service: `WHERE location && ST_MakeEnvelope($1,$2,$3,$4,4326)`
- [ ] Return array with lat/lng extracted
- [ ] Test: `curl .../events?bbox=-180,-90,180,90`

### Step 5: GET /events/:id (single)
- [ ] Service: `SELECT ... WHERE id = $1`
- [ ] 404 if not found
- [ ] Test: `curl .../events/{id}`

### Step 6: PATCH /events/:id (optional)
- [ ] UpdateEventDto: partial (title?, description?, severity?)
- [ ] Service: `UPDATE ... WHERE id = $1`
- [ ] Skip if time-constrained; add later

---

## Phase 3: Wire & Ship (30 min)

### Step 7: Module wiring
- [ ] TypeORM `forRoot` with Postgres URL
- [ ] EventsModule: controller, service, entity
- [ ] ValidationPipe global
- [ ] CORS if frontend on different port

### Step 8: Smoke test
- [ ] POST creates event
- [ ] GET bbox returns it
- [ ] GET by id returns it
- [ ] Map loads and shows marker (if you have map)

---

## Order Summary (copy-paste)

```
1. createdb smart_forest
2. psql smart_forest -c "CREATE EXTENSION postgis;"
3. Write migration (table + GIST index)
4. Run migration
5. Entity (no location column)
6. CreateEventDto + POST handler + raw INSERT with ST_MakePoint
7. GET ?bbox= + raw SELECT with && 
8. GET :id
9. Wire module
10. Test
```

---

## What to Skip (for speed)

| Skip | Add later |
|------|-----------|
| PATCH/DELETE | When needed |
| Pagination | When >500 events |
| Auth | When deploying |
| Error handling beyond 404 | When you hit edge cases |
| DTO for bbox validation | Return [] for bad bbox |
| Separate config module | Env vars inline |

---

## Time Estimate

| Phase | Time |
|-------|------|
| 0 Prerequisites | 30 min |
| 1 Database | 1 hr |
| 2 API | 2 hr |
| 3 Wire & ship | 30 min |
| **Total** | **~4 hours** |
