'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_STREAM = '/streams/cam1.m3u8';
/** Kamera uzilganda / tok ketganda: birinchi urinishlar tezroq */
const RECONNECT_DELAY_MS = 3000;
const RECONNECT_DELAY_LONG_MS = 10000;
/** Cheksiz qayta ulanish — kamera qaytib kelguncha davom etadi */
const MAX_RECONNECT_ATTEMPTS = 9999;
/** Live rejimida manifest yangilash — real-time yaqin */
const LIVE_MANIFEST_REFRESH_MS = 8000;

export type CameraPlayerProps = {
  /** HLS stream URL. Default: /streams/cam1.m3u8 */
  streamUrl?: string;
  /** Autoplay (muted to satisfy browser policy) */
  autoPlay?: boolean;
  /** Show loading state while stream loads */
  showLoading?: boolean;
  /** Message when stream fails */
  errorMessage?: string;
  /** Auto-reconnect on fatal error */
  autoReconnect?: boolean;
  className?: string;
  videoClassName?: string;
};

/**
 * HLS camera player using hls.js.
 * If Hls.isSupported() → load stream via hls.js; else fallback to native HLS (e.g. Safari).
 * Use inside monitoring panel or popup (e.g. CameraStreamModal).
 */

export function CameraPlayer({
  streamUrl = DEFAULT_STREAM,
  autoPlay = true,
  showLoading = true,
  errorMessage = 'Kamera ulanmagan',
  autoReconnect = true,
  className = '',
  videoClassName = '',
}: CameraPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<import('hls.js').default | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveRefreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keshlashsiz live: /streams/... ni /api/stream/... orqali ochamiz (no-cache)
  const path = streamUrl.startsWith('/') ? streamUrl : '/' + streamUrl;
  const pathForFetch =
    path.startsWith('/streams/') ? '/api/stream/' + path.slice('/streams/'.length) : path;
  const fullStreamUrl =
    typeof window !== 'undefined'
      ? streamUrl.startsWith('http')
        ? streamUrl
        : window.location.origin + pathForFetch
      : '';

  const cleanup = useCallback(() => {
    if (liveRefreshTimerRef.current) {
      clearInterval(liveRefreshTimerRef.current);
      liveRefreshTimerRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch {}
      hlsRef.current = null;
    }
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.removeAttribute('src');
      v.load();
    }
  }, []);

  const tryLoad = useCallback(() => {
    const video = videoRef.current;
    if (!video || !fullStreamUrl) return;

    setError(null);
    setLoading(true);
    setStatus(reconnectAttemptsRef.current > 0 ? 'Qayta ulanmoqda...' : 'Yuklanmoqda...');

    let cancelled = false;

    const initHls = async () => {
      const Hls = (await import('hls.js')).default;
      if (cancelled || !videoRef.current) return;
      if (!Hls.isSupported()) {
        const isNativeHLS = videoRef.current?.canPlayType('application/vnd.apple.mpegurl');
        if (isNativeHLS) {
          const v = videoRef.current;
          if (v) {
            const urlWithCacheBuster = fullStreamUrl + (fullStreamUrl.includes('?') ? '&' : '?') + '_=' + Date.now();
            v.src = urlWithCacheBuster;
            v.addEventListener('loadedmetadata', () => { if (!cancelled) { setLoading(false); setStatus('Live'); } }, { once: true });
            v.addEventListener('error', () => { if (!cancelled) { setError(errorMessage); setLoading(false); setStatus(''); } }, { once: true });
          }
          return;
        }
        setError(errorMessage);
        setLoading(false);
        setStatus('');
        return;
      }
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        liveSyncDuration: 1,
        liveMaxLatencyDuration: 2,
        startPosition: -1,
        xhrSetup: (xhr) => {
          try {
            xhr.setRequestHeader('Cache-Control', 'no-store, no-cache');
            xhr.setRequestHeader('Pragma', 'no-cache');
          } catch {}
        },
      });
      hlsRef.current = hls;
      const urlWithCacheBuster = fullStreamUrl + (fullStreamUrl.includes('?') ? '&' : '?') + '_=' + Date.now();
      hls.loadSource(urlWithCacheBuster);
      const videoEl = videoRef.current;
      if (!videoEl) {
        hls.destroy();
        return;
      }
      hls.attachMedia(videoEl);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (!cancelled) {
          setLoading(false);
          setStatus('Live');
          setError(null);
          reconnectAttemptsRef.current = 0;
          // Live: manifestni vaqt-vaqtida yangilab yangi segmentlarni olish
          if (liveRefreshTimerRef.current) clearInterval(liveRefreshTimerRef.current);
          liveRefreshTimerRef.current = setInterval(() => {
            if (hlsRef.current && videoRef.current) {
              const url = fullStreamUrl + (fullStreamUrl.includes('?') ? '&' : '?') + '_=' + Date.now();
              hlsRef.current.loadSource(url);
            }
          }, LIVE_MANIFEST_REFRESH_MS);
        }
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!cancelled && data.fatal) {
          if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
          }
          if (autoReconnect) {
            reconnectAttemptsRef.current += 1;
            setError(null);
            setLoading(true);
            const attempt = reconnectAttemptsRef.current;
            setStatus(attempt <= 20 ? `Qayta ulanmoqda... (${attempt})` : 'Kamera ulanmadi. Avtomatik qayta ulanish davom etmoqda...');
            const delayMs = attempt <= 15 ? RECONNECT_DELAY_MS : RECONNECT_DELAY_LONG_MS;
            reconnectTimerRef.current = setTimeout(() => {
              reconnectTimerRef.current = null;
              tryLoad();
            }, delayMs);
          } else {
            setError(errorMessage);
            setLoading(false);
            setStatus('');
          }
        }
      });
    };

    initHls();
    return () => {
      cancelled = true;
    };
  }, [fullStreamUrl, errorMessage, autoReconnect]);

  useEffect(() => {
    if (!fullStreamUrl) {
      setError(errorMessage);
      setLoading(false);
      return;
    }
    tryLoad();
    return cleanup;
  }, [fullStreamUrl, tryLoad, cleanup, errorMessage]);

  return (
    <div className={`relative bg-slate-900 aspect-video overflow-hidden ${className}`}>
      <video
        ref={videoRef}
        className={`w-full h-full object-contain bg-black ${videoClassName}`}
        controls
        autoPlay={autoPlay}
        muted={autoPlay}
        playsInline
      />
      {showLoading && loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-forest-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-slate-300 text-sm">{status || 'Yuklanmoqda...'}</span>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-900/95 p-4">
          <p className="text-red-400 font-medium text-lg text-center">{error}</p>
          <button
            type="button"
            onClick={() => {
              reconnectAttemptsRef.current = 0;
              setError(null);
              setLoading(true);
              setStatus('Yuklanmoqda...');
              tryLoad();
            }}
            className="px-4 py-2 rounded-lg bg-forest-600 hover:bg-forest-700 text-white font-medium text-sm transition"
          >
            Qayta ulanish
          </button>
        </div>
      )}
      {status && !error && !loading && (
        <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-black/60 text-slate-300 text-xs flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          {status}
        </div>
      )}
    </div>
  );
}
