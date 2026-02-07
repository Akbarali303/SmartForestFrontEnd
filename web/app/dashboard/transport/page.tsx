'use client';

import Link from 'next/link';
import {
  MOCK_VEHICLES,
  TRANSPORT_TYPE_LABELS,
  VEHICLE_STATUS_LABELS,
  type VehicleStatus,
} from '@/lib/mockVehicles';

const STATUS_CLASS: Record<VehicleStatus, string> = {
  moving: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  idle: 'bg-amber-100 text-amber-700 border-amber-200',
  offline: 'bg-slate-100 text-slate-600 border-slate-200',
  maintenance: 'bg-orange-100 text-orange-700 border-orange-200',
};

export default function TransportPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Transportlar</h1>
          <p className="text-slate-500 mt-1 text-sm">O‘rmon xo‘jaligi transportlari va haydovchilar</p>
        </div>
        <Link
          href="/dashboard/map?mode=transport_tracking"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-forest-600 text-white text-sm font-medium hover:bg-forest-700 focus:outline-none focus:ring-2 focus:ring-forest-500/40"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          Xaritada ko‘rish
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <th className="text-left px-5 py-3 font-medium">Transport nomi</th>
                <th className="text-left px-5 py-3 font-medium">Turi</th>
                <th className="text-left px-5 py-3 font-medium">O‘rmon xo‘jaligi</th>
                <th className="text-left px-5 py-3 font-medium">Haydovchi</th>
                <th className="text-left px-5 py-3 font-medium">Bosib o‘tgan (km)</th>
                <th className="text-left px-5 py-3 font-medium">Yo‘nalish</th>
                <th className="text-left px-5 py-3 font-medium">Holat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {MOCK_VEHICLES.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3 font-medium text-slate-800">{v.name}</td>
                  <td className="px-5 py-3 text-slate-700">{TRANSPORT_TYPE_LABELS[v.transportType]}</td>
                  <td className="px-5 py-3 text-slate-700">{v.forestry}</td>
                  <td className="px-5 py-3 text-slate-700">{v.driver}</td>
                  <td className="px-5 py-3 text-slate-700">{v.distanceTraveledKm.toFixed(1)}</td>
                  <td className="px-5 py-3 text-slate-700">{v.currentDestination}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASS[v.status]}`}
                    >
                      {VEHICLE_STATUS_LABELS[v.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
