'use client';

import { CameraGrid } from '@/components/CameraGrid';
import { MONITORING_CAMERAS } from '@/lib/mockCameras';

export default function MonitoringCenterPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 mb-4">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Monitoring markazi</h1>
        <p className="text-slate-500 text-sm mt-1">Kamera oqimlari — grid ko‘rinishi, kamerani bosib kattalashtirish mumkin. Haqiqiy live uchun: <code className="bg-slate-100 px-1 rounded text-xs">npm run camera:cam1</code> (web/ da)</p>
      </div>
      <div className="flex-1 min-h-0">
        <CameraGrid cameras={MONITORING_CAMERAS} className="h-full" />
      </div>
    </div>
  );
}
