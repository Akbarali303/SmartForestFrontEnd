'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';

const TABS = [
  { id: 'login', label: 'Login' },
  { id: 'mobile-id', label: 'Mobile-ID' },
  { id: 'eri', label: 'ERI' },
  { id: 'qr', label: 'QR-kod' },
] as const;

/** Navbardagi bilan bir xil — globus ikoni (til tanlash) */
function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'mobile-id' | 'eri' | 'qr'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, router]);

  if (isAuthenticated) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const ok = login(username.trim(), password);
    setLoading(false);
    if (ok) {
      router.replace('/dashboard');
    } else {
      setError('Foydalanuvchi nomi yoki parol noto‘g‘ri. Namuna: admin / admin123');
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative pt-20 pb-8 px-6 overflow-hidden">
      {/* Orqa fon: rasm o‘ng tepadan chap pastga sekin harakatlanadi */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden>
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat animate-login-bg-drift-tr-to-bl"
          style={{ backgroundImage: "url('/Login-page.jpg')" }}
        />
        <div className="absolute inset-0 bg-white/40" aria-hidden />
      </div>

      {/* Chap tepa: logo va yozuv — ramkasiz, kattalashtirilgan */}
      <div className="absolute left-6 top-6 z-10 flex items-center gap-3">
        <div className="relative w-24 h-24 md:w-28 md:h-28 rounded-xl overflow-hidden flex-shrink-0">
          <Image src="/22.png" alt="Smart Forest" fill sizes="112px" className="object-cover" priority />
        </div>
        <div className="flex flex-col min-w-0">
          <h2 className="text-xl md:text-2xl font-bold text-slate-800 tracking-wide uppercase leading-tight">
            Smart Forest
          </h2>
          <p className="mt-1.5 text-xs md:text-sm text-slate-500 tracking-wide uppercase">Milliy o&apos;rmon monitoring platformasi</p>
        </div>
      </div>

      {/* O‘ng tepa: Yordam, til */}
      <div className="absolute right-6 top-6 z-10 flex items-center gap-2 flex-wrap justify-end">
        <button
          type="button"
          className="flex items-center gap-2 py-2.5 px-3.5 rounded-xl border border-slate-200 bg-white/90 text-slate-700 text-sm font-medium hover:bg-slate-50 transition shadow-sm"
        >
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Yordam</span>
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setLangOpen((o) => !o)}
            className="flex items-center gap-2 py-2.5 px-3.5 rounded-xl border border-slate-200 bg-white/90 text-slate-700 text-sm font-medium hover:bg-slate-50 transition shadow-sm"
          >
            <GlobeIcon className="w-5 h-5 text-slate-500" />
            <span>O&apos;zbekcha</span>
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {langOpen && (
            <>
              <div className="absolute right-0 top-full mt-1 py-1 w-40 rounded-lg border border-slate-200 bg-white shadow-lg z-10">
                <button type="button" className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-t">O&apos;zbekcha</button>
                <button type="button" className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Русский</button>
                <button type="button" className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-b">English</button>
              </div>
              <div className="fixed inset-0 z-0" aria-hidden onClick={() => setLangOpen(false)} />
            </>
          )}
        </div>
      </div>

      {/* Markaz: login forma va kartalar */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full max-w-md mx-auto -mt-36">
      <h1 className="text-slate-700 text-lg font-medium mb-6">Tizimga yo&apos;naltirish</h1>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
        {/* Tablar — ichki kartada */}
        <div className="pt-8 px-4 pb-0">
          <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex">
              {TABS.map((tab, i) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-3 text-sm font-medium transition ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-800'
                      : 'text-slate-500 bg-transparent hover:bg-white hover:text-slate-700'
                  } ${i === 0 ? 'rounded-l-xl' : ''} ${i === TABS.length - 1 ? 'rounded-r-xl' : ''}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 pt-8">
          {activeTab === 'login' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div
                  role="alert"
                  className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3"
                >
                  {error}
                </div>
              )}
              <div>
                <label htmlFor="login" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Login
                </label>
                <div className="relative">
                  <input
                    id="login"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Ohangfin592"
                    autoComplete="username"
                    className="w-full px-4 py-2.5 pr-10 rounded-lg border border-slate-300 bg-white text-slate-800 placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    required
                  />
                  {username.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setUsername('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                      aria-label="Tozalash"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Parol
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full px-4 py-2.5 pr-10 rounded-lg border border-slate-300 bg-white text-slate-800 placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                    aria-label={showPassword ? 'Parolni yashirish' : "Parolni ko'rsatish"}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <div className="flex justify-end">
                <button type="button" className="text-sm text-blue-600 hover:underline">
                  Login yoki parol yodingizdan chiqdimi?
                </button>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-medium transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Kirish...' : 'Kirish'}
              </button>
              <p className="text-center text-sm text-slate-600">
                Tizimda akkauntingiz yo&apos;qmi?{' '}
                <a href="#" className="text-blue-600 underline hover:no-underline">
                  Ro&apos;yxatdan o&apos;ting
                </a>
              </p>
            </form>
          )}
          {activeTab !== 'login' && (
            <div className="py-8 text-center text-slate-500 text-sm">
              {activeTab === 'mobile-id' && "Mobile-ID orqali kirish tez orada qo'shiladi."}
              {activeTab === 'eri' && "ERI orqali kirish tez orada qo'shiladi."}
              {activeTab === 'qr' && "QR-kod orqali kirish tez orada qo'shiladi."}
            </div>
          )}
        </div>

        <p className="px-6 pb-6 pt-1 text-center text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
          * Tizimga kirish orqali siz shaxsiy ma&apos;lumotlaringizni ushbu tizimga uzatishga rozilik bildirasiz.
        </p>
      </div>
      </div>

      {/* Pastki markaz: telefon, brend, developer */}
      <footer className="absolute bottom-0 left-0 right-0 z-10 py-5 flex flex-col items-center justify-center text-center gap-0.5">
        <a href="tel:+998915855533" className="text-sm text-white font-medium hover:text-slate-200 drop-shadow-md">
          +998 91 585-55-33
        </a>
        <p className="text-sm text-white/95 drop-shadow-md">FORESTDIGITAL © 2026.</p>
        <p className="text-xs text-white/80 drop-shadow-md">Akbarali tomonidan yaratilgan</p>
      </footer>
    </div>
  );
}
