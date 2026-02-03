'use client';

import { useEffect, useRef, useState } from 'react';

const STREAM_SRC = '/streams/cam1.m3u8';

export default function CameraTestPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Yuklanmoqda...');

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const isNativeHLS =
      typeof window !== 'undefined' &&
      video.canPlayType('application/vnd.apple.mpegurl');

    if (isNativeHLS) {
      video.src = STREAM_SRC;
      video.addEventListener('loadedmetadata', () => setStatus('Oqim tayyor'));
      video.addEventListener('error', () =>
        setError('Oqim yuklanmadi. /streams/cam1.m3u8 mavjudligini tekshiring.')
      );
      return;
    }

    let hls: import('hls.js').default | null = null;

    const initHls = async () => {
      const Hls = (await import('hls.js')).default;
      if (Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          liveSyncDuration: 1,
          liveMaxLatencyDuration: 2,
          startPosition: -1,
          xhrSetup: (xhr) => {
            try {
              xhr.setRequestHeader('Cache-Control', 'no-cache');
            } catch {}
          },
        });
        hls.loadSource(STREAM_SRC);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => setStatus('Oqim tayyor'));
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            setError(
              data.type === Hls.ErrorTypes.NETWORK_ERROR
                ? 'Oqim topilmadi. /streams/cam1.m3u8 va segmentlarni tekshiring.'
                : 'Oqim xatosi.'
            );
          }
        });
      } else {
        setError('HLS qo‘llab-quvvatlanmaydi (HTTPS yoki .m3u8 kerak).');
      }
    };

    initHls();
    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-6">
      <div className="max-w-4xl mx-auto">
        <header className="mb-4">
          <h1 className="text-xl font-semibold text-white">
            Camera test — HLS oqim
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manba: <code className="bg-slate-800 px-1 rounded">{STREAM_SRC}</code>
            . Bu sahifa xaritaga qo‘shishdan oldin oqimni tekshirish uchun.
          </p>
        </header>

        <div className="rounded-lg overflow-hidden bg-black border border-slate-700">
          <video
            ref={videoRef}
            className="w-full aspect-video"
            controls
            autoPlay
            muted
            playsInline
          />
          <div className="px-3 py-2 bg-slate-800/80 text-slate-400 text-sm">
            {status}
          </div>
        </div>

        {error && (
          <div
            className="mt-4 p-4 rounded-lg bg-red-900/30 border border-red-700 text-red-200 text-sm"
            role="alert"
          >
            {error}
          </div>
        )}

        <p className="mt-4 text-slate-500 text-xs">
          O‘chirish: <code>app/camera-test/</code>, <code>public/streams/</code>{' '}
          va <code>hls.js</code> paketini olib tashlang.
        </p>
      </div>
    </div>
  );
}
