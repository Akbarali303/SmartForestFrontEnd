/**
 * Kamera ro'yxati — Monitoring Center grid va xarita uchun (30 ta, har xil hududlarda).
 * Xarita (ForestCreateMap) o'z MOCK_CAMERAS dan foydalanadi; bu ro'yxat grid uchun.
 */

export type MonitoringCamera = {
  id: string;
  name: string;
  status: 'online' | 'offline';
  streamUrl: string;
  forestArea?: string;
  lastActive?: string;
};

/** 30 ta kamera — viloyatlar bo‘yicha taqsimlangan (har viloyatda 2–3 ta) */
const REGIONS: Array<{ name: string; area: string; lat: number; lng: number }> = [
  { name: 'Toshkent', area: 'Toshkent viloyati — Chorvoq', lat: 41.31, lng: 69.28 },
  { name: 'Toshkent-2', area: 'Toshkent viloyati — Chorvoq', lat: 41.29, lng: 69.30 },
  { name: 'Toshkent-3', area: 'Toshkent viloyati — Chorvoq', lat: 41.33, lng: 69.26 },
  { name: 'Samarqand', area: 'Samarqand — Nurota', lat: 39.65, lng: 66.96 },
  { name: 'Samarqand-2', area: 'Samarqand — Nurota', lat: 39.63, lng: 66.98 },
  { name: "Farg'ona", area: "Farg'ona — Quvasoy", lat: 40.38, lng: 71.78 },
  { name: "Farg'ona-2", area: "Farg'ona — Quvasoy", lat: 40.36, lng: 71.80 },
  { name: "Farg'ona-3", area: "Farg'ona — Quvasoy", lat: 40.40, lng: 71.76 },
  { name: 'Buxoro', area: 'Buxoro — Romitan', lat: 39.77, lng: 64.43 },
  { name: 'Buxoro-2', area: 'Buxoro — Romitan', lat: 39.75, lng: 64.45 },
  { name: 'Jizzax', area: 'Jizzax — Zomin', lat: 40.12, lng: 67.84 },
  { name: 'Jizzax-2', area: 'Jizzax — Zomin', lat: 40.10, lng: 67.86 },
  { name: "Andijon", area: "Andijon — Bo'z", lat: 40.78, lng: 72.34 },
  { name: 'Andijon-2', area: "Andijon — Bo'z", lat: 40.76, lng: 72.36 },
  { name: 'Namangan', area: 'Namangan — Chust', lat: 41.0, lng: 71.6 },
  { name: 'Namangan-2', area: 'Namangan — Chust', lat: 40.98, lng: 71.62 },
  { name: 'Qashqadaryo', area: 'Qashqadaryo — Shahrisabz', lat: 38.86, lng: 66.0 },
  { name: 'Qashqadaryo-2', area: 'Qashqadaryo — Shahrisabz', lat: 38.84, lng: 66.02 },
  { name: "Qoraqalpoq", area: "Qoraqalpog'iston", lat: 43.78, lng: 59.0 },
  { name: 'Qoraqalpoq-2', area: "Qoraqalpog'iston", lat: 43.76, lng: 59.02 },
  { name: 'Sirdaryo', area: 'Sirdaryo — Guliston', lat: 40.5, lng: 68.7 },
  { name: 'Sirdaryo-2', area: 'Sirdaryo — Guliston', lat: 40.48, lng: 68.72 },
  { name: 'Surxondaryo', area: 'Surxondaryo — Termiz', lat: 37.22, lng: 67.28 },
  { name: 'Surxondaryo-2', area: 'Surxondaryo — Termiz', lat: 37.20, lng: 67.30 },
  { name: 'Toshkent sh.', area: 'Toshkent shahri', lat: 41.31, lng: 69.25 },
  { name: 'Toshkent sh.-2', area: 'Toshkent shahri', lat: 41.29, lng: 69.27 },
  { name: 'Xorazm', area: 'Xorazm — Urganch', lat: 41.55, lng: 60.63 },
  { name: 'Xorazm-2', area: 'Xorazm — Urganch', lat: 41.53, lng: 60.65 },
  { name: 'Navoiy', area: 'Navoiy — Zarafshon', lat: 42.0, lng: 64.5 },
  { name: 'Navoiy-2', area: 'Navoiy — Zarafshon', lat: 41.98, lng: 64.52 },
];

const STATUSES: Array<'online' | 'offline'> = ['online', 'online', 'offline', 'online', 'online', 'offline', 'online', 'online', 'online', 'offline', 'online', 'online', 'online', 'offline', 'online', 'online', 'offline', 'online', 'online', 'online', 'offline', 'online', 'online', 'online', 'online', 'offline', 'online', 'online', 'online', 'online'];

export const MONITORING_CAMERAS: MonitoringCamera[] = REGIONS.map((r, i) => ({
  id: `cam${i + 1}`,
  name: `Cam-${String(i + 1).padStart(2, '0')} ${r.name}`,
  status: STATUSES[i] ?? 'online',
  streamUrl: '/streams/cam1.m3u8',
  forestArea: r.area,
  lastActive: i % 4 === 2 ? '2025-02-01T18:20:00' : `2025-02-02T10:${String(45 - (i % 30)).padStart(2, '0')}:00`,
}));

/** Xarita (ForestCreateMap) uchun kameralar — lat/lng bilan */
export const MONITORING_CAMERAS_WITH_POSITIONS = REGIONS.map((r, i) => ({
  id: `cam${i + 1}`,
  name: `Cam-${String(i + 1).padStart(2, '0')} ${r.name}`,
  lat: r.lat,
  lng: r.lng,
  status: STATUSES[i] ?? 'online',
  forestArea: r.area,
  lastActive: i % 4 === 2 ? '2025-02-01T18:20:00' : `2025-02-02T10:${String(45 - (i % 30)).padStart(2, '0')}:00`,
  streamUrl: '/streams/cam1.m3u8',
}));
