'use client';

import { useForestAreas } from '@/contexts/ForestAreasContext';

export default function ForestFreePage() {
  const { emptyAreas, statusLabel } = useForestAreas();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Bo&apos;sh yerlar</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Hali ijaraga berilmagan hududlar — shartnoma yaratilganda bu ro&apos;yxatdan chiqadi
        </p>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Hudud</th>
                <th className="px-4 py-3">Maydon</th>
                <th className="px-4 py-3">Holat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {emptyAreas.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                    Hozircha bo&apos;sh yerlar yo&apos;q. Barcha hududlar ijarada yoki muddati tugagan.
                  </td>
                </tr>
              ) : (
                emptyAreas.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-800">{a.name}</td>
                    <td className="px-4 py-3 text-slate-600">{a.maydon.toLocaleString('uz')} ga</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                        {statusLabel(a.status)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
