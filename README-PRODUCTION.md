# SmartForest Production Deployment

Deploy SmartForest on a Linux server. No localhost dependency.

## Prerequisites

- Node.js 18+
- PostgreSQL
- PM2 (optional, for process management): `npm install -g pm2`

## Architecture

- **Backend** (NestJS): port 9000, binds to 0.0.0.0
- **Frontend** (Next.js + custom server): port 9002, binds to 0.0.0.0
- **Streams**: FFmpeg outputs to `web/public/streams/`, served at `/streams/`

## Environment Variables

### Root `.env` (Backend)

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smart_forest
PORT=9000
HOST=0.0.0.0
PUBLIC_URL=http://YOUR_SERVER_IP:9000

# Optional: restrict CORS (comma-separated), e.g. http://YOUR_SERVER_IP:9002
# CORS_ORIGIN=http://YOUR_SERVER_IP:9002
```

### `web/.env` (Frontend)

```env
# Required in production — replace YOUR_SERVER_IP with your server IP or hostname
FRONTEND_API_URL=http://YOUR_SERVER_IP:9000
NEXT_PUBLIC_API_URL=http://YOUR_SERVER_IP:9000

PORT=9002
HOST=0.0.0.0
```

## Build and Start

### Option 1: PM2 (recommended)

1. Copy env files and set `FRONTEND_API_URL`, `NEXT_PUBLIC_API_URL`:

   ```bash
   cp .env.example .env
   cp web/.env.example web/.env
   # Edit both: replace 127.0.0.1 with your SERVER_IP in FRONTEND_API_URL and NEXT_PUBLIC_API_URL
   ```

2. Install dependencies and build:

   ```bash
   npm install
   npm run build
   cd web && npm install && npm run build && cd ..
   ```

3. Start with PM2:

   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup  # optional: enable on boot
   ```

### Option 2: Manual

**Backend:**

```bash
npm install
npm run build
npm run start:prod
```

**Frontend (separate terminal):**

```bash
cd web
npm install
npm run build
npm run start:prod
```

### Option 3: From root

```bash
# Backend
npm run start:prod:backend

# Frontend (separate terminal)
npm run start:prod:frontend
```

## Streams (HLS)

- FFmpeg writes to `web/public/streams/` (e.g. `cam1.m3u8`, `cam1_001.ts`).
- Files are served statically at `/streams/` by the frontend.
- For no-cache live playback, the app uses `/api/stream/` which serves the same files with `Cache-Control: no-store`.

## Firewall

Ensure ports 9000 and 9002 are open:

```bash
sudo ufw allow 9000
sudo ufw allow 9002
sudo ufw reload
```

## Verification

- Frontend: `http://YOUR_SERVER_IP:9002`
- Backend API: `http://YOUR_SERVER_IP:9000/api/v1`
- Map: `http://YOUR_SERVER_IP:9000/map/`

## Checklist

- [ ] `FRONTEND_API_URL` and `NEXT_PUBLIC_API_URL` set to `http://SERVER_IP:9000`
- [ ] `web/.env` exists with the same values
- [ ] Backend bound to 0.0.0.0 (default via `HOST`)
- [ ] Frontend bound to 0.0.0.0 (default via `HOST`)
- [ ] CORS allows frontend (default: `origin: true`; set `CORS_ORIGIN` to restrict)
- [ ] Streams directory `web/public/streams/` writable by FFmpeg
