'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { MOCK_LEASE_PAYMENTS } from '@/lib/mockLeasePayments';

/** Lease-level status: Normal, Debt, or Risky debtor (≥3 unpaid months) */
export type LeaseStatus = 'normal' | 'debt' | 'risky_debtor';

export type MonthlyStatus = 'paid' | 'partial' | 'unpaid';

export type LeaseItem = {
  id: string;
  forestArea: string;
  tenant: string;
  yearlyPrice: number;
};

export type PaymentRecord = {
  id: string;
  leaseId: string;
  date: string;
  amount: number;
  comment: string;
};

/** One month row for a lease: required = yearly/12, paid = sum of payments in that month */
export type MonthlyPaymentRow = {
  month: string;
  monthLabel: string;
  required: number;
  paid: number;
  status: MonthlyStatus;
};

const LEASE_STATUS_LABELS: Record<LeaseStatus, string> = {
  normal: 'Normal',
  debt: 'Qarz',
  risky_debtor: 'Xavfli qarzdor',
};

const LEASE_STATUS_CLASS: Record<LeaseStatus, string> = {
  normal: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  debt: 'bg-amber-100 text-amber-700 border-amber-200',
  risky_debtor: 'bg-red-100 text-red-700 border-red-200',
};

const MONTHLY_STATUS_LABELS: Record<MonthlyStatus, string> = {
  paid: "To'langan",
  partial: 'Qisman',
  unpaid: "To'lanmagan",
};

const MONTHLY_STATUS_CLASS: Record<MonthlyStatus, string> = {
  paid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  partial: 'bg-amber-100 text-amber-700 border-amber-200',
  unpaid: 'bg-red-100 text-red-700 border-red-200',
};

const MONTH_NAMES_UZ = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];

function getMonthLabel(year: number, monthIndex: number): string {
  const yyyyMm = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  return `${yyyyMm} (${MONTH_NAMES_UZ[monthIndex]})`;
}

function getMonthlyStatus(required: number, paid: number): MonthlyStatus {
  if (paid >= required) return 'paid';
  if (paid <= 0) return 'unpaid';
  return 'partial';
}

const INITIAL_LEASES: LeaseItem[] = MOCK_LEASE_PAYMENTS.map((row) => ({
  id: row.id,
  forestArea: row.forestArea,
  tenant: row.tenant,
  yearlyPrice: row.leasePrice,
}));

/** Seed initial payments from mock paidAmount so table matches existing data */
function getInitialPayments(): PaymentRecord[] {
  const records: PaymentRecord[] = [];
  let paymentId = 1;
  for (const row of MOCK_LEASE_PAYMENTS) {
    if (row.paidAmount > 0) {
      records.push({
        id: `p-${paymentId++}`,
        leaseId: row.id,
        date: new Date().toISOString().slice(0, 10),
        amount: row.paidAmount,
        comment: "Dastlabki to'lov (mock)",
      });
    }
  }
  return records;
}

function formatSum(n: number): string {
  return `${n.toLocaleString('uz')} so'm`;
}

function formatDate(s: string): string {
  try {
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toLocaleDateString('uz-UZ');
  } catch {
    return s;
  }
}

/** Lease status: Risky debtor if ≥3 unpaid months, else Normal (fully paid) or Debt */
function getLeaseStatus(
  yearlyPrice: number,
  totalPaid: number,
  unpaidMonthsCount: number
): LeaseStatus {
  if (unpaidMonthsCount >= 3) return 'risky_debtor';
  if (totalPaid >= yearlyPrice) return 'normal';
  return 'debt';
}

export default function LeasePaymentsPage() {
  const [leases] = useState<LeaseItem[]>(INITIAL_LEASES);
  const [payments, setPayments] = useState<PaymentRecord[]>(getInitialPayments);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [modalLeaseId, setModalLeaseId] = useState<string | null>(null);
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formAmount, setFormAmount] = useState('');
  const [formComment, setFormComment] = useState('');

  const tableRows = useMemo(() => {
    return leases.map((lease) => {
      const leasePayments = payments.filter((p) => p.leaseId === lease.id);
      const totalPaid = leasePayments.reduce((sum, p) => sum + p.amount, 0);
      const debt = Math.max(0, lease.yearlyPrice - totalPaid);
      const requiredPerMonth = lease.yearlyPrice / 12;
      const monthlyRows: MonthlyPaymentRow[] = [];
      for (let m = 0; m < 12; m++) {
        const yyyyMm = `${selectedYear}-${String(m + 1).padStart(2, '0')}`;
        const paidThisMonth = leasePayments
          .filter((p) => p.date.slice(0, 7) === yyyyMm)
          .reduce((s, p) => s + p.amount, 0);
        monthlyRows.push({
          month: yyyyMm,
          monthLabel: getMonthLabel(selectedYear, m),
          required: requiredPerMonth,
          paid: paidThisMonth,
          status: getMonthlyStatus(requiredPerMonth, paidThisMonth),
        });
      }
      const unpaidMonthsCount = monthlyRows.filter((r) => r.status === 'unpaid').length;
      const status = getLeaseStatus(lease.yearlyPrice, totalPaid, unpaidMonthsCount);
      return {
        ...lease,
        totalPaid,
        debt,
        status,
        unpaidMonthsCount,
        paymentRecords: leasePayments,
        monthlyRows,
      };
    });
  }, [leases, payments, selectedYear]);

  const addPayment = useCallback(
    (leaseId: string) => {
      const amount = Number(formAmount.replace(/\s/g, '')) || 0;
      if (amount <= 0) return;
      setPayments((prev) => [
        ...prev,
        {
          id: `p-${Date.now()}`,
          leaseId,
          date: formDate,
          amount,
          comment: formComment.trim() || '—',
        },
      ]);
      setFormAmount('');
      setFormComment('');
      setFormDate(new Date().toISOString().slice(0, 10));
      setModalLeaseId(null);
    },
    [formDate, formAmount, formComment]
  );

  const openModal = useCallback((leaseId: string) => {
    setModalLeaseId(leaseId);
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormAmount('');
    setFormComment('');
  }, []);

  const modalLease = modalLeaseId ? tableRows.find((r) => r.id === modalLeaseId) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">To&apos;lov nazorati</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Ijara maydonlari bo&apos;yicha yillik narx, oylik to&apos;lovlar va qarzlar
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="lease-year" className="text-sm font-medium text-slate-600">Yil:</label>
          <select
            id="lease-year"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-forest-500/40 focus:border-forest-500"
          >
            {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() + i - 2).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">O&apos;rmon hududi</th>
                <th className="px-4 py-3">Ijarachi</th>
                <th className="px-4 py-3">Yillik ijara narxi</th>
                <th className="px-4 py-3">To&apos;langan summa</th>
                <th className="px-4 py-3">Qarz</th>
                <th className="px-4 py-3">To&apos;lanmagan oylar</th>
                <th className="px-4 py-3">Holat</th>
                <th className="px-4 py-3 w-32">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tableRows.map((row) => {
                const rowBg =
                  row.status === 'normal'
                    ? 'bg-emerald-50/40 hover:bg-emerald-50/60'
                    : row.status === 'debt'
                      ? 'bg-amber-50/40 hover:bg-amber-50/60'
                      : 'bg-red-50/40 hover:bg-red-50/60';
                const unpaidColor =
                  row.unpaidMonthsCount === 0
                    ? 'text-emerald-600'
                    : row.unpaidMonthsCount < 3
                      ? 'text-amber-600'
                      : 'text-red-600';
                const debtColor = row.debt > 0 ? (row.status === 'risky_debtor' ? 'text-red-600' : 'text-amber-600') : 'text-slate-500';
                return (
                  <tr key={row.id} className={rowBg}>
                    <td className="px-4 py-3 font-medium text-slate-800">{row.forestArea}</td>
                    <td className="px-4 py-3 text-slate-600">{row.tenant}</td>
                    <td className="px-4 py-3 text-slate-800">{formatSum(row.yearlyPrice)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatSum(row.totalPaid)}</td>
                    <td className={`px-4 py-3 font-medium ${debtColor}`}>
                      {row.debt > 0 ? formatSum(row.debt) : '—'}
                    </td>
                    <td className={`px-4 py-3 font-medium ${unpaidColor}`}>
                      {row.unpaidMonthsCount} oy
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${LEASE_STATUS_CLASS[row.status]}`}>
                        {LEASE_STATUS_LABELS[row.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openModal(row.id)}
                        className="text-forest-600 hover:text-forest-700 font-medium text-xs"
                      >
                        To&apos;lov qo&apos;shish
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modalLease && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" aria-modal="true">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">
                {modalLease.forestArea} — oylik to&apos;lovlar ({selectedYear})
              </h2>
              <button
                type="button"
                onClick={() => setModalLeaseId(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Yopish"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto">
              <div className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                Yillik narx: <strong>{formatSum(modalLease.yearlyPrice)}</strong> (oyiga {formatSum(modalLease.yearlyPrice / 12)}) |
                To&apos;langan: <strong>{formatSum(modalLease.totalPaid)}</strong> |
                Qarz: <strong className="text-red-600">{formatSum(modalLease.debt)}</strong>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-600 mb-2">Oylik to&apos;lovlar jadvali</h3>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2">Oy</th>
                        <th className="px-3 py-2">Kerakli to&apos;lov</th>
                        <th className="px-3 py-2">To&apos;langan</th>
                        <th className="px-3 py-2">Holat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {modalLease.monthlyRows.map((row) => (
                        <tr key={row.month} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2 text-slate-700">{row.monthLabel}</td>
                          <td className="px-3 py-2 text-slate-800">{formatSum(row.required)}</td>
                          <td className="px-3 py-2 text-slate-600">{formatSum(row.paid)}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${MONTHLY_STATUS_CLASS[row.status]}`}>
                              {MONTHLY_STATUS_LABELS[row.status]}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <h3 className="text-xs font-semibold text-slate-600 mb-2">Yangi to&apos;lov qo&apos;shish</h3>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">To&apos;lov sanasi</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-forest-500/40 focus:border-forest-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Summa (so&apos;m)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value.replace(/[^\d\s]/g, ''))}
                  placeholder="0"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-forest-500/40 focus:border-forest-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Izoh</label>
                <input
                  type="text"
                  value={formComment}
                  onChange={(e) => setFormComment(e.target.value)}
                  placeholder="Ixtiyoriy"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-forest-500/40 focus:border-forest-500"
                />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-slate-600 mb-2">To&apos;lovlar tarixi</h3>
                {modalLease.paymentRecords.length === 0 ? (
                  <p className="text-slate-500 text-sm">To&apos;lovlar hali kiritilmagan</p>
                ) : (
                  <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                    {[...modalLease.paymentRecords].reverse().map((p) => (
                      <li key={p.id} className="flex justify-between text-sm py-1.5 border-b border-slate-100 last:border-0">
                        <span className="text-slate-600">{formatDate(p.date)} — {formatSum(p.amount)}</span>
                        <span className="text-slate-500 truncate max-w-[140px]" title={p.comment}>{p.comment}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setModalLeaseId(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={() => addPayment(modalLease.id)}
                className="px-4 py-2 rounded-lg bg-forest-600 text-white text-sm font-medium hover:bg-forest-700 focus:ring-2 focus:ring-forest-500 focus:ring-offset-2"
              >
                Qo&apos;shish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
