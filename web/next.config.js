/** @type {import('next').NextConfig} */
// 127.0.0.1 ishlatiladi — ba'zi muhitlarda localhost 500 sabab bo‘ladi
const path = require('path');
const backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:9000';

// Leaflet mutlaq yo‘li — custom server root’dan ishlaganda ham topilsin
const webDir = __dirname;
const leafletPath = path.join(webDir, 'node_modules', 'leaflet');

const nextConfig = {
  reactStrictMode: true,
  // Chunk URL hech qachon "undefined" bo‘lmasin (GET /_next/undefined 404 ni oldini olish)
  assetPrefix: '',
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
