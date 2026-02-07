import { NextRequest, NextResponse } from 'next/server';

const BACKEND =
  process.env.FRONTEND_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  (process.env.NODE_ENV === 'production' ? '' : 'http://127.0.0.1:9000');
const MAP_URL = BACKEND ? `${BACKEND.replace(/\/$/, '')}/map/` : '';

/**
 * Xarita HTML ni proxy qiladi — X-Frame-Options bo‘lmasa iframe ichida ochiladi.
 * HTML ga <base href="..."> qo‘shiladi, shunda script/link lar backenddan yuklanadi.
 */
export async function GET(request: NextRequest) {
  try {
    if (!MAP_URL) {
      return new NextResponse('Backend URL not configured', { status: 503 });
    }
    const res = await fetch(MAP_URL, {
      headers: { Accept: 'text/html' },
      cache: 'no-store',
    });
    if (!res.ok) {
      return new NextResponse(`Map backend error: ${res.status}`, {
        status: res.status,
      });
    }
    let html = await res.text();
    const baseHref = MAP_URL;
    const backendOrigin = BACKEND.replace(/\/$/, '');
    if (!html.includes('<base ')) {
      html = html.replace(
        /<head(\s[^>]*)?>/i,
        (m: string) =>
          `${m}<base href="${baseHref}"><script>window.SMART_FOREST_BACKEND=window.location.origin;</script>`,
      );
    }
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error('[map-proxy]', e);
    return new NextResponse('Map backend unreachable', { status: 502 });
  }
}
