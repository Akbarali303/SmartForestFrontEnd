import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';

const POSSIBLE_STREAMS_DIRS = [
  () => path.join(process.cwd(), 'public', 'streams'),
  () => path.join(process.cwd(), 'web', 'public', 'streams'),
];

async function readStreamFile(fileName: string): Promise<Buffer> {
  for (const getDir of POSSIBLE_STREAMS_DIRS) {
    const dir = getDir();
    const filePath = path.join(dir, fileName);
    const dirResolved = path.resolve(dir);
    const fileResolved = path.resolve(filePath);
    if (!fileResolved.startsWith(dirResolved) || fileResolved.includes('..')) continue;
    try {
      return await readFile(filePath);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw e;
    }
  }
  const err = new Error('ENOENT') as NodeJS.ErrnoException;
  err.code = 'ENOENT';
  throw err;
}

/**
 * HLS oqim fayllarini (.m3u8, .ts) to'g'ri Content-Type bilan xizmat qiladi.
 * So'rov: GET /api/stream/cam1.m3u8 yoki /api/stream/cam1_174.ts
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ path: string[] }> | { path: string[] } }
) {
  try {
    const params = context.params;
    const pathSegments = typeof (params as Promise<unknown>).then === 'function'
      ? (await (params as Promise<{ path: string[] }>)).path
      : (params as { path: string[] }).path;
    const fileName = Array.isArray(pathSegments) ? pathSegments.join('/') : String(pathSegments);
    if (!fileName || fileName.includes('..') || path.isAbsolute(fileName)) {
      return new NextResponse('Invalid path', { status: 400 });
    }
    const buf = await readStreamFile(fileName);
    const ext = path.extname(fileName).toLowerCase();
    const contentType =
      ext === '.m3u8'
        ? 'application/vnd.apple.mpegurl'
        : ext === '.ts'
          ? 'video/MP2T'
          : 'application/octet-stream';
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
      },
    });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT') return new NextResponse('Not found', { status: 404 });
    console.error('[api/stream]', err);
    return new NextResponse('Server error', { status: 500 });
  }
}
