import { NextRequest, NextResponse } from 'next/server';

const BACKEND =
  process.env.FRONTEND_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.BACKEND_URL ||
  (process.env.NODE_ENV === 'production' ? '' : 'http://127.0.0.1:9000');

const ERROR_HTML = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Xarita yuklanmadi</title></head>
<body style="font-family:sans-serif;padding:2rem;text-align:center;background:#f8fafc;">
  <h1 style="color:#64748b;">Xarita yuklanmadi</h1>
  <p style="color:#475569;">Server ishlamayapti yoki xatolik yuz berdi.</p>
  <p style="color:#475569;">Loyiha ildizida <code style="background:#e2e8f0;padding:2px 6px;border-radius:4px;">npm run start:dev</code> ni ishga tushiring.</p>
  <p style="color:#94a3b8;font-size:14px;">Keyin sahifani yangilang.</p>
</body>
</html>`;

function error503() {
  return new NextResponse(ERROR_HTML, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

type RouteParams = { path?: string[] };

export async function GET(
  request: NextRequest,
  context: { params?: Promise<RouteParams> | RouteParams }
) {
  try {
    const rawParams = context?.params;
    const params: RouteParams | undefined = rawParams instanceof Promise ? await rawParams : rawParams;
    const path = params?.path;
    const pathSegments = path?.length ? path.join('/') : '';
    const backendPath = pathSegments ? `/map/${pathSegments}` : '/map/';
    if (!BACKEND) {
      return error503();
    }
    const url = `${BACKEND.replace(/\/$/, '')}${backendPath}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: request.headers.get('accept') || '*/*' },
      cache: 'no-store',
    });

    if (!res.ok) {
      return error503();
    }

    const contentType = res.headers.get('content-type') || 'text/html';
    const body = await res.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    console.error('[map proxy]', err);
    return error503();
  }
}
