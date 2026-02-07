'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { CameraPlayer } from '@/components/CameraPlayer';

const DEFAULT_STREAM = '/streams/cam1.m3u8';

function normalizeStreamPath(stream: string | null): string {
  const path = (stream?.trim() || DEFAULT_STREAM);
  return path.startsWith('http') ? path : path.startsWith('/') ? path : '/' + path;
}

export default function CameraLivePage() {
  const searchParams = useSearchParams();
  const streamPath = useMemo(
    () => normalizeStreamPath(searchParams.get('stream')),
    [searchParams]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Kamera — Live</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Oqim: <code className="bg-slate-100 px-1 rounded text-xs">{streamPath}</code>
          </p>
        </div>
        <Link
          href="/dashboard/cameras"
          className="text-sm font-medium text-forest-600 hover:text-forest-700"
        >
          ← Kamerlar ro‘yxati
        </Link>
      </div>

      <div className="rounded-xl overflow-hidden border border-slate-200 shadow-lg">
        <CameraPlayer
          key={streamPath}
          streamUrl={streamPath}
          autoPlay
          showLoading
          errorMessage="Oqim yuklanmadi. Backend stream ishlatilayotganini tekshiring (npm run camera:cam1)."
          autoReconnect
        />
      </div>

      <p className="text-slate-500 text-sm">
        Boshqa oqim: <code className="bg-slate-100 px-1 rounded text-xs">?stream=/streams/camera1.m3u8</code> query orqali berishingiz mumkin.
      </p>
    </div>
  );
}
