# NestJS Modular Monolith — Project Structure

**Style:** Domain-driven, Clean Architecture, API-first  
**Constraint:** Strict module boundaries, no microservices

---

## Folder Tree

```
src/
├── app/
│   ├── app.module.ts
│   ├── app.controller.ts          # Health, version
│   └── main.ts
│
├── core/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── guards/
│   │   │   └── jwt-auth.guard.ts
│   │   ├── decorators/
│   │   │   └── current-user.decorator.ts
│   │   └── auth.service.ts        # Token validation, session
│   │
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── entities/
│   │   └── dto/
│   │
│   ├── rbac/
│   │   ├── rbac.module.ts
│   │   ├── guards/
│   │   │   └── permissions.guard.ts
│   │   ├── rbac.service.ts        # Role/permission checks
│   │   └── decorators/
│   │       └── require-permissions.decorator.ts
│   │
│   ├── gis-engine/
│   │   ├── gis-engine.module.ts
│   │   ├── geometry.service.ts    # Transform, simplify, bbox
│   │   └── interfaces/
│   │
│   ├── audit/
│   │   ├── audit.module.ts
│   │   ├── audit.service.ts       # Append-only log
│   │   ├── decorators/
│   │   │   └── audited.decorator.ts
│   │   └── interceptors/
│   │       └── audit.interceptor.ts
│   │
│   └── file-storage/
│       ├── file-storage.module.ts
│       ├── file-storage.service.ts
│       └── dto/
│
├── domains/
│   ├── events/
│   │   ├── events.module.ts
│   │   ├── events.controller.ts
│   │   ├── application/
│   │   │   ├── events.service.ts
│   │   │   └── handlers/
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   └── repositories/
│   │   └── infrastructure/
│   │       └── persistence/
│   │
│   └── forest-management/
│       ├── forest-management.module.ts
│       ├── forest.controller.ts
│       ├── application/
│       │   ├── forest.service.ts
│       │   └── handlers/
│       ├── domain/
│       │   ├── entities/
│       │   └── repositories/
│       └── infrastructure/
│           └── persistence/
│
├── infrastructure/
│   ├── database/
│   │   ├── database.module.ts
│   │   ├── config/
│   │   └── migrations/
│   │
│   ├── cache/
│   │   ├── cache.module.ts
│   │   └── redis.service.ts
│   │
│   └── queue/
│       ├── queue.module.ts
│       └── bull.service.ts
│
└── common/                        # Shared utilities only
    ├── filters/
    ├── interceptors/
    └── pipes/
```

---

## Module Responsibilities

### CORE

| Module | Responsibility | Exposes | Depends On |
|--------|----------------|---------|------------|
| **auth** | JWT validation, session, current user context | Guards, decorators, AuthService | users (for user lookup) |
| **users** | User CRUD, profile | UsersService, UsersController | database |
| **rbac** | Roles, permissions, enforcement | PermissionsGuard, RequirePermissions decorator | users |
| **gis-engine** | Geometry ops (transform, simplify, bbox), spatial predicates | GeometryService | Nothing |
| **audit** | Append-only audit log for sensitive actions | AuditService, @Audited() | database |
| **file-storage** | Upload, download, pre-signed URLs | FileStorageService | database, S3/MinIO |

**Core rule:** Core modules may depend on each other (auth → users). Core never imports from domains.

---

### DOMAINS

| Module | Responsibility | Exposes | Depends On |
|--------|----------------|---------|------------|
| **events** | Event management (inspections, incidents, scheduled events) | EventsController, EventsService | core (auth, rbac, audit, gis if spatial) |
| **forest-management** | Parcels, stands, boundaries, forest inventory | ForestController, ForestService | core (auth, rbac, audit, gis-engine, file-storage) |

**Domain rule:** Domains never import from each other. Cross-domain flows → events or queue.

---

### INFRASTRUCTURE

| Module | Responsibility | Exposes | Depends On |
|--------|----------------|---------|------------|
| **database** | PostgreSQL + PostGIS connection, TypeORM/Prisma config | DataSource, repositories | Nothing |
| **cache** | Redis client, cache operations | RedisService (or CacheService) | Nothing |
| **queue** | Bull/BullMQ (or RabbitMQ) setup, job publishing | QueueService | Nothing |

**Infra rule:** Infrastructure provides technical capabilities. Injected into core and domains.

---

## Dependency Flow

```
domains ──► core ──► infrastructure
   │           │
   └───────────┴──► (domains do NOT depend on each other)
```

---

## Import Rules (Enforce via ESLint)

| From | May Import |
|------|------------|
| `core/*` | `core/*`, `infrastructure/*`, `common/*` |
| `domains/*` | `core/*`, `infrastructure/*`, `common/*` |
| `infrastructure/*` | `common/*` only |
| `common/*` | Nothing (pure utilities) |

**Forbidden:** `domains/events` → `domains/forest-management` (and vice versa).

---

## API Routes

```
/api/v1/health
/api/v1/users
/api/v1/auth/login
/api/v1/auth/refresh
/api/v1/events
/api/v1/forest/parcels
/api/v1/forest/stands
```

---

## App Module Wiring

```typescript
// app.module.ts
@Module({
  imports: [
    ConfigModule.forRoot(),
    // Infra first
    DatabaseModule,
    CacheModule,
    QueueModule,
    // Core
    AuthModule,
    UsersModule,
    RbacModule,
    GisEngineModule,
    AuditModule,
    FileStorageModule,
    // Domains
    EventsModule,
    ForestManagementModule,
  ],
})
export class AppModule {}
```
