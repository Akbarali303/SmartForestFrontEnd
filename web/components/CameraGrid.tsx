'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { CameraPlayer } from '@/components/CameraPlayer';
import type { MonitoringCamera } from '@/lib/mockCameras';

export type GridSize = '2x2' | '3x3' | '4x4';

const GRID_SIZES: { value: GridSize; label: string; count: number }[] = [
  { value: '2x2', label: '2×2 (4)', count: 4 },
  { value: '3x3', label: '3×3 (9)', count: 9 },
  { value: '4x4', label: '4×4 (16)', count: 16 },
];

// AI detection simulation — faqat kattalashtirilgan ko‘rinishda
const AI_EVENT_TYPES = [
  { id: 'fire', label: 'O‘t aniqlandi', color: 'bg-red-600', icon: '🔥' },
  { id: 'smoke', label: 'Tutun aniqlandi', color: 'bg-amber-600', icon: '💨' },
  { id: 'illegal', label: 'Noqonuniy harakat', color: 'bg-red-700', icon: '⚠️' },
  { id: 'movement', label: 'Harakat signali', color: 'bg-amber-500', icon: '👤' },
] as const;

const ALERT_AUTO_DISMISS_MS = 8000;
/** Birinchi hodisa 1 soniyada; keyingilari 20–40 s */
const FIRST_ALERT_DELAY_MS = 1000;
const NEXT_ALERT_MIN_MS = 20_000;
const NEXT_ALERT_MAX_MS = 40_000;
function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

type AIDetectionAlert = {
  id: number;
  type: (typeof AI_EVENT_TYPES)[number];
  timestamp: Date;
};

export type CameraGridProps = {
  cameras: MonitoringCamera[];
  className?: string;
};

export function CameraGrid({ cameras, className = '' }: CameraGridProps) {
  const [gridSize, setGridSize] = useState<GridSize>('2x2');
  const [enlargedId, setEnlargedId] = useState<string | null>(null);
  const [aiAlert, setAiAlert] = useState<AIDetectionAlert | null>(null);
  const nextTriggerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alertIdRef = useRef(0);
  const isFirstTriggerRef = useRef(true);
  const enlargedIdRef = useRef<string | null>(null);
  enlargedIdRef.current = enlargedId;

  const sizeConfig = GRID_SIZES.find((s) => s.value === gridSize) ?? GRID_SIZES[0];
  const count = sizeConfig.count;
  const visibleCameras = cameras.slice(0, count);

  const scheduleNextTrigger = useCallback((cameraId: string) => {
    if (nextTriggerRef.current) clearTimeout(nextTriggerRef.current);
    const delayMs = isFirstTriggerRef.current
      ? FIRST_ALERT_DELAY_MS
      : randomBetween(NEXT_ALERT_MIN_MS, NEXT_ALERT_MAX_MS);
    isFirstTriggerRef.current = false;
    nextTriggerRef.current = setTimeout(async () => {
      nextTriggerRef.current = null;
      const cid = enlargedIdRef.current || cameraId;
      let alert: AIDetectionAlert | null = null;
      try {
        const res = await fetch(`/api/ai-events?cameraId=${encodeURIComponent(cid)}`);
        const data = await res.json();
        if (data?.event) {
          const e = data.event;
          const type = AI_EVENT_TYPES.find((t) => t.id === e.type) ?? AI_EVENT_TYPES[0];
          alert = {
            id: ++alertIdRef.current,
            type,
            timestamp: new Date(e.timestamp || Date.now()),
          };
        }
      } catch (_) {
        /* API xato bo‘lsa local mock */
      }
      if (!alert) {
        const eventType = AI_EVENT_TYPES[Math.floor(Math.random() * AI_EVENT_TYPES.length)];
        alert = {
          id: ++alertIdRef.current,
          type: eventType,
          timestamp: new Date(),
        };
      }
      setAiAlert(alert);
      if (dismissRef.current) clearTimeout(dismissRef.current);
      dismissRef.current = setTimeout(() => {
        dismissRef.current = null;
        setAiAlert(null);
        if (enlargedIdRef.current) scheduleNextTrigger(enlargedIdRef.current);
      }, ALERT_AUTO_DISMISS_MS);
    }, delayMs);
  }, []);

  useEffect(() => {
    if (!enlargedId) {
      if (nextTriggerRef.current) {
        clearTimeout(nextTriggerRef.current);
        nextTriggerRef.current = null;
      }
      if (dismissRef.current) {
        clearTimeout(dismissRef.current);
        dismissRef.current = null;
      }
      setAiAlert(null);
      isFirstTriggerRef.current = true;
      return;
    }
    isFirstTriggerRef.current = true;
    scheduleNextTrigger(enlargedId);
    return () => {
      if (nextTriggerRef.current) clearTimeout(nextTriggerRef.current);
      if (dismissRef.current) clearTimeout(dismissRef.current);
    };
  }, [enlargedId, scheduleNextTrigger]);

  const closeAlert = useCallback(() => {
    if (dismissRef.current) {
      clearTimeout(dismissRef.current);
      dismissRef.current = null;
    }
    setAiAlert(null);
    if (enlargedId) scheduleNextTrigger(enlargedId);
  }, [enlargedId, scheduleNextTrigger]);

  const triggerTestAlert = useCallback(() => {
    if (dismissRef.current) clearTimeout(dismissRef.current);
    const eventType = AI_EVENT_TYPES[Math.floor(Math.random() * AI_EVENT_TYPES.length)];
    setAiAlert({
      id: ++alertIdRef.current,
      type: eventType,
      timestamp: new Date(),
    });
    dismissRef.current = setTimeout(() => {
      dismissRef.current = null;
      setAiAlert(null);
      if (enlargedId) scheduleNextTrigger(enlargedId);
    }, ALERT_AUTO_DISMISS_MS);
  }, [enlargedId, scheduleNextTrigger]);

  if (enlargedId) {
    const cam = cameras.find((c) => c.id === enlargedId);
    if (!cam) {
      setEnlargedId(null);
    } else {
      return (
        <div className={`flex flex-col h-full ${className}`}>
          <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
            <button
              type="button"
              onClick={() => setEnlargedId(null)}
              className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-800 text-sm font-medium hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-forest-500"
            >
              ← Gridga qaytish
            </button>
            <span className="text-slate-700 font-medium truncate">{cam.name}</span>
            <button
              type="button"
              onClick={triggerTestAlert}
              className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              AI ni sinash
            </button>
          </div>
          <div className="flex-1 min-h-0 rounded-xl overflow-visible bg-slate-900 border border-slate-200 relative">
            {cam.status === 'offline' ? (
              <PlaceholderCell camera={cam} />
            ) : (
              <CameraPlayer
                streamUrl={cam.streamUrl}
                autoPlay
                showLoading
                errorMessage="Kamera ulanmagan"
                autoReconnect
                className="w-full h-full"
                videoClassName="min-h-[320px]"
              />
            )}
            {aiAlert && (
              <AIDetectionAlertOverlay
                alert={aiAlert}
                onClose={closeAlert}
                onCreateOnMap={closeAlert}
              />
            )}
          </div>
        </div>
      );
    }
  }

  const cols = gridSize === '2x2' ? 2 : gridSize === '3x3' ? 3 : 4;

  // Bir xil oqimdan gridda faqat 2 ta pleer ochamiz — 3/4-qatorlar qora qolmasin
  const streamUrlCount = new Map<string, number>();
  const visibleWithStreamSlot = visibleCameras.map((cam) => {
    const url = cam.streamUrl;
    const used = streamUrlCount.get(url) ?? 0;
    streamUrlCount.set(url, used + 1);
    return { camera: cam, streamEnabled: used < 2 };
  });

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <span className="text-sm font-medium text-slate-600">Grid:</span>
        {GRID_SIZES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setGridSize(s.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-forest-500 ${
              gridSize === s.value
                ? 'bg-forest-600 text-white'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div
        className="grid gap-3 flex-1 min-h-0"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {visibleWithStreamSlot.map(({ camera, streamEnabled }) => (
          <CameraGridCell
            key={camera.id}
            camera={camera}
            streamEnabled={streamEnabled}
            onClick={() => setEnlargedId(camera.id)}
          />
        ))}
      </div>
    </div>
  );
}

function AIDetectionAlertOverlay({
  alert,
  onClose,
  onCreateOnMap,
}: {
  alert: AIDetectionAlert;
  onClose: () => void;
  onCreateOnMap: () => void;
}) {
  const timeStr = alert.timestamp.toLocaleTimeString('uz-UZ', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  return (
    <div className="absolute left-4 right-4 top-4 z-[9999] min-h-[80px] rounded-lg border-2 border-amber-400 bg-slate-900 shadow-xl">
      <div className={`flex items-center gap-2 px-3 py-2 rounded-t-md ${alert.type.color} text-white`}>
        <span className="text-lg" aria-hidden>{alert.type.icon}</span>
        <span className="font-semibold text-sm">{alert.type.label}</span>
        <span className="ml-auto text-xs opacity-90">{timeStr}</span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white"
          aria-label="Yopish"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="px-3 py-2 flex items-center justify-between gap-3">
        <span className="text-xs text-slate-400">AI simulyatsiya — xaritada hodisa yaratish</span>
        <Link
          href="/dashboard/map"
          onClick={onCreateOnMap}
          className="px-3 py-1.5 rounded-lg bg-forest-600 text-white text-sm font-medium hover:bg-forest-700 focus:outline-none focus:ring-2 focus:ring-forest-500"
        >
          Xaritada hodisa yaratish
        </Link>
      </div>
    </div>
  );
}

function PlaceholderCell({ camera }: { camera: MonitoringCamera }) {
  return (
    <div className="w-full h-full min-h-[120px] flex flex-col items-center justify-center bg-slate-800 text-slate-400 rounded-lg">
      <svg className="w-12 h-12 mb-2 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
      <span className="text-sm font-medium">Kamera ulanmagan</span>
      <span className="text-xs mt-0.5">{camera.name}</span>
    </div>
  );
}

function CameraGridCell({
  camera,
  streamEnabled,
  onClick,
}: {
  camera: MonitoringCamera;
  /** Bir xil oqimdan faqat 2 ta pleer — qolganlariga "Ko'rish uchun bosing" */
  streamEnabled: boolean;
  onClick: () => void;
}) {
  const isOffline = camera.status === 'offline';

  return (
    <div
      className="flex flex-col rounded-xl overflow-hidden bg-slate-900 border border-slate-200 shadow-sm hover:border-forest-500/50 hover:shadow-md transition-all cursor-pointer min-h-0"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
    >
      <div className="flex items-center justify-between px-2 py-1.5 bg-slate-800/80 border-b border-slate-700 shrink-0">
        <span className="text-xs font-medium text-slate-200 truncate">{camera.name}</span>
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            isOffline ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'
          }`}
          title={isOffline ? 'Offline' : 'Online'}
        />
      </div>
      <div className="relative flex-1 min-h-[100px] aspect-video">
        {isOffline ? (
          <PlaceholderCell camera={camera} />
        ) : !streamEnabled ? (
          <div className="w-full h-full min-h-[100px] flex flex-col items-center justify-center bg-slate-800 text-slate-400 rounded-b-xl">
            <svg className="w-10 h-10 mb-2 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span className="text-xs font-medium text-center px-2">Live ko&apos;rish uchun bosing</span>
          </div>
        ) : (
          <CameraPlayer
            streamUrl={camera.streamUrl}
            autoPlay
            showLoading
            errorMessage="Kamera ulanmagan"
            autoReconnect
            className="w-full h-full"
            videoClassName="object-cover"
          />
        )}
      </div>
    </div>
  );
}
