# Authentication Design — Government Platform

**Scope:** JWT access tokens, refresh tokens, RBAC  
**Principle:** Simple, secure, maintainable. No overengineering.

---

## 1. Overview

| Component | Choice |
|-----------|--------|
| Access token | JWT, short-lived (15 min) |
| Refresh token | Opaque, stored in DB, rotated on use |
| Auth method | Username + password (or gov SSO later) |
| RBAC | Roles → permissions, checked per request |

---

## 2. Token Flow

```
┌──────────┐     POST /auth/login      ┌──────────┐
│  Client  │ ───────────────────────► │   API    │
│          │  { username, password }   │          │
│          │ ◄─────────────────────── │          │
│          │  { accessToken, refreshToken, expiresIn }   │
└──────────┘                          └──────────┘
       │                                     │
       │  API requests with Bearer token     │
       │ ─────────────────────────────────► │
       │                                     │
       │  401 → POST /auth/refresh           │
       │  { refreshToken }                   │
       │ ◄───────────────────────────────── │
       │  { accessToken, refreshToken }      │  (rotate refresh)
```

- **Login:** Validate credentials → issue access + refresh.
- **API calls:** Send `Authorization: Bearer <accessToken>`.
- **Expired access:** Client calls `/auth/refresh` with refresh token → new pair; old refresh invalidated.
- **Logout:** Client discards tokens; optionally call `/auth/logout` to revoke refresh.

---

## 3. Database Schema

### users

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username        VARCHAR(100) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,         -- bcrypt
    email           VARCHAR(255),
    status          VARCHAR(20) DEFAULT 'active',  -- active, locked, disabled
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### refresh_tokens

```sql
CREATE TABLE refresh_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255) NOT NULL UNIQUE,   -- SHA-256 of token
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,
    user_agent      VARCHAR(500),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at) WHERE revoked_at IS NULL;
```

**Note:** Store `hash(refresh_token)`, not the token. On refresh, hash incoming token, lookup, verify, delete old row, create new.

### roles

```sql
CREATE TABLE roles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(50) UNIQUE NOT NULL,   -- admin, forester, viewer
    description     VARCHAR(255)
);
```

### permissions

```sql
CREATE TABLE permissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) UNIQUE NOT NULL,  -- parcel:read, event:write
    description     VARCHAR(255)
);
```

### role_permissions

```sql
CREATE TABLE role_permissions (
    role_id         UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id   UUID REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);
```

### user_roles

```sql
CREATE TABLE user_roles (
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id         UUID REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);
```

---

## 4. JWT Access Token

### Payload

```json
{
  "sub": "user-uuid",
  "username": "jane",
  "roles": ["forester", "viewer"],
  "permissions": ["parcel:read", "parcel:write", "event:read"],
  "iat": 1234567890,
  "exp": 1234568790
}
```

- **sub:** User ID.
- **roles, permissions:** Cached for the token lifetime. Load on login from DB.
- **exp:** 15 minutes from issue.

### Why permissions in token

- Avoid DB hit on every request.
- 15-min TTL limits blast radius if token is stolen.
- Role/permission changes apply after token expiry, or use short TTL (5 min) for sensitive apps.

---

## 5. Refresh Token

- Opaque random string (e.g. 64 bytes, hex or base64).
- Stored as SHA-256 hash in `refresh_tokens`.
- TTL: 7 days (configurable). Government: 1–2 days possible.
- One-time use: on refresh, delete old, issue new.
- Revocable: set `revoked_at` or delete row.

---

## 6. RBAC Model

### Permission naming

```
resource:action
```

Examples: `parcel:read`, `parcel:write`, `event:delete`, `user:manage`, `audit:read`.

### Check flow

1. JWT guard validates token.
2. Permission guard checks `permissions` array for required permission.
3. Optional: resource-level check (e.g. parcel belongs to user's org).

### Decorator

```typescript
@RequirePermissions('parcel:write')
@Post()
createParcel() { ... }
```

---

## 7. API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/login` | None | Credentials → access + refresh |
| POST | `/auth/refresh` | None | Refresh token → new pair |
| POST | `/auth/logout` | Bearer | Revoke current refresh token |
| POST | `/auth/logout-all` | Bearer | Revoke all refresh tokens for user |
| GET | `/auth/me` | Bearer | Current user + roles + permissions |

---

## 8. Security Practices

| Practice | Implementation |
|----------|----------------|
| Password hashing | bcrypt, cost 12 |
| Refresh token storage | Hash only; never return in response after creation |
| Token transport | Access: header. Refresh: body (not URL). Prefer httpOnly cookie for refresh in browsers |
| HTTPS | Required in production |
| Rate limiting | Login: 5/min per IP. Refresh: 10/min per user |
| Account lockout | 5 failed attempts → lock 15 min (optional) |
| CORS | Restrict origins; no wildcard in prod |
| Token revocation | Logout invalidates refresh; optionally blacklist access until expiry (usually skip for 15-min TTL) |

### Refresh in browser

For SPAs, store refresh in httpOnly cookie (`refreshToken`). Cookie: `SameSite=Strict`, `Secure`, `HttpOnly`, `Path=/auth`. Access token in memory (or short-lived cookie). Reduces XSS exposure.

---

## 9. Module Structure

```
core/auth/
├── auth.module.ts
├── auth.controller.ts
├── auth.service.ts
├── strategies/
│   └── jwt.strategy.ts           # Validates access token, attaches user
├── guards/
│   ├── jwt-auth.guard.ts
│   └── permissions.guard.ts
├── decorators/
│   ├── current-user.decorator.ts
│   └── require-permissions.decorator.ts
└── dto/
    ├── login.dto.ts
    └── refresh.dto.ts

core/users/
├── users.service.ts              # User CRUD, password verify
└── ...

core/rbac/
├── rbac.service.ts               # getRolesForUser, getPermissionsForUser
└── ...
```

---

## 10. Login Flow (Service)

```typescript
async login(dto: LoginDto): Promise<AuthResponse> {
  const user = await this.usersService.findByUsername(dto.username);
  if (!user || !(await this.usersService.verifyPassword(user.id, dto.password)))
    throw new UnauthorizedException('Invalid credentials');

  if (user.status !== 'active')
    throw new UnauthorizedException('Account disabled');

  const [accessToken, refreshToken] = await Promise.all([
    this.issueAccessToken(user),
    this.issueRefreshToken(user.id),
  ]);

  await this.usersService.updateLastLogin(user.id);
  return { accessToken, refreshToken, expiresIn: 900 };  // 15 min
}
```

---

## 11. Refresh Flow

```typescript
async refresh(dto: RefreshDto): Promise<AuthResponse> {
  const tokenHash = this.hashToken(dto.refreshToken);
  const row = await this.refreshTokensRepo.findOne({
    where: { tokenHash, revokedAt: IsNull() },
    relations: ['user'],
  });

  if (!row || row.expiresAt < new Date())
    throw new UnauthorizedException('Invalid or expired refresh token');

  await this.refreshTokensRepo.delete(row.id);  // One-time use
  const [accessToken, refreshToken] = await Promise.all([
    this.issueAccessToken(row.user),
    this.issueRefreshToken(row.user.id),
  ]);

  return { accessToken, refreshToken, expiresIn: 900 };
}
```

---

## 12. What to Avoid

| Avoid | Why |
|-------|-----|
| Long-lived access tokens | Hard to revoke; use refresh rotation |
| Storing raw refresh tokens | Breach exposes all; hash only |
| Skipping refresh rotation | Stolen refresh valid until expiry |
| Permission check in DB per request | Use cached permissions in JWT for speed |
| Custom crypto | Use bcrypt, SHA-256, standard JWT libs |
| OAuth2/OIDC for internal app | Adds complexity; add only if integrating gov SSO |
| Token blacklist for access | Usually unnecessary with 15-min TTL; add only if needed |

---

## 13. Government-Specific Notes

- **Audit:** Log all login, logout, refresh, and failed attempts (user, IP, timestamp).
- **Session limits:** Max N active refresh tokens per user; revoke oldest on overflow.
- **Compliance:** Align password policy and session length with local requirements.
- **Future SSO:** Keep login/refresh logic separate so gov IdP can be plugged in later.
