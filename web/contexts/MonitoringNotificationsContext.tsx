'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export type MonitoringNotificationItem = {
  id: string;
  eventType: string;
  forestArea: string;
  time: string;
  assignedInspector: string;
  read: boolean;
};

const MOCK_MONITORING_NOTIFICATIONS: MonitoringNotificationItem[] = [
  { id: 'ev1', eventType: "Yong'in xavfi", forestArea: 'Toshkent viloyati — Chorvoq', time: '2025-02-02T09:15:00', assignedInspector: 'Rustam Karimov', read: false },
  { id: 'ev2', eventType: 'Noqonuniy daraxt kesish', forestArea: 'Samarqand — Nurota', time: '2025-02-02T08:42:00', assignedInspector: 'Dilnoza Toshpulatova', read: false },
  { id: 'ev3', eventType: 'Shubhali harakat', forestArea: "Farg'ona — Quvasoy", time: '2025-02-02T10:20:00', assignedInspector: '—', read: false },
  { id: 'ev4', eventType: "Kamera o'flayn", forestArea: 'Jizzax — Zomin', time: '2025-02-02T07:00:00', assignedInspector: 'Jasur Beknazarov', read: false },
  { id: 'ev5', eventType: "Yong'in xavfi", forestArea: 'Buxoro — Romitan', time: '2025-02-01T18:30:00', assignedInspector: '—', read: false },
  { id: 'ev6', eventType: 'Shubhali harakat', forestArea: "Andijon — Bo'z", time: '2025-02-02T06:55:00', assignedInspector: 'Madina Yusupova', read: false },
];

type MonitoringNotificationsContextValue = {
  notifications: MonitoringNotificationItem[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  pendingEventId: string | null;
  setPendingEventId: (id: string | null) => void;
  openEventOnMap: (eventId: string) => void;
};

const MonitoringNotificationsContext = createContext<MonitoringNotificationsContextValue | null>(null);

export function MonitoringNotificationsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<MonitoringNotificationItem[]>(() =>
    MOCK_MONITORING_NOTIFICATIONS.map((n) => ({ ...n }))
  );
  const [pendingEventId, setPendingEventIdState] = useState<string | null>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const setPendingEventId = useCallback((id: string | null) => {
    setPendingEventIdState(id);
  }, []);

  const openEventOnMap = useCallback(
    (eventId: string) => {
      setPendingEventIdState(eventId);
      markAsRead(eventId);
      router.push('/dashboard/forest/create');
    },
    [markAsRead, router]
  );

  const value: MonitoringNotificationsContextValue = {
    notifications,
    unreadCount,
    markAsRead,
    pendingEventId,
    setPendingEventId,
    openEventOnMap,
  };

  return (
    <MonitoringNotificationsContext.Provider value={value}>
      {children}
    </MonitoringNotificationsContext.Provider>
  );
}

export function useMonitoringNotifications() {
  const ctx = useContext(MonitoringNotificationsContext);
  if (!ctx) {
    throw new Error('useMonitoringNotifications must be used within MonitoringNotificationsProvider');
  }
  return ctx;
}

/** Optional version for components that may render outside the provider (e.g. map). */
export function useMonitoringNotificationsOptional(): MonitoringNotificationsContextValue | null {
  return useContext(MonitoringNotificationsContext);
}
