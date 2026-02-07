/** @type {import('next').NextConfig} */
const path = require('path');
// FRONTEND_API_URL / NEXT_PUBLIC_API_URL / BACKEND_URL — production da majburiy
const backendUrl =
  process.env.FRONTEND_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.BACKEND_URL ||
  (process.env.NODE_ENV === 'production' ? '' : 'http://127.0.0.1:9000');

if (process.env.NODE_ENV === 'production' && !backendUrl) {
  throw new Error(
    'Production requires FRONTEND_API_URL or NEXT_PUBLIC_API_URL or BACKEND_URL (e.g. http://SERVER_IP:9000)'
  );
}

// Leaflet mutlaq yo‘li — custom server root’dan ishlaganda ham topilsin
const webDir = __dirname;
const leafletPath = path.join(webDir, 'node_modules', 'leaflet');

const nextConfig = {
  reactStrictMode: true,
  // Asset'lar /_next/static/... dan yuklanadi. Subpath'da (mas. proxy) ishlatilsa basePath o‘rnating.
  // assetPrefix: '' — default; faqat CDN bo‘lsa o‘zgartiring.
  webpack: (config, { isServer }) => {
    config.resolve = config.resolve || {};
    config.resolve.modules = [...(config.resolve.modules || []), path.join(webDir, 'node_modules')];
    config.resolve.alias = {
      ...config.resolve.alias,
      leaflet: leafletPath,
      'leaflet/dist/leaflet.css': path.join(leafletPath, 'dist', 'leaflet.css'),
    };
    return config;
  },
  async rewrites() {
    return [
      { source: '/api/v1/:path*', destination: `${backendUrl}/api/v1/:path*` },
      { source: '/public/:path*', destination: `${backendUrl}/public/:path*` },
      { source: '/socket.io', destination: `${backendUrl}/socket.io` },
      { source: '/socket.io/:path*', destination: `${backendUrl}/socket.io/:path*` },
    ];
  },
};

module.exports = nextConfig;
