'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'smart-forest-saved-cameras';

const VILOYATLAR = [
  'Andijon', 'Buxoro', "Farg'ona", 'Jizzax', 'Namangan', 'Navoiy', 'Qashqadaryo',
  "Qoraqalpog'iston", 'Samarqand', 'Sirdaryo', 'Surxondaryo', 'Toshkent viloyati',
  'Toshkent shahri', 'Xorazm',
];

export interface SavedCamera {
  id: string;
  name: string;
  streamUrl: string;
  latitude: number;
  longitude: number;
  region?: string;
}

function loadCameras(): SavedCamera[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCameras(cameras: SavedCamera[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cameras));
  } catch {}
}

export default function CamerasPage() {
  const [cameras, setCameras] = useState<SavedCamera[]>([]);
  const [filterRegion, setFilterRegion] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    streamUrl: '/streams/cam1.m3u8',
    latitude: '',
    longitude: '',
    region: '',
  });

  const refresh = useCallback(() => setCameras(loadCameras()), []);
  useEffect(() => { refresh(); }, [refresh]);

  const handleSave = () => {
    const name = form.name.trim();
    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    if (!name || isNaN(lat) || isNaN(lng)) return;
    const list = loadCameras();
    const newCam: SavedCamera = {
      id: 'saved-' + Date.now(),
      name,
      streamUrl: form.streamUrl.trim() || '/streams/cam1.m3u8',
      latitude: lat,
      longitude: lng,
      region: form.region.trim() || undefined,
    };
    list.push(newCam);
    saveCameras(list);
    setCameras(list);
    setModalOpen(false);
    setForm({ name: '', streamUrl: '/streams/cam1.m3u8', latitude: '', longitude: '', region: '' });
  };

  const filteredCameras = filterRegion
    ? cameras.filter((c) => (c.region || '') === filterRegion)
    : cameras;

  const handleDelete = (id: string) => {
    const list = loadCameras().filter((c) => c.id !== id);
    saveCameras(list);
    setCameras(list);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Kamerlar</h1>
          <p className="text-slate-500 mt-1 text-sm">Kamerlar boshqaruvi — xaritada marker sifatida ko‘rinadi</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <select
              id="filter-region"
              value={filterRegion}
              onChange={(e) => setFilterRegion(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-8 text-sm text-slate-800 placeholder:text-slate-400 focus:border-forest-500 focus:ring-1 focus:ring-forest-500/20 outline-none transition min-w-[11rem] appearance-none cursor-pointer bg-no-repeat bg-[length:1rem] bg-[right_0.5rem_center]"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
              }}
            >
              <option value="">Viloyatni tanlang</option>
              {VILOYATLAR.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            {filterRegion && (
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                {filteredCameras.length} ta
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl shadow-sm hover:shadow transition focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Kamera qo'shish
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-700">Nomi</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Viloyat</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Kenglik</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Uzunlik</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Oqim URL</th>
              <th className="px-4 py-3 font-semibold text-slate-700 w-28">Amallar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredCameras.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  {filterRegion ? `${filterRegion} viloyatida kamera topilmadi.` : 'Hali kamera qo‘shilmagan. "Kamera qo‘shish" tugmasini bosing.'}
                </td>
              </tr>
            ) : (
              filteredCameras.map((cam) => (
                <tr key={cam.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-800">{cam.name}</td>
                  <td className="px-4 py-3 text-slate-600">{cam.region || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{cam.latitude.toFixed(5)}</td>
                  <td className="px-4 py-3 text-slate-600">{cam.longitude.toFixed(5)}</td>
                  <td className="px-4 py-3 text-slate-600 truncate max-w-[200px]" title={cam.streamUrl}>
                    {cam.streamUrl}
                  </td>
                  <td className="px-4 py-3 flex items-center gap-2">
                    <Link
                      href={`/dashboard/cameras/live?stream=${encodeURIComponent(cam.streamUrl)}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      Live
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(cam.id)}
                      className="text-red-600 hover:text-red-700 font-medium text-xs"
                    >
                      O‘chirish
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-800">Yangi kamera</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kamera nomi</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Masalan: Toshkent Shimol"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Viloyat</label>
                <select
                  value={form.region}
                  onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                >
                  <option value="">Viloyatni tanlang</option>
                  {VILOYATLAR.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Oqim URL</label>
                <input
                  type="text"
                  value={form.streamUrl}
                  onChange={(e) => setForm((f) => ({ ...f, streamUrl: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="/streams/cam1.m3u8"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kenglik (latitude)</label>
                <input
                  type="text"
                  value={form.latitude}
                  onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="41.31"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Uzunlik (longitude)</label>
                <input
                  type="text"
                  value={form.longitude}
                  onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="69.28"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  setForm({ name: '', streamUrl: '/streams/cam1.m3u8', latitude: '', longitude: '', region: '' });
                }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition"
              >
                Saqlash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
