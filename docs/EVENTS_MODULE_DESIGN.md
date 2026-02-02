# Events Module — GIS Monitoring System

**Scope:** Create events on map, coordinates, severity, status, attachments, audit  
**Principle:** Simple service + controller; no CQRS

---

## 1. Overview

Events represent incidents, inspections, or observations on the map. Created by clicking a location; support severity, status flow, file attachments, and audit.

---

## 2. Database Schema

### events

```sql
CREATE TABLE events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type            VARCHAR(50) NOT NULL,           -- fire, pest, inspection, maintenance, observation
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    location        GEOMETRY(Point, 4326) NOT NULL,
    parcel_id       UUID,                           -- Soft ref to forest_parcels
    stand_id        UUID,                           -- Soft ref to forest_stands
    severity        VARCHAR(20) NOT NULL DEFAULT 'medium',  -- low, medium, high, critical
    status          VARCHAR(20) NOT NULL DEFAULT 'open',    -- open, in_progress, resolved, closed
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID NOT NULL,
    updated_by      UUID
);

CREATE INDEX idx_events_location ON events USING GIST (location);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_created_at ON events(created_at);
CREATE INDEX idx_events_parcel ON events(parcel_id) WHERE parcel_id IS NOT NULL;
```

### event_attachments

```sql
CREATE TABLE event_attachments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    file_name       VARCHAR(255) NOT NULL,
    file_path       VARCHAR(512) NOT NULL,          -- Storage path (S3/minio key)
    file_size       INTEGER,
    mime_type       VARCHAR(100),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID
);

CREATE INDEX idx_attachments_event ON event_attachments(event_id);
```

### Status lifecycle

```
open ──► in_progress ──► resolved ──► closed
  │           │              │
  └───────────┴──────────────┴──► (closed is terminal)
```

| Status       | Meaning                        |
|--------------|--------------------------------|
| `open`       | New, not yet addressed         |
| `in_progress`| Work in progress               |
| `resolved`   | Addressed, pending confirmation|
| `closed`     | Final, no further changes      |

Allowed transitions: `open→in_progress`, `in_progress→resolved`, `resolved→closed`. Reopening: `resolved→in_progress`, `closed→in_progress` (optional).

---

## 3. Severity Levels

| Level     | Use                          |
|-----------|------------------------------|
| `low`     | Minor observation            |
| `medium`  | Default, needs attention     |
| `high`    | Urgent                       |
| `critical`| Immediate response required  |

Stored as string; validated in service. No extra table.

---

## 4. Module Structure

```
domains/events/
├── events.module.ts
├── events.controller.ts
├── events.service.ts
├── dto/
│   ├── create-event.dto.ts
│   ├── update-event.dto.ts
│   └── event-query.dto.ts
├── entities/
│   ├── event.entity.ts
│   └── event-attachment.entity.ts
└── enums/
    ├── event-type.enum.ts
    ├── event-severity.enum.ts
    └── event-status.enum.ts
```

No commands/queries/handlers — single service, single controller.

---

## 5. API Design

### Create event (from map click)

```
POST /api/v1/events
{
  "type": "inspection",
  "title": "Tree health check",
  "description": "Optional notes",
  "location": { "type": "Point", "coordinates": [lon, lat] },
  "parcelId": "uuid",        // optional
  "standId": "uuid",         // optional
  "severity": "medium"
}
```

### Update event (status, details)

```
PATCH /api/v1/events/:id
{
  "title": "...",
  "description": "...",
  "status": "in_progress",
  "severity": "high"
}
```

### List events (with spatial filter)

```
GET /api/v1/events?bbox=minLon,minLat,maxLon,maxLat
GET /api/v1/events?status=open&severity=critical
GET /api/v1/events?parcelId=uuid
```

### Get single event

```
GET /api/v1/events/:id
```

### Attachments

```
POST   /api/v1/events/:id/attachments   (multipart/form-data)
GET    /api/v1/events/:id/attachments
DELETE /api/v1/events/:id/attachments/:attachmentId
```

---

## 6. DTOs

### CreateEventDto

```typescript
// create-event.dto.ts
export class CreateEventDto {
  @IsEnum(EventType)
  type: EventType;

  @IsString()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @ValidateNested()
  @Type(() => GeoJsonPointDto)
  location: { type: 'Point'; coordinates: [number, number] };

  @IsOptional()
  @IsUUID()
  parcelId?: string;

  @IsOptional()
  @IsUUID()
  standId?: string;

  @IsEnum(EventSeverity)
  @IsOptional()
  severity?: EventSeverity;  // default: medium
}
```

### GeoJsonPointDto

```typescript
export class GeoJsonPointDto {
  @Equals('Point')
  type: 'Point';

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsNumber({}, { each: true })
  coordinates: [number, number];  // [lon, lat]
}
```

### UpdateEventDto (partial)

```typescript
export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @IsOptional()
  @IsEnum(EventSeverity)
  severity?: EventSeverity;
}
```

### Status validation

```typescript
const ALLOWED_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  open: ['in_progress'],
  in_progress: ['resolved'],
  resolved: ['closed', 'in_progress'],
  closed: ['in_progress'],  // reopen
};
```

---

## 7. File Attachments

### Flow

1. Client uploads via `multipart/form-data` to `POST /events/:id/attachments`.
2. Controller validates event exists and user has access.
3. Service stores file via `FileStorageService` (core), saves metadata to `event_attachments`.
4. Download: `GET /events/:id/attachments/:attachmentId` → pre-signed URL or stream.

### Constraints

| Rule        | Value            |
|-------------|------------------|
| Max file size | 10 MB         |
| Allowed types | image/*, application/pdf |
| Max per event | 20 attachments |

### Storage path

```
events/{eventId}/{attachmentId}.{ext}
```

---

## 8. Audit Trail

Use existing core Audit module. No custom audit tables.

### When to log

| Action     | Audit entry                          |
|------------|--------------------------------------|
| Create     | `events.insert`, record_id, new_values |
| Update     | `events.update`, record_id, old_values, new_values |
| Status change | Include in update audit            |
| Delete     | `events.delete`, record_id, old_values |
| Add attachment | `event_attachments.insert`        |
| Remove attachment | `event_attachments.delete`    |

### Implementation

```typescript
// In events.service.ts
async create(dto: CreateEventDto, userId: string) {
  const event = await this.eventsRepo.insert(...);
  await this.auditService.log({
    tableName: 'events',
    recordId: event.id,
    action: 'INSERT',
    newValues: event,
    changedBy: userId,
  });
  return event;
}
```

Or use `@Audited()` decorator / interceptor if the core audit module supports it.

---

## 9. Service Logic (Simplified)

```typescript
// events.service.ts — high-level structure
@Injectable()
export class EventsService {
  async create(dto: CreateEventDto, userId: string): Promise<Event>
  async findAll(query: EventQueryDto): Promise<PaginatedResult<Event>>
  async findOne(id: string): Promise<Event>
  async update(id: string, dto: UpdateEventDto, userId: string): Promise<Event>
  async addAttachment(eventId: string, file: Express.Multer.File, userId: string): Promise<EventAttachment>
  async removeAttachment(eventId: string, attachmentId: string): Promise<void>
}
```

- `create`: map GeoJSON point → `ST_SetSRID(ST_MakePoint(lon, lat), 4326)`.
- `findAll`: apply bbox (`&&`), status, severity, parcelId filters.
- `update`: validate status transition; call audit.
- `addAttachment`: validate size/type/limit; store file; insert `event_attachments`; audit.

---

## 10. Response Shape (GeoJSON-compatible)

```json
{
  "id": "uuid",
  "type": "inspection",
  "title": "...",
  "description": "...",
  "location": {
    "type": "Point",
    "coordinates": [lon, lat]
  },
  "parcelId": "uuid",
  "standId": null,
  "severity": "medium",
  "status": "open",
  "attachments": [
    { "id": "uuid", "fileName": "photo.jpg", "mimeType": "image/jpeg" }
  ],
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601",
  "createdBy": "uuid"
}
```

---

## 11. Checklist

| Item                    | Done |
|-------------------------|------|
| Point geometry (WGS84)  | ✓    |
| Severity levels         | ✓    |
| Status lifecycle        | ✓    |
| File attachments        | ✓    |
| Audit trail             | ✓    |
| Bbox spatial filter     | ✓    |
| Simple service/controller | ✓  |
| No CQRS                 | ✓    |
