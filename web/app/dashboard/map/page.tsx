'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { MapMode } from '@/components/ForestCreateMap';

const ForestCreateMap = dynamic(() => import('@/components/ForestCreateMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full min-h-[400px] flex items-center justify-center bg-slate-100">
      <span className="text-slate-500">Xarita yuklanmoqda...</span>
    </div>
  ),
});

const MAP_MODE_LABELS: Record<MapMode, string> = {
  land_management: 'Yer boshqaruvi',
  monitoring: 'Monitoring',
  transport_tracking: 'Transport kuzatuvi',
};

const VALID_MODES: MapMode[] = ['land_management', 'monitoring', 'transport_tracking'];

export default function DashboardMapPage() {
  const searchParams = useSearchParams();
  const modeParam = searchParams.get('mode');
  const initialMode: MapMode = VALID_MODES.includes(modeParam as MapMode) ? (modeParam as MapMode) : 'land_management';
  const [mapMode, setMapMode] = useState<MapMode>(initialMode);

  useEffect(() => {
    if (VALID_MODES.includes(modeParam as MapMode)) {
      setMapMode(modeParam as MapMode);
    }
  }, [modeParam]);

  return (
    <div className="h-full min-h-0 flex flex-col relative">
      <div className="absolute top-4 left-4 z-[1000] flex gap-1 p-1 bg-white/95 backdrop-blur rounded-lg border border-slate-200 shadow-md">
        {(['land_management', 'monitoring', 'transport_tracking'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setMapMode(mode)}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-forest-500/40 ${
              mapMode === mode
                ? 'bg-forest-600 text-white shadow'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {MAP_MODE_LABELS[mode]}
          </button>
        ))}
      </div>
      <ForestCreateMap
        mapMode={mapMode}
        drawingMode={false}
        fillContainer={true}
      />
    </div>
  );
}
