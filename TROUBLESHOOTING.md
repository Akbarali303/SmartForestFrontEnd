# Troubleshooting

## "password authentication failed for user 'postgres'"

PostgreSQL is running but rejecting the connection. Fix:

### 1. Create `.env` file
```bash
cp .env.example .env
```

### 2. Update DATABASE_URL with your PostgreSQL credentials
```
DATABASE_URL=postgresql://USERNAME:PASSWORD@localhost:5432/smart_forest
```

| Part | Common values |
|------|---------------|
| USERNAME | `postgres` (default) |
| PASSWORD | What you set during PostgreSQL install. If forgotten, reset it. |
| localhost | Or `127.0.0.1` |
| 5432 | Default port |
| smart_forest | Database name — create with `createdb smart_forest` |

### 3. Create the database
```bash
createdb smart_forest
```

### 4. Enable PostGIS
```bash
psql smart_forest -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

### 5. Run migration
```bash
npm run migration:run
```

---

## PostgreSQL not running

**Windows:** Services → find "postgresql" → Start

**Check if running:**
```bash
psql -U postgres -c "SELECT 1"
```

---

## Reset and retry

```bash
# Drop and recreate database
psql -U postgres -c "DROP DATABASE IF EXISTS smart_forest;"
psql -U postgres -c "CREATE DATABASE smart_forest;"
psql smart_forest -c "CREATE EXTENSION IF NOT EXISTS postgis;"
npm run migration:run
```
