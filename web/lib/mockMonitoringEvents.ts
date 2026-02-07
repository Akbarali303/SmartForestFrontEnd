/** Monitoring events table mock — aligned with map event ids for "View on map" */

export type MonitoringEventStatus = 'new' | 'in_progress' | 'resolved';
export type MonitoringEventSeverity = 'high' | 'medium' | 'low';
export type MonitoringEventType =
  | 'fire_risk'
  | 'illegal_logging'
  | 'suspicious_activity'
  | 'camera_offline';

export type MonitoringEventRow = {
  id: string;
  date: string;
  eventType: MonitoringEventType;
  regionArea: string;
  severity: MonitoringEventSeverity;
  assignedInspector: string | null;
  status: MonitoringEventStatus;
};

export const EVENT_TYPE_LABELS: Record<MonitoringEventType, string> = {
  fire_risk: "Yong'in xavfi",
  illegal_logging: 'Noqonuniy daraxt kesish',
  suspicious_activity: 'Shubhali harakat',
  camera_offline: "Kamera o'flayn",
};

export const SEVERITY_LABELS: Record<MonitoringEventSeverity, string> = {
  high: 'Yuqori',
  medium: "O'rta",
  low: 'Past',
};

export const STATUS_LABELS: Record<MonitoringEventStatus, string> = {
  new: 'Yangi',
  in_progress: 'Jarayonda',
  resolved: 'Hal qilindi',
};

export const MOCK_MONITORING_EVENTS: MonitoringEventRow[] = [
  {
    id: 'ev1',
    date: '2025-02-02T09:15:00',
    eventType: 'fire_risk',
    regionArea: 'Toshkent viloyati — Chorvoq',
    severity: 'high',
    assignedInspector: 'Rustam Karimov',
    status: 'resolved',
  },
  {
    id: 'ev2',
    date: '2025-02-02T08:42:00',
    eventType: 'illegal_logging',
    regionArea: 'Samarqand — Nurota',
    severity: 'high',
    assignedInspector: 'Dilnoza Toshpulatova',
    status: 'in_progress',
  },
  {
    id: 'ev3',
    date: '2025-02-02T10:20:00',
    eventType: 'suspicious_activity',
    regionArea: "Farg'ona — Quvasoy",
    severity: 'medium',
    assignedInspector: 'Jasur Beknazarov',
    status: 'new',
  },
  {
    id: 'ev4',
    date: '2025-02-02T07:00:00',
    eventType: 'camera_offline',
    regionArea: 'Jizzax — Zomin',
    severity: 'low',
    assignedInspector: 'Jasur Beknazarov',
    status: 'resolved',
  },
  {
    id: 'ev5',
    date: '2025-02-01T18:30:00',
    eventType: 'fire_risk',
    regionArea: 'Buxoro — Romitan',
    severity: 'medium',
    assignedInspector: 'Rustam Karimov',
    status: 'in_progress',
  },
  {
    id: 'ev6',
    date: '2025-02-02T06:55:00',
    eventType: 'suspicious_activity',
    regionArea: "Andijon — Bo'z",
    severity: 'low',
    assignedInspector: 'Madina Yusupova',
    status: 'resolved',
  },
];

export const MOCK_INSPECTORS_LIST = [
  'Rustam Karimov',
  'Dilnoza Toshpulatova',
  'Jasur Beknazarov',
  'Madina Yusupova',
];
