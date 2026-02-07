'use client';

import { useState, useMemo, useCallback } from 'react';
import { useUnattendedAreas } from '@/contexts/UnattendedAreasContext';
import { exportReportToExcel, exportReportToPdf, type ReportData } from '@/lib/reportExport';

const MOCK_DAILY_STATS = {
  totalEventsToday: 12,
  resolvedEventsToday: 5,
  activeEventsToday: 7,
  patrolsCompletedToday: 3,
};

export default function ReportsPage() {
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const { unattendedCount } = useUnattendedAreas();

  const reportData: ReportData = useMemo(
    () => ({
      date: new Date().toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      totalEvents: MOCK_DAILY_STATS.totalEventsToday,
      resolvedEvents: MOCK_DAILY_STATS.resolvedEventsToday,
      activeEvents: MOCK_DAILY_STATS.activeEventsToday,
      patrolsCompleted: MOCK_DAILY_STATS.patrolsCompletedToday,
      unattendedAreas: unattendedCount,
    }),
    [unattendedCount]
  );

  const handleExportPdf = useCallback(() => {
    setExportDropdownOpen(false);
    exportReportToPdf(reportData).catch((err) => alert(err instanceof Error ? err.message : 'PDF yuklab olish amalga oshmadi.'));
  }, [reportData]);

  const handleExportExcel = useCallback(() => {
    setExportDropdownOpen(false);
    exportReportToExcel(reportData);
  }, [reportData]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Hisobotlar</h1>
          <p className="text-slate-500 mt-1 text-sm">Hisobotlar va eksport (mock)</p>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setExportDropdownOpen((o) => !o)}
            className="inline-flex items-center gap-2 py-2 px-4 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-forest-500/40"
          >
            Hisobotni yuklab olish
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {exportDropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" aria-hidden onClick={() => setExportDropdownOpen(false)} />
              <div className="absolute right-0 top-full mt-1 py-1 w-40 bg-white rounded-lg shadow-lg border border-slate-200 z-20">
                <button
                  type="button"
                  onClick={handleExportPdf}
                  className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  PDF
                </button>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Excel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
