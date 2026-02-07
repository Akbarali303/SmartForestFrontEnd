'use client';

import { useEffect, useState } from 'react';
import { CameraPlayer } from '@/components/CameraPlayer';

export type CameraStreamModalProps = {
  open: boolean;
  onClose: () => void;
  streamUrl: string;
  cameraName: string;
};

export function CameraStreamModal({ open, onClose, streamUrl, cameraName }: CameraStreamModalProps) {
  const [playerKey, setPlayerKey] = useState(0);
  useEffect(() => {
    if (open) setPlayerKey((k) => k + 1);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Kamera live"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white rounded-xl shadow-xl overflow-hidden max-w-2xl w-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between py-2 px-4 border-b border-slate-200 bg-slate-50">
          <h3 className="font-semibold text-slate-800 truncate">{cameraName}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-forest-500"
            aria-label="Yopish"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <CameraPlayer
          key={playerKey}
          streamUrl={streamUrl || '/streams/cam1.m3u8'}
          autoPlay
          showLoading
          errorMessage="Kamera ulanmagan"
          autoReconnect
        />
      </div>
    </div>
  );
}
