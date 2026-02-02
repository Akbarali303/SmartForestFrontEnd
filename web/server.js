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
const port = parseInt(process.env.PORT || '3002', 10);
const backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:3000';

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
  const server = http.createServer((req, res) => {
    const url = req.url || '';
    if (url.startsWith('/socket.io')) {
      proxy.web(req, res, { target: backendUrl });
      return;
    }
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
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
