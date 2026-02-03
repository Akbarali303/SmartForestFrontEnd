/**
 * Custom server: /socket.io ni backend ga proxy qiladi (HTTP + WebSocket).
 * CWD avval o‘rnatiladi — Next.js va webpack web/ dan ishlashi uchun.
 */
const path = require('path');
process.chdir(path.join(__dirname));

const http = require('http');
const { parse } = require('url');
const httpProxy = require('http-proxy');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '9002', 10);
const backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:9000';

const proxy = httpProxy.createProxyServer({ ws: true });

proxy.on('error', (err, req, res) => {
  console.error('[proxy]', err.message);
  if (res && typeof res.writeHead === 'function' && !res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'text/plain' }).end('Bad Gateway');
  }
});

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = http.createServer(async (req, res) => {
    const url = req.url || '';
    if (url.startsWith('/socket.io')) {
      proxy.web(req, res, { target: backendUrl });
      return;
    }
    // /api/v1 — backend API (saqlash va boshqa so'rovlar ishlashi uchun)
    if (url.startsWith('/api/v1')) {
      proxy.web(req, res, { target: backendUrl });
      return;
    }
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('[Next]', req.url, err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('Internal Server Error');
      }
    }
  });

  server.on('upgrade', (req, socket, head) => {
    const url = req.url || '';
    if (url.startsWith('/socket.io')) {
      proxy.ws(req, socket, head, { target: backendUrl });
      return;
    }
    socket.destroy();
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
    console.log(`> socket.io -> ${backendUrl}`);
  });
}).catch((err) => {
  console.error('Next.js prepare failed:', err);
  process.exit(1);
});
