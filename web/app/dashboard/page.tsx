'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import StatCard from '@/components/StatCard';
import { useContracts } from '@/contexts/ContractsContext';
import { getContractExpirationStatus } from '@/contexts/ForestAreasContext';
import { useUnattendedAreas } from '@/contexts/UnattendedAreasContext';
import { MOCK_LEASE_PAYMENTS } from '@/lib/mockLeasePayments';

const OTHER_STATS = [
  { title: 'Faol kamerlar', value: '24', icon: CameraIcon },
  { title: 'Xavfli zonalar', value: '8', icon: AlertIcon },
  { title: 'Monitoring hududlari', value: '14', icon: MapIcon },
  { title: 'Aniqlangan hodisalar', value: '156', icon: EventIcon },
];

const DEMO_MONITORING = [
  { id: 1, region: 'Toshkent viloyati', status: 'Normal', time: '10:45' },
  { id: 2, region: 'Fargʻona viloyati', status: 'Ogohlantirish', time: '10:42' },
  { id: 3, region: 'Samarqand viloyati', status: 'Normal', time: '10:40' },
  { id: 4, region: 'Buxoro viloyati', status: 'Normal', time: '10:38' },
  { id: 5, region: 'Qashqadaryo viloyati', status: 'Normal', time: '10:35' },
];

const SEVERITY_LABEL: Record<string, string> = { high: 'Yuqori', medium: 'O‘rta', low: 'Past' };
const DEMO_EVENTS = [
  { id: 1, title: 'Daraxt tekshiruvi', severity: 'medium', time: '10:30' },
  { id: 2, title: 'Harorat oshishi', severity: 'low', time: '10:15' },
  { id: 3, title: 'Yongʻin xavfi', severity: 'high', time: '09:55' },
  { id: 4, title: 'Kamera o‘flayn', severity: 'medium', time: '09:40' },
];

const CAMERA_STATUS_LABEL: Record<string, string> = { online: 'Onlayn', offline: 'O‘flayn' };
const DEMO_CAMERAS = [
  { id: 1, name: 'Cam-01 Toshkent', status: 'online' },
  { id: 2, name: 'Cam-02 Fargʻona', status: 'online' },
  { id: 3, name: 'Cam-03 Samarqand', status: 'offline' },
  { id: 4, name: 'Cam-04 Buxoro', status: 'online' },
];

/** Mock: hal qilangan hodisalar va qaysi inspektor tomonidan (vaqtlar ISO). */
const MOCK_RESOLVED_BY_INSPECTOR: Array<{
  eventId: string;
  inspectorId: string;
  inspectorName: string;
  detectedAt: string;
  resolvedAt: string;
}> = [
  { eventId: 'ev1', inspectorId: 'insp1', inspectorName: 'Rustam Karimov', detectedAt: '2025-02-02T09:15:00', resolvedAt: '2025-02-02T14:00:00' },
  { eventId: 'ev4', inspectorId: 'insp3', inspectorName: 'Jasur Beknazarov', detectedAt: '2025-02-02T07:00:00', resolvedAt: '2025-02-02T12:00:00' },
  { eventId: 'ev6', inspectorId: 'insp4', inspectorName: 'Madina Yusupova', detectedAt: '2025-02-02T06:55:00', resolvedAt: '2025-02-02T11:00:00' },
  { eventId: 'ev2', inspectorId: 'insp2', inspectorName: 'Dilnoza Toshpulatova', detectedAt: '2025-02-02T08:42:00', resolvedAt: '2025-02-02T13:30:00' },
  { eventId: 'ev5', inspectorId: 'insp1', inspectorName: 'Rustam Karimov', detectedAt: '2025-02-01T18:30:00', resolvedAt: '2025-02-02T10:00:00' },
];

function resolutionTimeMs(detectedAt: string, resolvedAt: string): number {
  const d = new Date(detectedAt).getTime();
  const r = new Date(resolvedAt).getTime();
  if (isNaN(d) || isNaN(r)) return 0;
  return Math.max(0, r - d);
}

function formatResolutionTime(ms: number): string {
  if (ms <= 0) return '—';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0 && minutes > 0) return `${hours} soat ${minutes} min`;
  if (hours > 0) return `${hours} soat`;
  return `${minutes} min`;
}

function ForestIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}
function CameraIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}
function AlertIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}
function MapIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  );
}
function EventIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}
function LeaseLandIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
    </svg>
  );
}
function RevenueIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function DocumentIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

export default function DashboardPage() {
  const [forestAreaHa, setForestAreaHa] = useState<number | null>(null);
  const { contracts } = useContracts();
  const { unattendedCount } = useUnattendedAreas();

  const expirationCounts = useMemo(() => {
    let expiringSoon = 0;
    let expired = 0;
    contracts.forEach((c) => {
      const status = getContractExpirationStatus(c.tugashSanasi);
      if (status === 'expiring_soon') expiringSoon += 1;
      else if (status === 'expired') expired += 1;
    });
    return { expiringSoon, expired };
  }, [contracts]);

  const leaseRevenue = useMemo(() => {
    const monthly = contracts.reduce((sum, c) => sum + (c.monthlyAmount ?? 0), 0);
    return { monthly, yearly: monthly * 12 };
  }, [contracts]);

  /** Faol shartnomalardan kutilayotgan ijara daromadi (muddati o'tmagan) */
  const expectedLeaseRevenue = useMemo(() => {
    const active = contracts.filter((c) => getContractExpirationStatus(c.tugashSanasi) !== 'expired');
    const monthly = active.reduce((sum, c) => sum + (c.monthlyAmount ?? 0), 0);
    return { monthly, yearly: monthly * 12 };
  }, [contracts]);

  /** Ijara yer maydonlari (shartnomalar bo'yicha, ga) */
  const leasedAreaHa = useMemo(
    () => contracts.reduce((sum, c) => sum + (Number(c.maydon) || 0), 0),
    [contracts]
  );
  const leasedAreaValue = leasedAreaHa > 0 ? `${Number(leasedAreaHa).toLocaleString('uz')} ga` : '—';

  /** Faol shartnomalar (muddati tugamagan) — 4 kartacha uchun */
  const activeContractsStats = useMemo(() => {
    const active = contracts.filter((c) => getContractExpirationStatus(c.tugashSanasi) !== 'expired');
    const count = active.length;
    const areaHa = active.reduce((sum, c) => sum + (Number(c.maydon) || 0), 0);
    const monthly = active.reduce((sum, c) => sum + (c.monthlyAmount ?? 0), 0);
    return { count, areaHa, monthly, yearly: monthly * 12 };
  }, [contracts]);

  const debtStats = useMemo(() => {
    const withDebt = MOCK_LEASE_PAYMENTS.filter((r) => r.debtAmount > 0);
    const count = withDebt.length;
    const totalUnpaid = withDebt.reduce((sum, r) => sum + r.debtAmount, 0);
    return { count, totalUnpaid };
  }, []);

  const inspectorStats = useMemo(() => {
    const byInspector = new Map<
      string,
      { name: string; resolvedCount: number; totalResolutionMs: number }
    >();
    for (const row of MOCK_RESOLVED_BY_INSPECTOR) {
      const ms = resolutionTimeMs(row.detectedAt, row.resolvedAt);
      const existing = byInspector.get(row.inspectorId);
      if (existing) {
        existing.resolvedCount += 1;
        existing.totalResolutionMs += ms;
      } else {
        byInspector.set(row.inspectorId, {
          name: row.inspectorName,
          resolvedCount: 1,
          totalResolutionMs: ms,
        });
      }
    }
    return Array.from(byInspector.entries())
      .map(([id, data]) => ({
        inspectorId: id,
        name: data.name,
        resolvedCount: data.resolvedCount,
        avgResolutionMs: data.resolvedCount > 0 ? data.totalResolutionMs / data.resolvedCount : 0,
      }))
      .sort((a, b) => b.resolvedCount - a.resolvedCount);
  }, []);

  const formatRevenue = (n: number) =>
    n >= 1_000_000_000
      ? `${(n / 1_000_000_000).toFixed(1)} mlrd so'm`
      : n >= 1_000_000
        ? `${(n / 1_000_000).toFixed(1)} mln so'm`
        : `${n.toLocaleString('uz')} so'm`;

  useEffect(() => {
    fetch('/api/v1/forest-areas')
      .then((r) => r.json())
      .then((data: Array<{ area_ha?: number }>) => {
        if (!Array.isArray(data)) return;
        const total = data.reduce((sum, row) => sum + (Number(row.area_ha) || 0), 0);
        setForestAreaHa(total);
      })
      .catch(() => setForestAreaHa(0));
  }, []);

  const forestAreaValue =
    forestAreaHa === null
      ? '—'
      : `${Number(forestAreaHa).toLocaleString('uz')} ga`;

  const isServer = typeof window === 'undefined';

  return isServer ? (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="animate-pulse text-slate-500">Yuklanmoqda...</div>
    </div>
  ) : (
    <div className="space-y-8 pb-8">
      <header className="border-b border-slate-200/80 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">Boshqaruv paneli</h1>
            <p className="text-slate-500 mt-0.5 text-sm">Monitoring va statistika</p>
          </div>
          <span className="text-xs text-slate-400 font-medium tabular-nums">
            {new Date().toLocaleDateString('uz-UZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
      </header>

      <section aria-label="Asosiy ko‘rsatkichlar">
        <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-4">Asosiy ko‘rsatkichlar</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="O'rmon maydoni" value={forestAreaValue} icon={<ForestIcon />} subtitle="umumiy maydon" />
          <StatCard title="Ijara yer maydonlari" value={leasedAreaValue} icon={<LeaseLandIcon />} subtitle="ijara ostidagi maydon" />
          <StatCard title="Ijara daromadi" value={formatRevenue(leaseRevenue.yearly)} icon={<RevenueIcon />} subtitle={`Oylik: ${formatRevenue(leaseRevenue.monthly)}`} />
          <StatCard title="Kutilayotgan ijara daromadi" value={formatRevenue(expectedLeaseRevenue.yearly)} icon={<RevenueIcon />} subtitle={`Oylik: ${formatRevenue(expectedLeaseRevenue.monthly)}`} />
          <StatCard title="Faol kamerlar" value={OTHER_STATS[0].value} icon={<CameraIcon />} subtitle="ta" />
          <StatCard title="Xavfli zonalar" value={OTHER_STATS[1].value} icon={<AlertIcon />} subtitle="ta" />
          <StatCard title="Monitoring hududlari" value={OTHER_STATS[2].value} icon={<MapIcon />} subtitle="ta" />
          <StatCard title="Aniqlangan hodisalar" value={OTHER_STATS[3].value} icon={<EventIcon />} subtitle="ta" />
        </div>
      </section>

      {(activeContractsStats.count > 0 || unattendedCount > 0 || expirationCounts.expiringSoon > 0 || expirationCounts.expired > 0 || debtStats.count > 0) && (
        <section aria-label="Ogohlantirishlar">
          <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-4">Ogohlantirishlar</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {activeContractsStats.count > 0 && (
              <Link
                href="/dashboard/contracts"
                className="flex items-center gap-3 p-4 rounded-xl border border-forest-200/80 bg-forest-50/80 hover:bg-forest-50 transition-colors"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-forest-100 text-forest-700 border border-forest-200/60">
                  <DocumentIcon />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-forest-700/90">Faol shartnomalar</p>
                  <p className="mt-0.5 text-xl font-bold tabular-nums text-forest-800">5</p>
                  <p className="text-xs text-forest-600/90">ta shartnoma</p>
                </div>
              </Link>
            )}
            {debtStats.count > 0 && (
              <Link
                href="/dashboard/lease-payments"
                className="flex items-center gap-3 p-4 rounded-xl border border-red-200/80 bg-red-50/80 hover:bg-red-50 transition-colors"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700 border border-red-200/60">
                  <RevenueIcon />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-red-700/90">Qarzdor shartnomalar</p>
                  <p className="mt-0.5 text-xl font-bold tabular-nums text-red-800">{debtStats.count}</p>
                  <p className="text-xs text-red-600/90">To&apos;lanmagan: {formatRevenue(debtStats.totalUnpaid)}</p>
                </div>
              </Link>
            )}
            {expirationCounts.expired > 0 && (
              <Link
                href="/dashboard/contracts"
                className="flex items-center gap-3 p-4 rounded-xl border border-red-200/80 bg-red-50/80 hover:bg-red-50 transition-colors"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700 border border-red-200/60">
                  <DocumentIcon />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-red-700/90">Muddati tugagan</p>
                  <p className="mt-0.5 text-xl font-bold tabular-nums text-red-800">{expirationCounts.expired}</p>
                  <p className="text-xs text-red-600/90">Shartnomalar</p>
                </div>
              </Link>
            )}
            {expirationCounts.expiringSoon > 0 && (
              <Link
                href="/dashboard/contracts?filter=expiring_soon"
                className="flex items-center gap-3 p-4 rounded-xl border border-amber-200/80 bg-amber-50/80 hover:bg-amber-50 transition-colors"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 border border-amber-200/60">
                  <DocumentIcon />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-amber-700/90">Muddati tugayapti</p>
                  <p className="mt-0.5 text-xl font-bold tabular-nums text-amber-800">{expirationCounts.expiringSoon}</p>
                  <p className="text-xs text-amber-600/90">90 kundan kam · Shartnomalar</p>
                </div>
              </Link>
            )}
            {unattendedCount > 0 && (
              <Link
                href="/dashboard/map"
                className="flex items-center gap-3 p-4 rounded-xl border border-violet-200/80 bg-violet-50/80 hover:bg-violet-50 transition-colors"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700 border border-violet-200/60">
                  <MapIcon />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-violet-700/90">Nazoratsiz hududlar</p>
                  <p className="mt-0.5 text-xl font-bold tabular-nums text-violet-800">{unattendedCount}</p>
                  <p className="text-xs text-violet-600/90">Xaritada ko&apos;rish</p>
                </div>
              </Link>
            )}
          </div>
        </section>
      )}

      <section aria-label="Monitoring va hodisalar">
        <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-4">Monitoring va hodisalar</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-semibold text-slate-800">So‘nggi monitoring</h3>
              <p className="text-xs text-slate-500 mt-0.5">Viloyatlar bo‘yicha holat</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-600 text-left">
                    <th className="px-5 py-3 font-semibold">Viloyat</th>
                    <th className="px-5 py-3 font-semibold">Holat</th>
                    <th className="px-5 py-3 font-semibold">Vaqt</th>
                  </tr>
                </thead>
                <tbody>
                  {DEMO_MONITORING.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                      <td className="px-5 py-3 font-medium text-slate-800">{row.region}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium ${
                            row.status === 'Ogohlantirish'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200/60'
                              : 'bg-forest-100 text-forest-700 border border-forest-200/60'
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-500 tabular-nums">{row.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-semibold text-slate-800">Eventlar</h3>
              <p className="text-xs text-slate-500 mt-0.5">So‘nggi aniqlangan hodisalar</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-600 text-left">
                    <th className="px-5 py-3 font-semibold">Hodisa</th>
                    <th className="px-5 py-3 font-semibold">Daraja</th>
                    <th className="px-5 py-3 font-semibold">Vaqt</th>
                  </tr>
                </thead>
                <tbody>
                  {DEMO_EVENTS.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                      <td className="px-5 py-3 font-medium text-slate-800">{row.title}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium ${
                            row.severity === 'high'
                              ? 'bg-red-100 text-red-700 border border-red-200/60'
                              : row.severity === 'medium'
                              ? 'bg-amber-100 text-amber-700 border border-amber-200/60'
                              : 'bg-sky-100 text-sky-700 border border-sky-200/60'
                          }`}
                        >
                          {SEVERITY_LABEL[row.severity] ?? row.severity}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-500 tabular-nums">{row.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Kamera va inspektorlar">
        <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-4">Kamera va inspektorlar</h2>
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-semibold text-slate-800">Kamera holati</h3>
              <p className="text-xs text-slate-500 mt-0.5">Kamerlar ro‘yxati va holati</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-600 text-left">
                    <th className="px-5 py-3 font-semibold">ID</th>
                    <th className="px-5 py-3 font-semibold">Nomi</th>
                    <th className="px-5 py-3 font-semibold">Holat</th>
                  </tr>
                </thead>
                <tbody>
                  {DEMO_CAMERAS.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                      <td className="px-5 py-3 text-slate-500 tabular-nums">{row.id}</td>
                      <td className="px-5 py-3 font-medium text-slate-800">{row.name}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${
                            row.status === 'online'
                              ? 'bg-forest-100 text-forest-700 border border-forest-200/60'
                              : 'bg-red-100 text-red-700 border border-red-200/60'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              row.status === 'online' ? 'bg-forest-500' : 'bg-red-500'
                            }`}
                          />
                          {CAMERA_STATUS_LABEL[row.status] ?? row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-semibold text-slate-800">Eng faol inspektorlar</h3>
              <p className="text-xs text-slate-500 mt-0.5">Hal qilgan hodisalar va o‘rtacha yechilish vaqti</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-600 text-left">
                    <th className="px-5 py-3 font-semibold">Inspektor</th>
                    <th className="px-5 py-3 font-semibold">Hal qilgan hodisalar</th>
                    <th className="px-5 py-3 font-semibold">O‘rtacha yechilish vaqti</th>
                  </tr>
                </thead>
                <tbody>
                  {inspectorStats.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-5 py-8 text-center text-slate-500">
                        Ma’lumot yo‘q
                      </td>
                    </tr>
                  ) : (
                    inspectorStats.map((row) => (
                      <tr key={row.inspectorId} className="border-t border-slate-100 hover:bg-slate-50/70">
                        <td className="px-5 py-3 font-medium text-slate-800">{row.name}</td>
                        <td className="px-5 py-3 text-slate-700 tabular-nums">{row.resolvedCount}</td>
                        <td className="px-5 py-3 text-slate-600">
                          {formatResolutionTime(row.avgResolutionMs)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
