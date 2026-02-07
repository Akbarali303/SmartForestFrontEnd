'use client';

import React, { createContext, useContext, useState } from 'react';

export type PaymentStatus = 'paid' | 'overdue' | 'pending';

export type Contract = {
  id: string;
  hudud: string;
  ijarachi: string;
  telefon?: string;
  maydon: number;
  shartnomaRaqami: string;
  boshlanishSanasi: string;
  tugashSanasi: string;
  tolovHolati: PaymentStatus;
  /** Oylik ijara to'lovi (mock, so'm) */
  monthlyAmount?: number;
};

export const INITIAL_CONTRACTS: Contract[] = [
  { id: '1', hudud: 'Toshkent viloyati — Chorvoq', ijarachi: "O'zbekiston o'rmon xo'jaligi", maydon: 125.5, shartnomaRaqami: 'SH-2024-001', boshlanishSanasi: '2024-01-01', tugashSanasi: '2025-12-31', tolovHolati: 'paid', monthlyAmount: 15_000_000 },
  { id: '2', hudud: 'Samarqand — Nurota', ijarachi: 'Agro Mehnat MCHJ', maydon: 89.2, shartnomaRaqami: 'SH-2024-002', boshlanishSanasi: '2024-02-01', tugashSanasi: '2025-06-15', tolovHolati: 'overdue', monthlyAmount: 8_500_000 },
  { id: '3', hudud: "Farg'ona — Quvasoy", ijarachi: 'Yashil Zamin LLC', maydon: 210, shartnomaRaqami: 'SH-2024-003', boshlanishSanasi: '2024-03-15', tugashSanasi: '2026-03-20', tolovHolati: 'pending', monthlyAmount: 22_000_000 },
  { id: '4', hudud: 'Buxoro — Romitan', ijarachi: "Buxoro o'rmon boshqarmasi", maydon: 45.8, shartnomaRaqami: 'SH-2024-004', boshlanishSanasi: '2024-01-10', tugashSanasi: '2025-09-01', tolovHolati: 'paid', monthlyAmount: 5_200_000 },
  { id: '5', hudud: 'Jizzax — Zomin', ijarachi: 'Zomin Tabiat MCHJ', maydon: 167.3, shartnomaRaqami: 'SH-2024-005', boshlanishSanasi: '2024-04-01', tugashSanasi: '2026-01-10', tolovHolati: 'pending', monthlyAmount: 18_000_000 },
];

type ContractsState = {
  contracts: Contract[];
  setContracts: React.Dispatch<React.SetStateAction<Contract[]>>;
};

const defaultState: ContractsState = {
  contracts: [],
  setContracts: () => {},
};

const ContractsContext = createContext<ContractsState>(defaultState);

export function ContractsProvider({ children }: { children: React.ReactNode }) {
  const [contracts, setContracts] = useState<Contract[]>(INITIAL_CONTRACTS);
  return (
    <ContractsContext.Provider value={{ contracts, setContracts }}>
      {children}
    </ContractsContext.Provider>
  );
}

export function useContracts() {
  const ctx = useContext(ContractsContext);
  if (!ctx) {
    throw new Error('useContracts must be used within ContractsProvider');
  }
  return ctx;
}
