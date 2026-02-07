'use client';

import { useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForestAreas, getContractExpirationStatus, type EffectiveAreaStatus } from '@/contexts/ForestAreasContext';
import { useContracts, type Contract, type PaymentStatus } from '@/contexts/ContractsContext';

const PAYMENT_OPTIONS: { value: PaymentStatus; label: string }[] = [
  { value: 'paid', label: "To'langan" },
  { value: 'overdue', label: 'Kechikkan' },
  { value: 'pending', label: 'Kutilmoqda' },
];

function formatDate(s: string): string {
  try {
    const d = new Date(s);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '—';
  }
}

const EXPIRATION_LABELS: Record<EffectiveAreaStatus, string> = {
  expired: 'Muddati tugagan',
  expiring_soon: 'Tugashiga yaqin',
  leased: 'Ijarada',
  empty: "Bo'sh",
};

function PaymentBadge({ status }: { status: PaymentStatus }) {
  const config = {
    paid: { label: "To'langan", className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    overdue: { label: 'Kechikkan', className: 'bg-red-100 text-red-700 border-red-200' },
    pending: { label: 'Kutilmoqda', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  };
  const { label, className } = config[status];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

function ExpirationBadge({ endDate }: { endDate: string }) {
  const status = getContractExpirationStatus(endDate);
  const label = EXPIRATION_LABELS[status];
  const config = {
    expired: 'bg-red-100 text-red-700 border-red-200',
    expiring_soon: 'bg-amber-100 text-amber-700 border-amber-200',
    leased: 'bg-forest-100 text-forest-700 border-forest-200',
    empty: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${config[status]}`}>
      {label}
    </span>
  );
}

const emptyForm = {
  hudud: '',
  ijarachi: '',
  telefon: '',
  shartnomaRaqami: '',
  maydon: '',
  boshlanishSanasi: '',
  tugashSanasi: '',
  tolovHolati: 'pending' as PaymentStatus,
};

export default function ContractsPage() {
  const searchParams = useSearchParams();
  const filterExpiring = searchParams.get('filter') === 'expiring_soon';
  const { emptyAreas, setAreaStatus } = useForestAreas();
  const { contracts, setContracts } = useContracts();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const displayedContracts = useMemo(() => {
    if (!filterExpiring) return contracts;
    return contracts.filter((c) => getContractExpirationStatus(c.tugashSanasi) === 'expiring_soon');
  }, [contracts, filterExpiring]);

  const openCreateModal = () => {
    setForm(emptyForm);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setForm(emptyForm);
  };

  const handleSave = () => {
    const hudud = form.hudud.trim();
    const ijarachi = form.ijarachi.trim();
    const shartnomaRaqami = form.shartnomaRaqami.trim();
    const maydonNum = form.maydon ? Number(form.maydon) : 0;
    if (!hudud || !ijarachi || !shartnomaRaqami || maydonNum <= 0) {
      alert("Hudud, Ijarachi nomi, Shartnoma raqami va Maydon (0 dan katta) to'ldirilishi shart.");
      return;
    }
    const newId = String(Date.now());
    const newContract: Contract = {
      id: newId,
      hudud,
      ijarachi,
      telefon: form.telefon.trim() || undefined,
      maydon: maydonNum,
      shartnomaRaqami,
      boshlanishSanasi: form.boshlanishSanasi || new Date().toISOString().slice(0, 10),
      tugashSanasi: form.tugashSanasi || new Date().toISOString().slice(0, 10),
      tolovHolati: form.tolovHolati,
    };
    setContracts((prev) => [newContract, ...prev]);
    setAreaStatus(hudud, 'leased', newId, newContract.tugashSanasi);
    closeModal();
  };

  const handleDelete = (c: Contract) => {
    if (confirm(`"${c.shartnomaRaqami}" shartnomasini o'chirishni xohlaysizmi?`)) {
      setContracts((prev) => prev.filter((x) => x.id !== c.id));
      setAreaStatus(c.hudud, 'empty');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Shartnomalar ro&apos;yxati</h1>
          <p className="text-slate-500 mt-1 text-sm">Shartnomalar — ijara shartnomalari ro&apos;yxati</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-forest-600 text-white text-sm font-medium hover:bg-forest-700 focus:outline-none focus:ring-2 focus:ring-forest-500 focus:ring-offset-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          + Yangi shartnoma
        </button>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {filterExpiring && (
          <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 text-amber-800 text-sm font-medium">
            Muddati 90 kundan kam qolgan shartnomalar
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Hudud</th>
                <th className="px-4 py-3">Ijarachi</th>
                <th className="px-4 py-3">Maydon</th>
                <th className="px-4 py-3">Shartnoma raqami</th>
                <th className="px-4 py-3">Tugash sanasi</th>
                <th className="px-4 py-3">Muddati</th>
                <th className="px-4 py-3">To&apos;lov holati</th>
                <th className="px-4 py-3 text-center">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedContracts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    {filterExpiring ? 'Muddati 90 kundan kam qolgan shartnomalar topilmadi.' : 'Shartnomalar yo\'q.'}
                  </td>
                </tr>
              ) : (
              displayedContracts.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-800">{c.hudud}</td>
                  <td className="px-4 py-3 text-slate-600">{c.ijarachi}</td>
                  <td className="px-4 py-3 text-slate-600">{c.maydon.toLocaleString('uz')} ga</td>
                  <td className="px-4 py-3 text-slate-600 font-mono">{c.shartnomaRaqami}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(c.tugashSanasi)}</td>
                  <td className="px-4 py-3">
                    <ExpirationBadge endDate={c.tugashSanasi} />
                  </td>
                  <td className="px-4 py-3">
                    <PaymentBadge status={c.tolovHolati} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1 flex-wrap">
                      <button
                        type="button"
                        className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200"
                        title="Ko'rish"
                      >
                        Ko&apos;rish
                      </button>
                      <button
                        type="button"
                        className="px-2 py-1 rounded bg-forest-50 text-forest-700 text-xs font-medium hover:bg-forest-100"
                        title="Tahrirlash"
                      >
                        Tahrirlash
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(c)}
                        className="px-2 py-1 rounded bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100"
                        title="O'chirish"
                      >
                        O&apos;chirish
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

      {/* Create Contract Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" onClick={closeModal}>
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Yangi shartnoma</h2>
              <button
                type="button"
                onClick={closeModal}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Yopish"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form
              className="p-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                handleSave();
              }}
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Hudud tanlash</label>
                <select
                  value={form.hudud}
                  onChange={(e) => setForm((f) => ({ ...f, hudud: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 outline-none"
                  required
                >
                  <option value="">Hududni tanlang (faqat bo&apos;sh yerlar)</option>
                  {emptyAreas.map((a) => (
                    <option key={a.id} value={a.name}>{a.name} — {a.maydon} ga</option>
                  ))}
                  {emptyAreas.length === 0 && (
                    <option value="" disabled>Bo&apos;sh yerlar yo&apos;q</option>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ijarachi nomi</label>
                <input
                  type="text"
                  value={form.ijarachi}
                  onChange={(e) => setForm((f) => ({ ...f, ijarachi: e.target.value }))}
                  placeholder="Tashkilot yoki F.I.O"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Telefon</label>
                <input
                  type="tel"
                  value={form.telefon}
                  onChange={(e) => setForm((f) => ({ ...f, telefon: e.target.value }))}
                  placeholder="+998 90 123 45 67"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Shartnoma raqami</label>
                <input
                  type="text"
                  value={form.shartnomaRaqami}
                  onChange={(e) => setForm((f) => ({ ...f, shartnomaRaqami: e.target.value }))}
                  placeholder="SH-2024-001"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Maydon (ga)</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={form.maydon}
                  onChange={(e) => setForm((f) => ({ ...f, maydon: e.target.value }))}
                  placeholder="0"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Boshlanish sanasi</label>
                <input
                  type="date"
                  value={form.boshlanishSanasi}
                  onChange={(e) => setForm((f) => ({ ...f, boshlanishSanasi: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tugash sanasi</label>
                <input
                  type="date"
                  value={form.tugashSanasi}
                  onChange={(e) => setForm((f) => ({ ...f, tugashSanasi: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">To&apos;lov holati</label>
                <select
                  value={form.tolovHolati}
                  onChange={(e) => setForm((f) => ({ ...f, tolovHolati: e.target.value as PaymentStatus }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 outline-none"
                >
                  {PAYMENT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-lg bg-forest-600 text-white text-sm font-medium hover:bg-forest-700 focus:outline-none focus:ring-2 focus:ring-forest-500 focus:ring-offset-2"
                >
                  Saqlash
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2"
                >
                  Bekor qilish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
