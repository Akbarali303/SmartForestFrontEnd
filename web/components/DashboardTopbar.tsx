'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

type EventItem = {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  severity: string;
  createdAt: string;
};

const SEVERITY_LABEL: Record<string, string> = {
  critical: 'Kritik',
  high: 'Yuqori',
  medium: "O'rta",
  low: 'Past',
};

function formatEventTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Hozir';
    if (diffMin < 60) return `${diffMin} min oldin`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH} soat oldin`;
    return d.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}
/** Globus — til / dunyo tanlash uchun tushunarli ikon */
function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  );
}

const LANGUAGES = [
  { code: 'uz', label: "O'zbek" },
  { code: 'en', label: 'Inglizcha' },
  { code: 'ru', label: 'Ruscha' },
];

const DISPLAY_NAMES: Record<string, string> = {
  admin: 'A.Turdiyev',
};
function displayName(user: string | null): string {
  if (!user) return 'Boshqaruvchi';
  return DISPLAY_NAMES[user] ?? user;
}

export default function DashboardTopbar() {
  const { user } = useAuth();
  const [langOpen, setLangOpen] = useState(false);
  const [lang, setLang] = useState(LANGUAGES[0]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  useEffect(() => {
    if (!notifOpen) return;
    setEventsLoading(true);
    fetch('/api/v1/events')
      .then((r) => r.json())
      .then((data: EventItem[]) => {
        setEvents(Array.isArray(data) ? data : []);
      })
      .catch(() => setEvents([]))
      .finally(() => setEventsLoading(false));
  }, [notifOpen]);

  return (
    <header className="h-[var(--topbar-height)] flex items-center justify-end px-6 bg-white border-b border-slate-200 shrink-0">
      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setLangOpen((o) => !o)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 text-slate-600 transition"
          >
            <GlobeIcon className="w-5 h-5" />
            <span className="text-sm font-medium hidden sm:inline">{lang.label}</span>
          </button>
          {langOpen && (
            <>
              <div className="fixed inset-0 z-10" aria-hidden onClick={() => setLangOpen(false)} />
              <div className="absolute right-0 top-full mt-1 py-1 w-40 bg-white rounded-lg shadow-lg border border-slate-200 z-20">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => {
                      setLang(l);
                      setLangOpen(false);
                    }}
                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${l.code === lang.code ? 'text-forest-600 font-medium' : 'text-slate-700'}`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setNotifOpen((o) => !o)}
            className={`p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition relative ${events.length > 0 ? 'animate-pulse' : ''}`}
            aria-label="Bildirishnomalar — hodisalar"
            aria-expanded={notifOpen}
          >
            <BellIcon className={`w-5 h-5 ${events.length > 0 ? 'text-forest-600' : ''}`} />
            {events.length > 0 && (
              <>
                <span className="absolute top-1.5 right-1.5 flex h-2 w-2" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                </span>
              </>
            )}
          </button>
          {notifOpen && (
            <>
              <div className="fixed inset-0 z-10" aria-hidden onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-80 max-h-[min(24rem,70vh)] bg-white rounded-xl shadow-lg border border-slate-200 z-20 flex flex-col">
                <div className="px-4 py-3 border-b border-slate-100">
                  <h2 className="text-sm font-semibold text-slate-800">Hodisalar</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Barcha aniqlangan hodisalar</p>
                </div>
                <div className="overflow-y-auto flex-1 min-h-0">
                  {eventsLoading ? (
                    <div className="p-6 text-center text-sm text-slate-500">Yuklanmoqda...</div>
                  ) : events.length === 0 ? (
                    <div className="p-6 text-center text-sm text-slate-500">Hodisalar yo‘q</div>
                  ) : (
                    <ul className="py-1">
                      {events.map((e) => (
                        <li key={e.id} className="px-4 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{e.title}</p>
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <span
                              className={`inline-flex text-xs font-medium px-1.5 py-0.5 rounded ${
                                e.severity === 'critical'
                                  ? 'bg-red-100 text-red-700'
                                  : e.severity === 'high'
                                    ? 'bg-amber-100 text-amber-700'
                                    : e.severity === 'medium'
                                      ? 'bg-slate-100 text-slate-600'
                                      : 'bg-slate-50 text-slate-500'
                              }`}
                            >
                              {SEVERITY_LABEL[e.severity] ?? e.severity}
                            </span>
                            <span className="text-xs text-slate-400 shrink-0">{formatEventTime(e.createdAt)}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
          <div className="w-9 h-9 rounded-full bg-forest-100 text-forest-700 flex items-center justify-center font-semibold text-sm">
            {displayName(user).charAt(0).toUpperCase()}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-slate-800">{displayName(user)}</p>
            <p className="text-xs text-slate-500">Tizim boshqaruvchisi</p>
          </div>
        </div>
      </div>
    </header>
  );
}
