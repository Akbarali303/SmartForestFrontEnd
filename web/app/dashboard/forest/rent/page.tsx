'use client';

import { useForestAreas } from '@/contexts/ForestAreasContext';
import type { EffectiveAreaStatus } from '@/contexts/ForestAreasContext';

const EFFECTIVE_BADGE_CLASS: Record<EffectiveAreaStatus, string> = {
  empty: 'bg-slate-100 text-slate-600 border-slate-200',
  leased: 'bg-forest-100 text-forest-700 border-forest-200',
  expiring_soon: 'bg-amber-100 text-amber-700 border-amber-200',
  expired: 'bg-red-100 text-red-700 border-red-200',
};

export default function ForestRentPage() {
  const { leasedAreas, getEffectiveStatus, effectiveStatusLabel } = useForestAreas();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Ijara yerlar</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Ijara shartnomasi bo&apos;yicha band qilingan hududlar — muddat bo&apos;yicha holat avtomatik hisoblanadi
        </p>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Hudud</th>
                <th className="px-4 py-3">Maydon</th>
                <th className="px-4 py-3">Holat (muddati)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leasedAreas.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                    Hozircha ijara yerlar yo&apos;q. Shartnomalar sahifasida yangi shartnoma yarating.
                  </td>
                </tr>
              ) : (
                leasedAreas.map((a) => {
                  const effective = getEffectiveStatus(a);
                  return (
                    <tr key={a.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-medium text-slate-800">{a.name}</td>
                      <td className="px-4 py-3 text-slate-600">{a.maydon.toLocaleString('uz')} ga</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${EFFECTIVE_BADGE_CLASS[effective]}`}>
                          {effectiveStatusLabel(effective)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
