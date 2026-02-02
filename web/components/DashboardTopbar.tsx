'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}
function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}
function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0h.5a2.5 2.5 0 002.5-2.5V3.935M12 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

const LANGUAGES = [
  { code: 'uz', label: "O'zbek" },
  { code: 'en', label: 'Inglizcha' },
  { code: 'ru', label: 'Ruscha' },
];

export default function DashboardTopbar() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [langOpen, setLangOpen] = useState(false);
  const [lang, setLang] = useState(LANGUAGES[0]);

  return (
    <header className="h-[var(--topbar-height)] flex items-center justify-between px-6 bg-white border-b border-slate-200 shrink-0">
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="search"
            placeholder="Qidirish..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 outline-none transition text-sm"
          />
        </div>
      </div>
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
        <button
          type="button"
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition relative"
          aria-label="Bildirishnomalar"
        >
          <BellIcon className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>
        <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
          <div className="w-9 h-9 rounded-full bg-forest-100 text-forest-700 flex items-center justify-center font-semibold text-sm">
            {user ? user.charAt(0).toUpperCase() : 'A'}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-slate-800">{user || 'Boshqaruvchi'}</p>
            <p className="text-xs text-slate-500">Tizim boshqaruvchisi</p>
          </div>
        </div>
      </div>
    </header>
  );
}
