# Architecture Review — Risks & Simplifications

**Review date:** Based on full doc set  
**Principle:** Simplify for MVP; add complexity when justified

---

## 1. Identified Risks

### High

| # | Risk | Location | Impact |
|---|------|----------|--------|
| 1 | **Scope mismatch** | ARCHITECTURE vs PROJECT_STRUCTURE | ARCHITECTURE defines 6 domains (forest, inventory, monitoring, alerts, reports, users); PROJECT_STRUCTURE defines 2 (events, forest-management). Unclear what to build first. |
| 2 | **Too many event mechanisms** | ARCHITECTURE §3 | In-process DomainEventBus + RabbitMQ + event handlers. Three ways to do "events." Team will misuse or overthink. |
| 3 | **CQRS recommendation vs practice** | ARCHITECTURE §13 vs EVENTS | ARCHITECTURE recommends `@nestjs/cqrs`. Events design explicitly avoids CQRS. Conflicting guidance. |
| 4 | **Schema strategy inconsistency** | ARCHITECTURE §4 vs DATABASE_DESIGN | ARCHITECTURE: schema per domain (forest, inventory, monitoring…). DATABASE_DESIGN: flat tables, no schema split. Which to follow? |
| 5 | **Geometry type mismatch** | DATABASE_DESIGN vs GIS_DATA_ARCHITECTURE | DATABASE_DESIGN: `GEOMETRY(Polygon)`. GIS doc: use MultiPolygon. Parcels with holes or disjoint parts will fail. |
| 6 | **Queue choice mismatch** | ARCHITECTURE vs PROJECT_STRUCTURE | ARCHITECTURE: RabbitMQ. PROJECT_STRUCTURE: Bull/BullMQ. Different infra, different ops. |

### Medium

| # | Risk | Location | Impact |
|---|------|----------|--------|
| 7 | **Integrations before need** | ARCHITECTURE | government, iot, weather, maps — four integration adapters with no contracts. Empty shells add noise. |
| 8 | **TimescaleDB upfront** | ARCHITECTURE §4 | Sensor data in TimescaleDB. IoT ingestion may not be MVP. Extra DB tech before proven need. |
| 9 | **Full DDD layering** | ARCHITECTURE, PROJECT_STRUCTURE | application/domain/infrastructure/presentation per domain. Heavy for MVP with 2 domains. |
| 10 | **Redis split** | ARCHITECTURE §6 | Three Redis DBs (cache, realtime, rate-limit). One Redis suffices for MVP. |
| 11 | **File metadata duplication** | ARCHITECTURE vs EVENTS | shared.file_registry + event_attachments (file_path). Two places for file metadata; sync risk. |
| 12 | **Event schema versioning** | ARCHITECTURE §14 | Versioned domain events (v1, v2) before we have multiple consumers. Premature. |

### Low

| # | Risk | Location | Impact |
|---|------|----------|--------|
| 13 | **IAuthContext abstraction** | ARCHITECTURE §2 | Core defines IAuthContext, Users implements. For MVP, JWT guard + decorator is enough. |
| 14 | **Observability scope** | ARCHITECTURE §11 | Prometheus + OpenTelemetry + structured logs. Full stack before first deploy. |
| 15 | **events.location nullable** | DATABASE_DESIGN | events.location has no NOT NULL; Events design requires it. Minor schema fix. |

---

## 2. Suggested Simplifications

### MVP scope

| Simplify | From | To |
|----------|------|-----|
| **Domains** | 6 (forest, inventory, monitoring, alerts, reports, users) | 3: **forest-management**, **events**, **identity** (auth+users+rbac in one) |
| **Integrations** | 4 adapters (gov, iot, weather, maps) | **None** until first contract. Add one at a time. |
| **Event bus** | In-process + RabbitMQ | **Queue only** (for async). Direct service calls for sync. Drop DomainEventBus until 3+ cross-domain async flows. |
| **CQRS** | Recommended | **Skip.** Service + controller. Add if read/write scaling diverges. |
| **Domain layers** | application/domain/infrastructure/presentation | **Flat:** controller, service, repository. Add layers when logic justifies. |

### Infrastructure

| Simplify | From | To |
|----------|------|-----|
| **Queue** | RabbitMQ | **Bull** (Redis-backed). One less service. Switch to RabbitMQ if we need complex routing or ordering. |
| **Redis** | 3 logical DBs | **1 Redis**, single DB. Split when cache vs session eviction conflicts. |
| **TimescaleDB** | Planned for sensor data | **Defer.** Use PostgreSQL + indexed `time` column. Add TimescaleDB when ingestion >1M rows/day. |
| **DB schemas** | Per-domain schemas | **Single schema** (e.g. `public` or `smart_forest`). Add schema split when extracting services. |

### Data

| Simplify | From | To |
|----------|------|-----|
| **Parcel geometry** | Polygon | **MultiPolygon** (align with GIS doc). Handles holes, disjoint. |
| **events.location** | Nullable | **NOT NULL** (required for map display). |
| **File metadata** | file_registry + event_attachments | **One place per use case.** event_attachments for event files; add file_registry only if multiple domains share generic file storage. |

### Observability

| Simplify | From | To |
|----------|------|-----|
| **MVP** | Prometheus + OTEL + structured logs | **Structured logs + /health/live, /health/ready.** |
| **Scale** | Add Prometheus when 2+ instances or perf issues. Add OTEL when debugging cross-service flows. |

### Auth

| Simplify | From | To |
|----------|------|-----|
| **Abstraction** | IAuthContext, IPermissionChecker | **JWT guard + @CurrentUser() + @RequirePermissions().** No interfaces until we have multiple implementations (e.g. SSO). |
| **Identity module** | auth, users, rbac separate | **Single identity module** for MVP. Split when teams or reuse demand it. |

---

## 3. Alignments Required

1. **Geometry type** — Use `GEOMETRY(MultiPolygon, 4326)` for parcels and stands in DATABASE_DESIGN.
2. **events.location** — Add `NOT NULL` in DATABASE_DESIGN.
3. **Queue** — Pick one: Bull (simpler) or RabbitMQ (more features). Update both ARCHITECTURE and PROJECT_STRUCTURE.
4. **Domain list** — Define MVP domains explicitly. Update ARCHITECTURE to match PROJECT_STRUCTURE, or vice versa.
5. **Remove CQRS recommendation** — Unless committing to it. Events design (no CQRS) is the simpler path.
6. **Schema strategy** — Decide: single schema for MVP or schema-per-domain from day one. Document in one place.

---

## 4. Summary

| Category | Action |
|----------|--------|
| **Scope** | 3 domains for MVP; defer inventory, monitoring, alerts, reports, integrations |
| **Structure** | Flat domain layout; no CQRS; no in-process event bus |
| **Infra** | Bull over RabbitMQ; single Redis; defer TimescaleDB |
| **Data** | MultiPolygon; single schema; fix events.location |
| **Auth** | Single identity module; no auth abstractions for MVP |
| **Observability** | Logs + health only; add metrics/tracing when needed |
| **Docs** | Resolve ARCHITECTURE vs PROJECT_STRUCTURE vs DATABASE_DESIGN mismatches |

---

## 5. What to Keep

- Modular monolith, no microservices
- PostgreSQL + PostGIS as primary DB
- JWT + refresh tokens + RBAC (AUTH_DESIGN)
- GIST indexes, bbox-first queries (GIS_DATA_ARCHITECTURE)
- Events module design (simple service, no CQRS)
- Soft refs for cross-domain (parcel_id in events)
- Audit log pattern
- Strict module boundaries (domains don't import each other)
