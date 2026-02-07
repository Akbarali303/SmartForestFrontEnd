/** Mock: to'lov nazorati qatorlari (dashboard va To'lov nazorati sahifasi uchun) */

export type LeasePaymentRow = {
  id: string;
  forestArea: string;
  tenant: string;
  leasePrice: number;
  paidAmount: number;
  debtAmount: number;
  paymentStatus: 'paid' | 'partial' | 'debt';
};

export const MOCK_LEASE_PAYMENTS: LeasePaymentRow[] = [
  { id: '1', forestArea: "Toshkent viloyati — Chorvoq", tenant: "O'zbekiston o'rmon xo'jaligi", leasePrice: 180_000_000, paidAmount: 180_000_000, debtAmount: 0, paymentStatus: 'paid' },
  { id: '2', forestArea: 'Samarqand — Nurota', tenant: 'Agro Mehnat MCHJ', leasePrice: 102_000_000, paidAmount: 76_500_000, debtAmount: 25_500_000, paymentStatus: 'partial' },
  { id: '3', forestArea: "Farg'ona — Quvasoy", tenant: 'Yashil Zamin LLC', leasePrice: 264_000_000, paidAmount: 0, debtAmount: 264_000_000, paymentStatus: 'debt' },
  { id: '4', forestArea: 'Buxoro — Romitan', tenant: "Buxoro o'rmon boshqarmasi", leasePrice: 62_400_000, paidAmount: 62_400_000, debtAmount: 0, paymentStatus: 'paid' },
  { id: '5', forestArea: 'Jizzax — Zomin', tenant: 'Zomin Tabiat MCHJ', leasePrice: 216_000_000, paidAmount: 54_000_000, debtAmount: 162_000_000, paymentStatus: 'partial' },
];
