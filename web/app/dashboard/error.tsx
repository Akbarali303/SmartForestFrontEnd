'use client';

import { useEffect } from 'react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Dashboard error]', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 bg-slate-50">
      <h2 className="text-lg font-semibold text-slate-800 mb-2">Xatolik yuz berdi</h2>
      <p className="text-sm text-slate-500 mb-4 text-center max-w-md">
        Boshqaruv paneli yuklanmadi. Sahifani yangilab ko‘ring yoki tizimga kiring.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="px-4 py-2 rounded-lg bg-forest-600 text-white text-sm font-medium hover:bg-forest-700 transition"
      >
        Qayta urinish
      </button>
    </div>
  );
}
