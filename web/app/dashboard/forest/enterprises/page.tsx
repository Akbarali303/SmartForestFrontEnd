'use client';

import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';

type ForestArea = {
  id: string;
  region_name?: string;
  name?: string;
  type?: string;
  area_ha?: number;
  responsible?: string;
  created_at?: string;
  organization?: string;
  inn?: string;
  lng?: number;
  lat?: number;
};

function formatDate(s: string | undefined): string {
  if (!s) return '—';
  try {
    const d = new Date(s);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '—';
  }
}

export default function ForestEnterprisesPage() {
  const [areas, setAreas] = useState<ForestArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ForestArea>>({});
  const [searchQuery, setSearchQuery] = useState('');

  const loadAreas = () => {
    fetch('/api/v1/forest-areas')
      .then((r) => r.json())
      .then((data: ForestArea[]) => {
        setAreas(Array.isArray(data) ? data : []);
      })
      .catch(() => setAreas([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    loadAreas();
  }, []);

  const startEdit = (a: ForestArea) => {
    setEditingId(a.id);
    setEditForm({
      name: a.name ?? '',
      region_name: a.region_name ?? '',
      type: a.type ?? '',
      area_ha: a.area_ha,
      responsible: a.responsible ?? '',
      organization: a.organization ?? '',
      inn: a.inn ?? '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      await fetch(`/api/v1/forest-areas/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      setEditingId(null);
      setEditForm({});
      loadAreas();
    } catch {
      // xato
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Ushbu qatorni o\'chirishni xohlaysizmi?')) return;
    try {
      await fetch(`/api/v1/forest-areas/${id}`, { method: 'DELETE' });
      loadAreas();
    } catch {}
  };

  const coordsStr = (a: ForestArea) => {
    if (a.lat != null && a.lng != null) return `${Number(a.lat).toFixed(4)}, ${Number(a.lng).toFixed(4)}`;
    return '—';
  };

  const filterAreas = (list: ForestArea[], q: string): ForestArea[] => {
    const qq = (q || '').trim().toLowerCase();
    if (!qq) return list;
    return list.filter((a) => {
      const name = (a.name ?? '').toLowerCase();
      const region = (a.region_name ?? '').toLowerCase();
      const type = (a.type ?? '').toLowerCase();
      const responsible = (a.responsible ?? '').toLowerCase();
      const org = (a.organization ?? '').toLowerCase();
      const inn = (a.inn ?? '').toLowerCase();
      const dateStr = formatDate(a.created_at).toLowerCase();
      const areaStr = a.area_ha != null ? String(a.area_ha) : '';
      const coords = coordsStr(a).toLowerCase();
      return (
        name.includes(qq) ||
        region.includes(qq) ||
        type.includes(qq) ||
        responsible.includes(qq) ||
        org.includes(qq) ||
        inn.includes(qq) ||
        dateStr.includes(qq) ||
        areaStr.includes(qq) ||
        coords.includes(qq)
      );
    });
  };

  const filteredAreas = filterAreas(areas, searchQuery);

  const downloadExcel = () => {
    const headers = ['Nomi', 'Viloyat', 'Turi', 'Maydon (ga)', "Mas'ul", 'Yaratilgan sana', 'Tashkilot', 'INN', 'Koordinatalari'];
    const rows = filteredAreas.map((a) => [
      a.name ?? '',
      a.region_name ?? '',
      a.type ?? '',
      a.area_ha != null ? Number(a.area_ha) : '',
      a.responsible ?? '',
      formatDate(a.created_at),
      a.organization ?? '',
      a.inn ?? '',
      coordsStr(a),
    ]);
    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ormon xojaliklari');
    const fileName = `ormon_xojaliklari_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">O&apos;rmon xo&apos;jaliklari</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Saqlangan o&apos;rmon xo&apos;jaliklari — tahrirlash, o&apos;chirish va saqlash
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="flex flex-col gap-0.5">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder=""
                aria-label="Qidirish"
                className="w-44 rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 outline-none transition"
              />
            </div>
            {searchQuery.trim() && (
              <span className="text-xs text-slate-500">
                Topildi: {filteredAreas.length} ta {areas.length !== filteredAreas.length && `(jami ${areas.length} ta)`}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={downloadExcel}
            disabled={loading || filteredAreas.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-forest-600 text-white text-sm font-medium hover:bg-forest-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Excelga yuklab olish
          </button>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Yuklanmoqda...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Nomi</th>
                  <th className="px-4 py-3">Viloyat</th>
                  <th className="px-4 py-3">Turi</th>
                  <th className="px-4 py-3">Maydon (ga)</th>
                  <th className="px-4 py-3">Mas&apos;ul</th>
                  <th className="px-4 py-3">Yaratilgan sana</th>
                  <th className="px-4 py-3">Tashkilot</th>
                  <th className="px-4 py-3">INN</th>
                  <th className="px-4 py-3">Koordinatalari</th>
                  <th className="px-4 py-3 text-center">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAreas.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                      {areas.length === 0
                        ? "Hozircha saqlangan o'rmon xo'jaliklari yo'q. \"Hudud qo'shish\" orqali kontur saqlang."
                        : 'Qidiruv bo\'yicha hech narsa topilmadi. Boshqa so\'z yozib ko\'ring.'}
                    </td>
                  </tr>
                ) : (
                filteredAreas.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/50">
                    {editingId === a.id ? (
                      <>
                        <td className="px-4 py-2">
                          <input
                            value={editForm.name ?? ''}
                            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                            className="w-full rounded border border-slate-200 px-2 py-1 text-slate-800"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            value={editForm.region_name ?? ''}
                            onChange={(e) => setEditForm((f) => ({ ...f, region_name: e.target.value }))}
                            className="w-full rounded border border-slate-200 px-2 py-1 text-slate-800"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            value={editForm.type ?? ''}
                            onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value }))}
                            className="w-full rounded border border-slate-200 px-2 py-1 text-slate-800"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            value={editForm.area_ha ?? ''}
                            onChange={(e) => setEditForm((f) => ({ ...f, area_ha: e.target.value ? Number(e.target.value) : undefined }))}
                            className="w-full rounded border border-slate-200 px-2 py-1 text-slate-800"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            value={editForm.responsible ?? ''}
                            onChange={(e) => setEditForm((f) => ({ ...f, responsible: e.target.value }))}
                            className="w-full rounded border border-slate-200 px-2 py-1 text-slate-800"
                          />
                        </td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(a.created_at)}</td>
                        <td className="px-4 py-2">
                          <input
                            value={editForm.organization ?? ''}
                            onChange={(e) => setEditForm((f) => ({ ...f, organization: e.target.value }))}
                            className="w-full rounded border border-slate-200 px-2 py-1 text-slate-800"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            value={editForm.inn ?? ''}
                            onChange={(e) => setEditForm((f) => ({ ...f, inn: e.target.value }))}
                            className="w-full rounded border border-slate-200 px-2 py-1 text-slate-800"
                          />
                        </td>
                        <td className="px-4 py-3 text-slate-600">{coordsStr(a)}</td>
                        <td className="px-4 py-2">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={saveEdit}
                              className="px-2 py-1 rounded bg-forest-600 text-white text-xs font-medium hover:bg-forest-700"
                            >
                              Saqlash
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="px-2 py-1 rounded border border-slate-200 text-slate-600 text-xs hover:bg-slate-100"
                            >
                              Bekor
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 font-medium text-slate-800">{a.name ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{a.region_name ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{a.type ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{a.area_ha != null ? Number(a.area_ha).toLocaleString('uz') : '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{a.responsible ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(a.created_at)}</td>
                        <td className="px-4 py-3 text-slate-600">{a.organization ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{a.inn ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-600 font-mono text-xs">{coordsStr(a)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => startEdit(a)}
                              className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200"
                              title="Tahrirlash"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(a.id)}
                              className="px-2 py-1 rounded bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100"
                              title="O'chirish"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
