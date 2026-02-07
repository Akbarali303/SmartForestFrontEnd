'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMonitoringNotifications } from '@/contexts/MonitoringNotificationsContext';

function formatNotificationTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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
  const { notifications, unreadCount, openEventOnMap } = useMonitoringNotifications();
  const [langOpen, setLangOpen] = useState(false);
  const [lang, setLang] = useState(LANGUAGES[0]);
  const [notifOpen, setNotifOpen] = useState(false);

  const handleNotificationClick = (eventId: string) => {
    openEventOnMap(eventId);
    setNotifOpen(false);
  };

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
            className={`p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition relative ${unreadCount > 0 ? 'animate-pulse' : ''}`}
            aria-label="Bildirishnomalar — monitoring hodisalari"
            aria-expanded={notifOpen}
          >
            <BellIcon className={`w-5 h-5 ${unreadCount > 0 ? 'text-forest-600' : ''}`} />
            {unreadCount > 0 && (
              <>
                <span className="absolute top-1.5 right-1.5 flex h-2 w-2" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                </span>
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              </>
            )}
          </button>
          {notifOpen && (
            <>
              <div className="fixed inset-0 z-10" aria-hidden onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-80 max-h-[min(24rem,70vh)] bg-white rounded-xl shadow-lg border border-slate-200 z-20 flex flex-col">
                <div className="px-4 py-3 border-b border-slate-100">
                  <h2 className="text-sm font-semibold text-slate-800">Monitoring hodisalari</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Xaritada ko‘rish uchun bosing</p>
                </div>
                <div className="overflow-y-auto flex-1 min-h-0">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-sm text-slate-500">Bildirishnomalar yo‘q</div>
                  ) : (
                    <ul className="py-1">
                      {notifications.map((n) => (
                        <li key={n.id}>
                          <button
                            type="button"
                            onClick={() => handleNotificationClick(n.id)}
                            className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0 focus:outline-none focus:bg-slate-50"
                          >
                            <p className="text-sm font-medium text-slate-800">{n.eventType}</p>
                            <p className="text-xs text-slate-600 mt-0.5">{n.forestArea}</p>
                            <div className="flex items-center justify-between gap-2 mt-1">
                              <span className="text-xs text-slate-500">{formatNotificationTime(n.time)}</span>
                              <span className="text-xs text-slate-500 truncate max-w-[10rem]" title={n.assignedInspector}>
                                {n.assignedInspector}
                              </span>
                            </div>
                          </button>
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
