'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  MOCK_MONITORING_EVENTS,
  MOCK_INSPECTORS_LIST,
  EVENT_TYPE_LABELS,
  SEVERITY_LABELS,
  STATUS_LABELS,
  type MonitoringEventRow,
  type MonitoringEventStatus,
} from '@/lib/mockMonitoringEvents';

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '—' : d.toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

export default function MonitoringPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<MonitoringEventStatus | ''>('');
  const [inspectorFilter, setInspectorFilter] = useState('');
  const [assignModal, setAssignModal] = useState<MonitoringEventRow | null>(null);
  const [statusModal, setStatusModal] = useState<MonitoringEventRow | null>(null);
  const [events, setEvents] = useState<MonitoringEventRow[]>(MOCK_MONITORING_EVENTS);

  const filtered = useMemo(() => {
    return events.filter((ev) => {
      const d = new Date(ev.date).getTime();
      if (isNaN(d)) return false;
      if (dateFrom) {
        const from = new Date(dateFrom + 'T00:00:00').getTime();
        if (!isNaN(from) && d < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo + 'T23:59:59').getTime();
        if (!isNaN(to) && d > to) return false;
      }
      if (statusFilter && ev.status !== statusFilter) return false;
      if (inspectorFilter && (ev.assignedInspector ?? '') !== inspectorFilter) return false;
      return true;
    });
  }, [events, dateFrom, dateTo, statusFilter, inspectorFilter]);

  const handleAssignInspector = (eventId: string, inspector: string) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, assignedInspector: inspector || null } : e))
    );
    setAssignModal(null);
  };

  const handleChangeStatus = (eventId: string, status: MonitoringEventStatus) => {
    setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, status } : e)));
    setStatusModal(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Monitoring hodisalari</h1>
        <p className="text-slate-500 mt-1 text-sm">Hodisalar jadvali — filtrlash va harakatlar</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Sanadan</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-slate-200 py-2 px-3 text-sm text-slate-800 focus:ring-2 focus:ring-forest-500/40 focus:border-forest-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Sanagacha</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-slate-200 py-2 px-3 text-sm text-slate-800 focus:ring-2 focus:ring-forest-500/40 focus:border-forest-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Holat</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter((e.target.value || '') as MonitoringEventStatus | '')}
            className="rounded-lg border border-slate-200 py-2 px-3 text-sm text-slate-800 focus:ring-2 focus:ring-forest-500/40 focus:border-forest-500 min-w-[140px]"
          >
            <option value="">Barchasi</option>
            {(Object.keys(STATUS_LABELS) as MonitoringEventStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Inspektor</label>
          <select
            value={inspectorFilter}
            onChange={(e) => setInspectorFilter(e.target.value)}
            className="rounded-lg border border-slate-200 py-2 px-3 text-sm text-slate-800 focus:ring-2 focus:ring-forest-500/40 focus:border-forest-500 min-w-[180px]"
          >
            <option value="">Barchasi</option>
            {MOCK_INSPECTORS_LIST.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => {
            setDateFrom('');
            setDateTo('');
            setStatusFilter('');
            setInspectorFilter('');
          }}
          className="py-2 px-4 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50"
        >
          Tozalash
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80">
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Sana</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Hodisa turi</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Hudud / Maydon</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Xavflilik</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Biriktirilgan inspektor</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Holat</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Harakatlar</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    Filtrga mos hodisalar topilmadi.
                  </td>
                </tr>
              ) : (
                filtered.map((ev) => (
                  <tr key={ev.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="py-3 px-4 text-slate-800 whitespace-nowrap">{formatDate(ev.date)}</td>
                    <td className="py-3 px-4 text-slate-800">{EVENT_TYPE_LABELS[ev.eventType]}</td>
                    <td className="py-3 px-4 text-slate-800">{ev.regionArea}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          ev.severity === 'high'
                            ? 'bg-red-100 text-red-800'
                            : ev.severity === 'medium'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {SEVERITY_LABELS[ev.severity]}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700">{ev.assignedInspector ?? '—'}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          ev.status === 'resolved'
                            ? 'bg-green-100 text-green-800'
                            : ev.status === 'in_progress'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {STATUS_LABELS[ev.status]}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        <Link
                          href={`/dashboard/map?event=${ev.id}`}
                          className="inline-flex items-center gap-1 py-1.5 px-2.5 rounded-lg bg-forest-100 text-forest-800 text-xs font-medium hover:bg-forest-200"
                        >
                          Xaritada ko&apos;rish
                        </Link>
                        <button
                          type="button"
                          onClick={() => setAssignModal(ev)}
                          className="inline-flex items-center gap-1 py-1.5 px-2.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200"
                        >
                          Inspektor biriktirish
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatusModal(ev)}
                          className="inline-flex items-center gap-1 py-1.5 px-2.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200"
                        >
                          Holatni o&apos;zgartirish
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign inspector modal */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setAssignModal(null)}>
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Inspektor biriktirish</h3>
            <p className="text-sm text-slate-600 mb-4">{EVENT_TYPE_LABELS[assignModal.eventType]} — {assignModal.regionArea}</p>
            <select
              className="w-full rounded-lg border border-slate-200 py-2 px-3 text-sm text-slate-800 focus:ring-2 focus:ring-forest-500/40 mb-4"
              value={assignModal.assignedInspector ?? ''}
              onChange={(e) => {
                const next = { ...assignModal, assignedInspector: e.target.value || null };
                setAssignModal(next);
              }}
            >
              <option value="">Tanlanmagan</option>
              {MOCK_INSPECTORS_LIST.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setAssignModal(null)}
                className="py-2 px-4 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={() => handleAssignInspector(assignModal.id, assignModal.assignedInspector ?? '')}
                className="py-2 px-4 rounded-lg bg-forest-600 text-white text-sm font-medium hover:bg-forest-700"
              >
                Saqlash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change status modal */}
      {statusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setStatusModal(null)}>
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Holatni o&apos;zgartirish</h3>
            <p className="text-sm text-slate-600 mb-4">{EVENT_TYPE_LABELS[statusModal.eventType]} — {statusModal.regionArea}</p>
            <div className="space-y-2 mb-4">
              {(Object.keys(STATUS_LABELS) as MonitoringEventStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleChangeStatus(statusModal.id, s)}
                  className={`block w-full text-left py-2 px-3 rounded-lg border text-sm font-medium ${
                    statusModal.status === s
                      ? 'border-forest-500 bg-forest-50 text-forest-800'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setStatusModal(null)}
                className="py-2 px-4 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
