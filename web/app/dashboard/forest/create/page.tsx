'use client';

import dynamic from 'next/dynamic';

const ForestCreateMap = dynamic(() => import('@/components/ForestCreateMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full min-h-[400px] flex items-center justify-center bg-slate-100">
      <span className="text-slate-500">Xarita yuklanmoqda...</span>
    </div>
  ),
});

export default function ForestCreatePage() {
  return (
    <div className="h-full min-h-0 flex flex-col">
      <ForestCreateMap
        showMonitoringLayers={false}
        showEvents={false}
        drawingMode={true}
        fillContainer={true}
      />
    </div>
  );
}
