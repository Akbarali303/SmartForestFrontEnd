'use client';

import dynamic from 'next/dynamic';

const ForestCreateMap = dynamic(() => import('@/components/ForestCreateMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[480px] flex items-center justify-center bg-slate-100 rounded-lg border border-slate-200">
      <span className="text-slate-500">Xarita yuklanmoqda...</span>
    </div>
  ),
});

export default function ForestCreatePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Hudud qo‘shish</h1>
        <p className="text-slate-500 mt-1 text-sm">
          O‘zbekiston xaritasi — viloyat tanlang, GeoJSON yuklang, maydon avtomatik hisoblanadi
        </p>
      </div>
      <ForestCreateMap />
    </div>
  );
}
