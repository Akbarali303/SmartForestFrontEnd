'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

type UnattendedAreasContextValue = {
  unattendedCount: number;
  setUnattendedCount: (n: number) => void;
};

const UnattendedAreasContext = createContext<UnattendedAreasContextValue | null>(null);

export function UnattendedAreasProvider({ children }: { children: React.ReactNode }) {
  const [unattendedCount, setUnattendedCount] = useState(0);
  const value: UnattendedAreasContextValue = { unattendedCount, setUnattendedCount };
  return (
    <UnattendedAreasContext.Provider value={value}>
      {children}
    </UnattendedAreasContext.Provider>
  );
}

export function useUnattendedAreas() {
  const ctx = useContext(UnattendedAreasContext);
  return ctx ?? { unattendedCount: 0, setUnattendedCount: () => {} };
}
