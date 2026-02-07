'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

export type ForestAreaStatus = 'empty' | 'leased' | 'expired' | 'expiring_soon';

export type EffectiveAreaStatus = 'empty' | 'leased' | 'expiring_soon' | 'expired';

export type ForestArea = {
  id: string;
  name: string;
  maydon: number;
  status: ForestAreaStatus;
  contractId?: string;
  /** Contract end date (YYYY-MM-DD) when status is leased */
  contractEndDate?: string;
};

const STATUS_LABELS: Record<ForestAreaStatus, string> = {
  empty: "Bo'sh",
  leased: 'Ijarada',
  expired: 'Muddati tugagan',
  expiring_soon: 'Tugashiga yaqin',
};

export const EFFECTIVE_STATUS_LABELS: Record<EffectiveAreaStatus, string> = {
  empty: "Bo'sh",
  leased: 'Ijarada',
  expiring_soon: 'Tugashiga yaqin',
  expired: 'Muddati tugagan',
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_EXPIRING_SOON = 90;

export function getContractExpirationStatus(endDateStr: string): EffectiveAreaStatus {
  const end = new Date(endDateStr);
  if (isNaN(end.getTime())) return 'leased';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil((end.getTime() - today.getTime()) / MS_PER_DAY);
  if (daysLeft < 0) return 'expired';
  if (daysLeft < DAYS_EXPIRING_SOON) return 'expiring_soon';
  return 'leased';
}

/** Muddati o'tgan ijara maydonlarini "Bo'sh" qilib, ma'lumot yuklanganda ishlatiladi */
function normalizeExpiredLeases(areas: ForestArea[]): ForestArea[] {
  return areas.map((a) => {
    if (a.status !== 'leased' || !a.contractEndDate) return a;
    if (getContractExpirationStatus(a.contractEndDate) !== 'expired') return a;
    return {
      ...a,
      status: 'empty' as ForestAreaStatus,
      contractId: undefined,
      contractEndDate: undefined,
    };
  });
}

const INITIAL_AREAS: ForestArea[] = [
  { id: '1', name: 'Toshkent viloyati — Chorvoq', maydon: 125.5, status: 'leased', contractEndDate: '2025-12-31' },
  { id: '2', name: 'Samarqand — Nurota', maydon: 89.2, status: 'leased', contractEndDate: '2025-06-15' },
  { id: '3', name: "Farg'ona — Quvasoy", maydon: 210, status: 'leased', contractEndDate: '2026-03-20' },
  { id: '4', name: 'Buxoro — Romitan', maydon: 45.8, status: 'leased', contractEndDate: '2025-09-01' },
  { id: '5', name: 'Jizzax — Zomin', maydon: 167.3, status: 'leased', contractEndDate: '2026-01-10' },
  { id: '6', name: "Andijon — Bo'z", maydon: 52, status: 'empty' },
  { id: '7', name: 'Namangan — Chust', maydon: 78.4, status: 'empty' },
  { id: '8', name: 'Qashqadaryo — Shahrisabz', maydon: 95, status: 'empty' },
  { id: '9', name: 'Surxondaryo — Termiz', maydon: 120, status: 'empty' },
  { id: '10', name: 'Xorazm — Urganch', maydon: 88, status: 'empty' },
];

function getEffectiveStatus(area: ForestArea): EffectiveAreaStatus {
  if (area.status === 'empty' || area.status === 'expired') return area.status;
  if (area.status === 'leased' && area.contractEndDate)
    return getContractExpirationStatus(area.contractEndDate);
  return area.status;
}

type ForestAreasState = {
  areas: ForestArea[];
  setAreaStatus: (areaNameOrId: string, status: ForestAreaStatus, contractId?: string, contractEndDate?: string) => void;
  getAreaByName: (name: string) => ForestArea | undefined;
  getEffectiveStatus: (area: ForestArea) => EffectiveAreaStatus;
  emptyAreas: ForestArea[];
  leasedAreas: ForestArea[];
  expiredAreas: ForestArea[];
  statusLabel: (status: ForestAreaStatus) => string;
  effectiveStatusLabel: (status: EffectiveAreaStatus) => string;
};

const defaultState: ForestAreasState = {
  areas: [],
  setAreaStatus: () => {},
  getAreaByName: () => undefined,
  getEffectiveStatus,
  emptyAreas: [],
  leasedAreas: [],
  expiredAreas: [],
  statusLabel: (s) => STATUS_LABELS[s] ?? s,
  effectiveStatusLabel: (s) => EFFECTIVE_STATUS_LABELS[s] ?? s,
};

const ForestAreasContext = createContext<ForestAreasState>(defaultState);

export function ForestAreasProvider({ children }: { children: React.ReactNode }) {
  const [areas, setAreas] = useState<ForestArea[]>(() => normalizeExpiredLeases(INITIAL_AREAS));

  const setAreaStatus = useCallback((areaNameOrId: string, status: ForestAreaStatus, contractId?: string, contractEndDate?: string) => {
    setAreas((prev) =>
      prev.map((a) =>
        a.id === areaNameOrId || a.name === areaNameOrId
          ? {
              ...a,
              status,
              contractId: status === 'leased' ? contractId : undefined,
              contractEndDate: status === 'leased' ? contractEndDate : undefined,
            }
          : a
      )
    );
  }, []);

  const getAreaByName = useCallback(
    (name: string) => areas.find((a) => a.name === name),
    [areas]
  );

  const emptyAreas = areas.filter((a) => a.status === 'empty');
  const leasedAreas = areas.filter((a) => a.status === 'leased');
  const expiredAreas = areas.filter((a) => a.status === 'expired');

  const value: ForestAreasState = {
    areas,
    setAreaStatus,
    getAreaByName,
    getEffectiveStatus,
    emptyAreas,
    leasedAreas,
    expiredAreas,
    statusLabel: (s) => STATUS_LABELS[s] ?? s,
    effectiveStatusLabel: (s) => EFFECTIVE_STATUS_LABELS[s] ?? s,
  };

  return (
    <ForestAreasContext.Provider value={value}>
      {children}
    </ForestAreasContext.Provider>
  );
}

export function useForestAreas() {
  const ctx = useContext(ForestAreasContext);
  if (!ctx) {
    throw new Error('useForestAreas must be used within ForestAreasProvider');
  }
  return ctx;
}

export { STATUS_LABELS };
