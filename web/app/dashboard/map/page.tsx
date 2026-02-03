'use client';

// Xarita HTML va _next/chunk’lari backendda — iframe to‘g‘ridan-to‘g‘ri backend URL’iga yuklansin,
// shunda script’lar 404 bermaydi. NEXT_PUBLIC_BACKEND_URL berilmasa: dev da 127.0.0.1:9000, prod da /map/
const MAP_BACKEND =
  typeof process.env.NEXT_PUBLIC_BACKEND_URL === 'string' && process.env.NEXT_PUBLIC_BACKEND_URL
    ? process.env.NEXT_PUBLIC_BACKEND_URL.replace(/\/$/, '')
    : process.env.NODE_ENV === 'development'
      ? 'http://127.0.0.1:9000'
      : '';
const mapSrc = MAP_BACKEND ? '/api/map-proxy' : '/map/';

export default function DashboardMapPage() {
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 relative bg-slate-200">
        <iframe
          src={mapSrc}
          title="Smart Forest xaritasi"
          className="absolute inset-0 w-full h-full border-0"
          allow="geolocation"
        />
      </div>
    </div>
  );
}
