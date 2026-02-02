# Smart Forest — Admin Platform (Web)

Next.js ilovasi: Login + Dashboard + Map bitta tizimda.

## Sahifalar

| Yo‘l | Tavsif |
|------|--------|
| `/login` | Kirish (demo: `admin` / `admin123`) |
| `/dashboard` | Bosh sahifa — statistikalar, jadvalar |
| `/dashboard/map` | Mavjud map sahifa (iframe orqali) |
| `/dashboard/monitoring` | Monitoring (demo) |
| `/dashboard/cameras` | Kamerlar (demo) |
| `/dashboard/analytics` | Analytics (demo) |
| `/dashboard/reports` | Hisobotlar (demo) |
| `/dashboard/settings` | Sozlamalar (demo) |

## Ishga tushirish

**Ikkala server ham ishlashi shart** — xarita Next.js orqali backend ga proxy qilinadi.

1. **Loyiha ildizida** bir marta dependency o‘rnating:
   ```bash
   npm install
   ```

2. **Backend (NestJS)** — birinchi terminalda:
   ```bash
   # Loyiha ildizida (SmartForestFrontEnd-main)
   npm run start:dev
   ```
   Backend `http://localhost:3000` da ishlaydi (map: `/map/`, API: `/api/v1`).

3. **Frontend (Next.js)** — ikkinchi terminalda:
   ```bash
   cd web
   npm install
   npm run dev
   ```
   Frontend `http://localhost:3001` da ochiladi.  
   **Agar 3001 band bo‘lsa:** `npm run dev:3002` va brauzerda `http://localhost:3002` oching.

4. Brauzerda: **http://localhost:3001** (yoki 3002 agar `dev:3002` ishlatgan bo‘lsangiz)
   - Login: `admin` / `admin123`
   - Kirishdan keyin Dashboard ochiladi
   - Sidebar → **Map** bosilsa mavjud map sahifa dashboard ichida ochiladi (bir xil origin orqali, iframe bloklanmaydi)

## O‘zgaruvchilar

`web/.env.local` da (ixtiyoriy):

```
BACKEND_URL=http://localhost:3000
```

Agar backend boshqa portda yoki boshqa hostda bo‘lsa, shu URL ni o‘zgartiring.

## Texnik

- **Next.js 14** (App Router)
- **React 18**
- **Tailwind CSS**
- Auth: client-side (localStorage), demo login `admin` / `admin123`
- Map: mavjud `/map/` sahifa iframe orqali dashboard ichida
