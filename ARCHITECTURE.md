# Smart Forest — Backend Architecture

**Version:** 1.1  
**Target:** National-level GIS + Data platform  
**Team:** 7–12 developers  
**Style:** Modular Monolith, API-first, DDD, Clean Architecture

---

## ⚠️ Critical Analysis (v1.0 Weaknesses)

Before adopting this architecture, the following weaknesses were identified and addressed:

| # | Weakness | Severity | Root Cause |
|---|----------|----------|------------|
| 1 | **Inbound integration flow unspecified** | High | Government/IoT push data → unclear how it reaches domains without coupling |
| 2 | **Users/Auth as "just another domain"** | High | Permission checks needed everywhere; domain coupling risk |
| 3 | **Cross-schema FK contradiction** | Medium | "inventory FK to forest.parcels" vs "avoid cross-schema FKs" |
| 4 | **Reports read-coupling ambiguous** | High | Reports aggregates across domains; no explicit pattern |
| 5 | **Event bus underspecified** | Medium | No schema versioning, ordering, or sync vs async policy |
| 6 | **Queue vs Event usage unclear** | Medium | When to use in-process events vs RabbitMQ? |
| 7 | **Observability absent** | High | Logging, metrics, tracing missing for gov-scale |
| 8 | **Security thin** | High | Secrets, audit, PII handling not defined |
| 9 | **Cache key inconsistency** | Low | `parcel:{id}` vs `forest:parcel:uuid` |
| 10 | **Pagination mismatch** | Medium | "cursor-based for exports" vs `page, limit` (offset) in API |
| 11 | **File registry schema undefined** | Low | `file_registry` table has no home |
| 12 | **SRID policy contradictory** | Low | 4326 vs national grid — when each? |
| 13 | **Core GIS scope creep risk** | Medium | No boundary between GIS primitives vs domain logic |
| 14 | **Idempotency storage unspecified** | Medium | Where do we store `batch_id` dedup? |
| 15 | **NestJS alignment missing** | Low | CQRS, EventEmitter, validation not specified |
| 16 | **Plugin system premature** | Low | Vague; risk of overengineering |

---

## 1️⃣ Folder Structure

```
src/
├── app/
│   ├── app.module.ts
│   ├── app.controller.ts
│   ├── health/                   # Liveness, readiness
│   └── config/
│       ├── config.module.ts
│       ├── app.config.ts
│       ├── database.config.ts
│       ├── redis.config.ts
│       └── queue.config.ts
│
├── core/                           # Shared kernel — ZERO domain dependencies
│   ├── core.module.ts
│   ├── auth/                       # Abstractions only; Users implements
│   │   ├── auth-context.interface.ts
│   │   └── permission-checker.interface.ts
│   ├── gis/                        # GIS engine — stays in core
│   │   ├── gis.module.ts
│   │   ├── services/
│   │   │   ├── geometry.service.ts
│   │   │   ├── spatial-index.service.ts
│   │   │   └── coordinate-transform.service.ts
│   │   ├── interfaces/
│   │   │   └── gis.interface.ts
│   │   └── utils/
│   │       └── wkt-parser.ts
│   ├── shared/
│   │   ├── types/
│   │   ├── value-objects/
│   │   ├── exceptions/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   └── filters/
│   └── events/
│       └── domain-event-bus.ts
│
├── domains/
│   ├── forest/
│   │   ├── forest.module.ts
│   │   ├── application/
│   │   │   ├── commands/
│   │   │   ├── queries/
│   │   │   └── handlers/
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   ├── value-objects/
│   │   │   ├── aggregates/
│   │   │   └── repositories/
│   │   ├── infrastructure/
│   │   │   ├── persistence/
│   │   │   └── mappers/
│   │   └── presentation/
│   │       └── controllers/
│   │
│   ├── inventory/
│   │   └── [same structure]
│   │
│   ├── monitoring/                 # IoT/sensor domain
│   │   └── [same structure]
│   │
│   ├── alerts/
│   │   └── [same structure]
│   │
│   ├── reports/
│   │   └── [same structure]
│   │
│   └── users/                      # Auth + identity
│       └── [same structure]
│
├── integrations/                   # External systems — isolated adapters
│   ├── integrations.module.ts
│   ├── government/
│   │   ├── government.module.ts
│   │   ├── adapters/
│   │   │   └── government-api.adapter.ts
│   │   └── contracts/
│   │       └── government.contract.ts
│   ├── iot/
│   │   ├── iot.module.ts
│   │   ├── adapters/
│   │   │   └── device-ingest.adapter.ts
│   │   └── contracts/
│   ├── weather/
│   │   └── [same pattern]
│   └── maps/
│       └── [same pattern]
│
├── infrastructure/
│   ├── infrastructure.module.ts
│   ├── database/
│   │   ├── postgres/
│   │   │   ├── postgres.module.ts
│   │   │   └── migrations/
│   │   └── timescale/
│   │       └── timescale.module.ts
│   ├── cache/
│   │   └── redis.module.ts
│   ├── queue/
│   │   └── rabbitmq.module.ts
│   └── storage/
│       └── storage.module.ts
│
└── plugins/                        # Defer until needed; stub only
    └── plugin.contract.ts          # Interface when use case arises
```

---

## 2️⃣ Module Boundaries

| Module | Responsibility | Depends On | Exposes |
|--------|----------------|------------|---------|
| **Core** | GIS engine, shared types, events, guards | Nothing (zero domain deps) | GIS services, value objects, event bus |
| **Forest** | Forest stands, parcels, boundaries | Core | Commands, queries |
| **Inventory** | Tree inventory, species, measurements | Core | Commands, queries |
| **Monitoring** | Sensor data, IoT ingestion | Core | Commands, queries |
| **Alerts** | Fire, pest, anomaly alerts | Core | Commands, queries |
| **Reports** | Aggregations, exports, dashboards | Core | Commands, queries. Reads from other schemas (infra only; no domain import). |
| **Users** | Auth, roles, permissions | Core | Commands, queries |
| **Integrations** | Government, IoT, weather, maps | Core | Adapters (injected) |
| **Infrastructure** | DB, cache, queue, storage | Core | Repositories, clients |

**Communication between domains:** Via events (DomainEventBus) or queues — never direct imports.

### Inbound Integration Flow (Critical)

When external systems *push* data (government API, IoT ingestion):

1. **Entry point:** Dedicated controller in `integrations/` (e.g., `GovernmentWebhookController`) or API in `monitoring/` for IoT.
2. **Validation:** Thin validation layer (schema, signature); no domain logic.
3. **Publish:** Emit event to in-process bus or enqueue job — **do not call domain services directly**.
4. **Domain subscribes:** Forest/Monitoring domain has handler that processes the event/job and owns the write.

```
Government POST /webhooks/parcel-updates
  → Integrations.GovernmentWebhookController
  → Publish DomainEvent "Government.ParcelDataReceived" (or enqueue job)
  → Forest.ParcelImportHandler subscribes
  → Forest domain writes to forest.parcels
```

### Auth / Users as Cross-Cutting Concern

- **Core** defines: `IAuthContext` (current user, tenant), `IPermissionChecker` (abstract).
- **Users domain** implements these interfaces; app wires at bootstrap.
- **All domains** depend on Core's `IAuthContext`, **never** on Users domain types.
- Guards, decorators (`@RequirePermission('parcel:write')`) live in Core.

---

## 3️⃣ Dependency Rules

### Dependency Flow (Strict)

```
Integrations ──► Domains ──► Core
Infrastructure ──► Domains ──► Core
Domains ◄──► Domains: FORBIDDEN (use events or cross-domain services)
Core: no external dependencies
```

### Import Rules (Enforce via ESLint)

| From | May Import |
|------|------------|
| `core/` | Nothing outside `core/` |
| `domains/*/application` | `core/`, own `domain/` |
| `domains/*/domain` | `core/` only |
| `domains/*/infrastructure` | `core/`, own `domain/`, `application` |
| `domains/*/presentation` | `core/`, own `application` |
| `integrations/*` | `core/`, own `contracts` |
| `infrastructure/*` | `core/` |

### Cross-Domain Communication

- **In-process events (sync):** Fire-and-forget notifications within same request. Use for: cache invalidation, lightweight side effects. Keep handlers fast (<50ms).
- **Queue (async):** Cross-domain workflows that must not block. Use for: alert evaluation, report generation, bulk imports. Event handler can *publish to queue* — e.g., `ParcelCreated` handler enqueues `alerts.evaluate`.
- **Shared read models:** Reports domain may **read** from other schemas (read-only). No application-layer imports; infrastructure layer only. Prefer materialized views for heavy aggregates.

---

## 4️⃣ Database Architecture

### Primary: PostgreSQL + PostGIS

```
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL (Primary)                          │
├─────────────────────────────────────────────────────────────────┤
│ forest schema                                                    │
│   - parcels, stands, boundaries (GEOMETRY)                       │
│   - Spatial indexes: GIST on geometry columns                    │
│                                                                  │
│ inventory schema                                                 │
│   - trees, species, measurements                                 │
│   - parcel_id UUID (soft ref, NO FK — extraction-friendly)       │
│                                                                  │
│ monitoring schema                                                │
│   - devices, device_locations (POINT)                            │
│   - NOT sensor readings (→ TimescaleDB)                          │
│                                                                  │
│ alerts schema                                                    │
│   - alert_definitions, alert_instances                           │
│                                                                  │
│ reports schema                                                   │
│   - report_definitions, report_runs, report_outputs              │
│                                                                  │
│ users schema                                                     │
│   - users, roles, permissions, sessions                          │
│                                                                  │
│ shared schema (cross-domain, minimal)                            │
│   - file_registry (id, path, size, checksum, domain_ref, created)│
└─────────────────────────────────────────────────────────────────┘
```

### TimescaleDB (Hypertables for Time-Series)

```
┌─────────────────────────────────────────────────────────────────┐
│                    TimescaleDB (sensor data)                     │
├─────────────────────────────────────────────────────────────────┤
│ sensor_readings (hypertable)                                     │
│   - time (partition key)                                         │
│   - device_id                                                    │
│   - metric_type                                                  │
│   - value (DOUBLE PRECISION)                                     │
│   - location (GEOMETRY, optional)                                │
│   - Compression policies, retention policies                     │
└─────────────────────────────────────────────────────────────────┘
```

### Connection Strategy

- **PostgreSQL:** Shared connection pool; schema-qualified queries. Per-domain pools only if connection exhaustion observed.
- **TimescaleDB:** Same PostgreSQL instance (TimescaleDB extension). `sensor_readings` lives in `monitoring` schema.
- **Migrations:** One folder `infrastructure/database/migrations/`; ordered by schema (shared → users → forest → inventory → monitoring → alerts → reports).

### Schema Conventions

| Pattern | Use |
|---------|-----|
| `id` UUID primary key | All main tables |
| `created_at`, `updated_at` | Audit (nullable for bulk loads) |
| `version` | Optimistic locking where needed |
| `GEOMETRY` + SRID 4326 | **Default.** All APIs, GeoJSON, external systems. Ingest transforms to 4326. |
| `GEOMETRY` + SRID local | **Only** when national mapping authority requires (e.g., UTM zone). Store both or transform on write. |
| GIST index | All geometry columns |
| Partial indexes | For status, type filters |

---

## 5️⃣ Queue Strategy

### RabbitMQ Topology

```
                    ┌──────────────────────────────────────────┐
                    │              RabbitMQ                    │
                    └──────────────────────────────────────────┘
                                         │
         ┌───────────────────────────────┼───────────────────────────────┐
         │                               │                               │
         ▼                               ▼                               ▼
┌─────────────────┐           ┌─────────────────┐           ┌─────────────────┐
│ smart-forest.   │           │ smart-forest.   │           │ smart-forest.   │
│ ingest          │           │ alerts          │           │ reports         │
│ (IoT data)      │           │ (alert checks)  │           │ (report jobs)   │
└────────┬────────┘           └────────┬────────┘           └────────┬────────┘
         │                             │                             │
         ▼                             ▼                             ▼
┌─────────────────┐           ┌─────────────────┐           ┌─────────────────┐
│ ingest.raw      │           │ alerts.evaluate │           │ reports.generate│
│ ingest.processed│           │ alerts.notify   │           │ reports.export  │
└─────────────────┘           └─────────────────┘           └─────────────────┘
```

### Queue Naming

- `smart-forest.<domain>.<action>` — e.g., `smart-forest.ingest.raw`, `smart-forest.reports.generate`
- Dead-letter: `smart-forest.dlx` → `smart-forest.<domain>.<action>.dlq`

### Job Types

| Job | Queue | Retries | Timeout | Idempotency |
|-----|-------|---------|---------|-------------|
| IoT ingest batch | `ingest.raw` | 3 | 60s | By `batch_id` |
| Alert evaluation | `alerts.evaluate` | 2 | 30s | By `alert_id + time_window` |
| Report generation | `reports.generate` | 1 | 600s | By `report_run_id` |
| Government sync | `integrations.gov.sync` | 5 | 120s | By `sync_id` |

### Idempotency Storage

| Job Type | Storage | Key | TTL |
|----------|---------|-----|-----|
| IoT batch | Redis DB 2 | `idempotency:ingest:{batch_id}` | 7 days |
| Report run | PostgreSQL | `report_runs.id` + status check | N/A |
| Government sync | Redis DB 2 | `idempotency:gov:{sync_id}` | 24h |

### Patterns

- **Fire-and-forget:** Report generation, bulk exports.
- **Request-reply:** Not recommended for primary flow; use REST + polling for status.
- **Saga:** Compensating messages for multi-step workflows.

---

## 6️⃣ Caching Strategy

### Redis Layout

```
┌─────────────────────────────────────────────────────────────────┐
│                         Redis                                    │
├─────────────────────────────────────────────────────────────────┤
│ DB 0: Application cache (TTL-based)                              │
│   - {domain}:{entity}:{id} — e.g., forest:parcel:uuid            │
│   - users:session:{id}                                           │
│   - reports:run:{id}:status                                      │
│                                                                  │
│ DB 1: Realtime / pub-sub                                         │
│   - sensor:live:{device_id} (streams)                            │
│   - alerts:active                                                │
│                                                                  │
│ DB 2: Rate limiting / locks                                      │
│   - ratelimit:{endpoint}:{ip}                                    │
│   - lock:{resource}:{id}                                         │
└─────────────────────────────────────────────────────────────────┘
```

### Cache Key Convention

- `{domain}:{entity}:{id}` — e.g., `forest:parcel:uuid`
- `{domain}:{entity}:{id}:{variant}` — e.g., `forest:parcel:uuid:geojson`

### Policies

| Data | TTL | Invalidation |
|------|-----|--------------|
| Session | 24h | On logout |
| Parcel geometry | 5–15 min | On update event |
| Report status | 1h | On completion |
| Reference data (species, etc.) | 1h | On admin update |
| Spatial query results | 1–5 min | Event-based or TTL |

### Do Not Cache

- Raw sensor readings (use TimescaleDB).
- Large geometry sets (prefer DB + spatial index).
- Personally identifiable data without encryption at rest.

---

## 7️⃣ File Storage Approach

### Layout

```
Storage root (S3/MinIO/NFS)
├── forest/
│   ├── boundaries/           # Import/export files
│   ├── imagery/              # Orthophotos, basemaps
│   └── attachments/
├── reports/
│   ├── exports/              # PDF, Excel
│   └── templates/
├── integrations/
│   └── government/           # Incoming dumps
└── temp/                     # Short-lived uploads
```

### Naming

- `{domain}/{type}/{uuid}.{ext}` — e.g., `forest/boundaries/a1b2c3d4.zip`
- Versioned: `{domain}/{type}/{uuid}_v{version}.{ext}`

### Access

- Pre-signed URLs for downloads (short expiry).
- Internal paths for processing; never expose raw storage paths in API.
- Metadata in PostgreSQL: `shared.file_registry` (id, path, size, checksum, domain_ref, created_at).

---

## 8️⃣ API Structure

### Base URL

```
/api/v1/{domain}/{resource}
```

### Examples

```
GET    /api/v1/forest/parcels?bbox=...
GET    /api/v1/forest/parcels/{id}
POST   /api/v1/forest/parcels
PATCH  /api/v1/forest/parcels/{id}
DELETE /api/v1/forest/parcels/{id}

GET    /api/v1/inventory/trees?parcel_id=...
GET    /api/v1/monitoring/devices/{id}/readings?from=&to=
POST   /api/v1/alerts/definitions
GET    /api/v1/reports/runs/{id}/status
POST   /api/v1/reports/runs
```

### Versioning

- URL path: `/api/v1/`, `/api/v2/`
- Header: `Accept: application/vnd.smartforest.v1+json` (optional)

### Common Query Params

| Param | Use |
|-------|-----|
| `bbox` | Bounding box `minLon,minLat,maxLon,maxLat` (WGS84). Validate bounds. |
| `page`, `limit` | Offset pagination — **max limit 100**. For exports/large lists use `cursor` instead. |
| `cursor` | Opaque cursor for cursor-based pagination — required for list/export >1000 rows |
| `sort` | `-created_at`, `name` |
| `fields` | Sparse fieldsets |
| `filter[status]` | JSON:API-style filters |

### Response Format

- JSON:API or consistent custom envelope.
- GeoJSON for geometry-heavy responses.
- `X-Request-Id` for tracing.

---

## 9️⃣ Naming Conventions

### Code

| Element | Convention | Example |
|---------|------------|---------|
| Modules | kebab-case | `forest.module.ts` |
| Classes | PascalCase | `ParcelService` |
| Files | kebab-case | `parcel-repository.ts` |
| Interfaces | PascalCase, no `I` prefix | `ParcelRepository` |
| Enums | PascalCase | `AlertSeverity` |
| Constants | SCREAMING_SNAKE | `MAX_PAGE_SIZE` |

### Database

| Element | Convention | Example |
|---------|------------|---------|
| Tables | snake_case, plural | `forest_parcels` |
| Columns | snake_case | `created_at` |
| Indexes | `idx_{table}_{columns}` | `idx_parcels_geometry` |
| FKs | `fk_{table}_{ref_table}` | `fk_trees_parcels` |

### API

| Element | Convention | Example |
|---------|------------|---------|
| Paths | `/{domain}/{resource}` kebab-case | `/forest/parcels` |
| Query params | snake_case | `bbox`, `page` |
| Headers | kebab-case | `X-Request-Id` |

---

## 🔟 Best Practices for Large Data + GIS

### GIS-Specific

1. **Core GIS scope:** Core = primitives only (transform, simplify, bbox, spatial predicates). Domain-specific logic (fire propagation, species suitability, routing) stays in domains.
2. **Simplify for display:** Use `ST_Simplify()` or `ST_SimplifyPreserveTopology()` for map tiles.
3. **Index strategy:** GIST on geometry; B-tree on `(time, device_id)` for TimescaleDB.
4. **Bbox queries first:** Always filter by bounding box before complex predicates.
5. **Avoid N+1:** Batch spatial queries; use `ST_Collect` where appropriate.

### Data Volume

1. **Stream exports:** Use cursor-based pagination; never load full result set.
2. **Chunked imports:** Process in batches (e.g., 1000 rows); commit per batch.
3. **Async for heavy work:** Report generation, bulk updates → queue.
4. **Read replicas:** For read-heavy analytics; same schema, read-only.

### Evolution

1. **Schema migrations:** Forward-compatible; avoid destructive changes without deprecation period.
2. **API deprecation:** Minimum 6 months; `X-Deprecated` header.
3. **Feature flags:** For gradual rollout of GIS or integration changes.

---

## 1️⃣1️⃣ Observability

### Logging

- **Structured JSON logs** (Pino or NestJS Logger). Fields: `timestamp`, `level`, `requestId`, `domain`, `message`, `duration`, `userId` (if auth).
- **Correlation:** Propagate `X-Request-Id` through HTTP → queue job metadata → child spans.
- **Never log:** PII, credentials, full request bodies. Log entity IDs, not names where PII.

### Metrics (Prometheus)

| Metric | Type | Labels | Use |
|--------|------|--------|-----|
| `http_requests_total` | Counter | method, path, status | Traffic |
| `http_request_duration_seconds` | Histogram | method, path | Latency |
| `queue_jobs_total` | Counter | queue, status | Job success/failure |
| `db_query_duration_seconds` | Histogram | schema, operation | Slow query detection |
| `gis_query_duration_seconds` | Histogram | operation | Spatial query perf |

### Tracing (OpenTelemetry)

- Trace: HTTP request → application service → DB/queue. Export to Jaeger or OTEL collector.
- Spans for: HTTP handlers, queue consumers, external API calls.

### Health Endpoints

- `GET /health/live` — Process alive. No deps.
- `GET /health/ready` — Postgres, Redis, RabbitMQ reachable. Used by load balancer.

---

## 1️⃣2️⃣ Security

### Secrets

- Env vars or secret manager (Vault, AWS Secrets). Never commit. Validate on startup.
- DB credentials, API keys, JWT secret in config module.

### Auth

- **JWT** for users (access + refresh). Short-lived access (15min); refresh rotation.
- **API keys** for M2M (IoT ingestion, government sync). Scoped to integration. Store hashed.

### Authorization

- RBAC: roles in `users` schema. Permissions checked via Core `IPermissionChecker`.
- Resource-level: parcel/forest ownership or org-based. Implement in domain application layer.

### Audit

- Append-only `audit_log` (shared schema): `user_id`, `action`, `resource`, `old/new` (JSON diff for sensitive), `ip`, `timestamp`.
- Audit: parcel create/update/delete, user role change, report export, government sync.

### PII & Data

- Encrypt PII at rest if required by regulation. Prefer DB-level encryption for sensitive columns.
- Retention: define per entity. Sensor raw data: configurable (e.g., 2 years). User data: per policy.

---

## 1️⃣3️⃣ NestJS Alignment

| Concern | NestJS Approach |
|---------|-----------------|
| CQRS | Use `@nestjs/cqrs` for commands/queries. Fits application layer structure. |
| Events | `EventEmitter2` for in-process; wire to DomainEventBus abstraction. |
| Validation | `class-validator` + `ValidationPipe`. DTOs per endpoint. |
| Config | `@nestjs/config` + `ConfigModule`. Validate schema (e.g., Zod) on load. |
| Guards | `AuthGuard`, `PermissionGuard` in Core. Use `@UseGuards()`. |
| Module boundaries | Custom ESLint rule: `no-restricted-imports` for cross-domain. |

---

## 1️⃣4️⃣ Event Schema & Versioning

- Events: `{ type: string, version: number, payload: object }`. E.g. `Forest.ParcelCreated.v1`.
- **Version:** Increment when payload changes. Handlers support N and N-1 for one release.
- **No breaking changes** without new version. Deprecate old after 2 releases.

---

## 1️⃣5️⃣ Plugin System (Defer)

- **Do not implement** until concrete use case (e.g., third-party algorithm, regional extension).
- When needed: Core exposes `PluginRegistry`; plugins register handlers. Interface in `core/plugins/plugin.contract.ts`.
- Avoid generic plugin framework; prefer explicit extension points.

---

## ⚠️ What NOT to Do

| Don't | Reason |
|-------|--------|
| Create separate GIS microservice | GIS stays in core; extraction later only if proven bottleneck |
| Put domain logic in Core GIS | Core = primitives (transform, simplify). Fire models, suitability → domains |
| Let domains import each other | Breaks modularity; use events |
| Put business logic in controllers | Controllers delegate to application services |
| Share entities across domains | Use events + DTOs or read models |
| Use MongoDB for geospatial | PostgreSQL + PostGIS is required |
| Deploy with Kubernetes | Overkill for modular monolith; Docker Compose / VMs suffice |
| Cache everything | Invalidate properly; avoid stale geometry |
| Store large geometries in Redis | Use PostgreSQL; cache small, simplified views only |
| Run long HTTP requests for reports | Queue job; poll status |
| Hardcode integration URLs/credentials | Config + env vars only |

---

## ⚠️ Scaling Mistakes to Avoid

1. **Connection pool exhaustion** — Start with shared pool; monitor. Split by schema only if connections spike. Default pool size: `(CPU * 2) + disk`.
2. **No partitioning on TimescaleDB** — Hypertables must be partitioned by time; add `device_id` if needed.
3. **Synchronous government API calls** — Use queue + retries; never block request thread.
4. **No rate limiting on public endpoints** — Redis-based rate limiter per IP/user.
5. **Geometry without simplification for tiles** — Full-resolution polygons will kill map performance.
6. **Shared database without schema isolation** — One schema per domain; avoid cross-schema FKs where possible.
7. **No idempotency for ingest** — Duplicate IoT batches can corrupt data; use `batch_id` dedup.
8. **Ignoring slow query log** — Monitor and index; spatial queries are easy to get wrong.

---

## Long-Term Evolution

- **Extraction path:** Each domain is already a boundary; can become a service later with:
  - Own DB (schema split)
  - Event bus (RabbitMQ) instead of in-process events
  - API gateway in front
- **Plugin system:** Core exposes `PluginRegistry`; domains can register extensions without core changes.
- **Multi-tenancy:** Add `tenant_id` to key tables; row-level security; schema-per-tenant only if regulatory need.
- **Audit:** Append-only audit log table or event-sourced critical aggregates.

---

## 1️⃣6️⃣ Testing Strategy

| Level | Scope | Tools | Notes |
|-------|-------|-------|-------|
| Unit | Domain entities, value objects, pure logic | Jest | No DB, no DI. Mock interfaces. |
| Integration | Application handlers + in-memory/Testcontainers DB | Jest, pg-mem or Testcontainers | One domain per test file. PostGIS via Testcontainers. |
| E2E | API → DB → queue | Supertest, Testcontainers | Full stack. Seed minimal data. |
| Spatial | GIS queries | Jest + real PostGIS | Testcontainers with PostGIS image. Validate bbox, simplify, transforms. |

- **Cross-domain events:** Integration tests mock event bus; assert correct events published.
- **Queue jobs:** Test handler in isolation with mock payload; E2E with real RabbitMQ in Testcontainers.

---

## Summary

| Aspect | Choice |
|--------|--------|
| Style | Modular Monolith |
| Backend | NestJS + TypeScript |
| Primary DB | PostgreSQL + PostGIS |
| Time-series | TimescaleDB |
| Cache | Redis |
| Queue | RabbitMQ |
| Storage | S3/MinIO-compatible |
| GIS | In core |
| Domains | Isolated, event-driven |
| Integrations | Adapter pattern |

This architecture is designed for a 7–12 person team, government-scale requirements, and future extraction without redesign.
