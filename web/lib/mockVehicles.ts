/**
 * Mock transport (forestry vehicles) data for Transport mode and Transportlar page.
 * GPS coordinates and routes are mock data.
 */

export type VehicleStatus = 'moving' | 'idle' | 'offline' | 'maintenance';
export type TransportType = 'truck' | 'jeep' | 'tractor' | 'fire_engine' | 'light_car';

export type MockVehicle = {
  id: string;
  name: string;
  transportType: TransportType;
  forestry: string;
  driver: string;
  distanceTraveledKm: number;
  currentDestination: string;
  status: VehicleStatus;
  lat: number;
  lng: number;
  /** Mock speed in km/h (for display and simulation) */
  speedKmh?: number;
  /** Mock GPS route points [lat, lng] for movement line */
  routePoints: [number, number][];
};

export const TRANSPORT_TYPE_LABELS: Record<TransportType, string> = {
  truck: 'Kamaz',
  jeep: 'Jip',
  tractor: 'Traktor',
  fire_engine: "O'choq mashinasi",
  light_car: 'Yengil avtomobil',
};

export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  moving: 'Harakatda',
  idle: 'To‘xtab turgan',
  offline: 'O‘flayn',
  maintenance: 'Ta’mirda',
};

/** Mock forestry vehicles with current position and route history (mock GPS). */
export const MOCK_VEHICLES: MockVehicle[] = [
  {
    id: 'v1',
    name: 'T-01 Chorvoq',
    transportType: 'truck',
    forestry: "Toshkent viloyati - Chorvoq",
    driver: 'Jasur Toshmatov',
    distanceTraveledKm: 124.5,
    currentDestination: 'Chorvoq ombor',
    status: 'moving',
    lat: 41.58,
    lng: 69.95,
    routePoints: [
      [41.52, 69.88],
      [41.54, 69.90],
      [41.55, 69.92],
      [41.56, 69.93],
      [41.58, 69.95],
    ],
  },
  {
    id: 'v2',
    name: 'J-02 Nurota',
    transportType: 'jeep',
    forestry: 'Samarqand - Nurota',
    driver: 'Dilnoza Rahimova',
    distanceTraveledKm: 89.2,
    currentDestination: 'Nurota qarorgoh',
    status: 'idle',
    lat: 40.28,
    lng: 65.42,
    routePoints: [
      [40.22, 65.38],
      [40.24, 65.39],
      [40.26, 65.40],
      [40.28, 65.42],
    ],
  },
  {
    id: 'v3',
    name: 'Tr-03 Quvasoy',
    transportType: 'tractor',
    forestry: "Farg'ona - Quvasoy",
    driver: 'Rustam Bekmurodov',
    distanceTraveledKm: 56.0,
    currentDestination: "Quvasoy o'rmon uchastkasi",
    status: 'moving',
    lat: 40.32,
    lng: 71.85,
    routePoints: [
      [40.28, 71.78],
      [40.30, 71.80],
      [40.31, 71.82],
      [40.32, 71.85],
    ],
  },
  {
    id: 'v4',
    name: 'O‘-04 Romitan',
    transportType: 'fire_engine',
    forestry: 'Buxoro - Romitan',
    driver: 'Madina Karimova',
    distanceTraveledKm: 201.3,
    currentDestination: 'Romitan markaz',
    status: 'moving',
    lat: 39.82,
    lng: 64.42,
    routePoints: [
      [39.75, 64.35],
      [39.78, 64.38],
      [39.80, 64.40],
      [39.82, 64.42],
    ],
  },
  {
    id: 'v5',
    name: 'T-05 Zomin',
    transportType: 'truck',
    forestry: 'Jizzax - Zomin',
    driver: 'Aziz Yo‘ldoshev',
    distanceTraveledKm: 167.8,
    currentDestination: 'Zomin tumani',
    status: 'idle',
    lat: 40.12,
    lng: 67.92,
    routePoints: [
      [40.08, 67.85],
      [40.10, 67.88],
      [40.12, 67.92],
    ],
  },
];

/** Demo vehicles for Transport tracking mode: moving on map with mock routes inside Uzbekistan. */
export type DemoVehicleType = 'tractor' | 'light_car' | 'truck';

export type DemoVehicle = {
  id: string;
  name: string;
  transportType: DemoVehicleType;
  /** Mock plate number */
  plateNumber: string;
  forestry: string;
  driver: string;
  speedKmh: number;
  /** Optional destination label */
  destination?: string;
  /** Mock route points [lat, lng] inside Uzbekistan */
  routePoints: [number, number][];
};

export const DEMO_VEHICLE_TYPE_LABELS: Record<DemoVehicleType, string> = {
  tractor: 'Traktor',
  light_car: 'Yengil avtomobil',
  truck: 'Kamaz',
};

/** Long mock routes inside Uzbekistan for demo movement. */
function uzRoute1(): [number, number][] {
  return [
    [41.32, 69.22], [41.34, 69.28], [41.36, 69.32], [41.38, 69.38], [41.40, 69.42],
    [41.42, 69.48], [41.44, 69.52], [41.46, 69.56], [41.48, 69.60], [41.50, 69.64],
    [41.52, 69.68], [41.54, 69.72], [41.56, 69.76], [41.58, 69.80], [41.60, 69.84],
    [41.58, 69.88], [41.56, 69.92], [41.54, 69.96], [41.52, 70.00], [41.50, 70.04],
    [41.48, 70.08], [41.46, 70.12], [41.44, 70.16], [41.42, 70.20], [41.40, 70.24],
    [41.38, 70.28], [41.36, 70.32], [41.34, 70.36], [41.32, 70.40], [41.30, 70.44],
    [41.28, 70.48], [41.26, 70.44], [41.28, 70.40], [41.30, 70.36], [41.32, 70.32],
    [41.34, 70.28], [41.36, 70.24], [41.38, 70.20], [41.40, 70.16], [41.42, 70.12],
    [41.44, 70.08], [41.46, 70.04], [41.48, 70.00], [41.50, 69.96], [41.52, 69.92],
  ];
}

function uzRoute2(): [number, number][] {
  return [
    [40.38, 71.75], [40.40, 71.72], [40.42, 71.68], [40.44, 71.64], [40.46, 71.60],
    [40.48, 71.56], [40.50, 71.52], [40.52, 71.48], [40.54, 71.44], [40.56, 71.40],
    [40.58, 71.36], [40.60, 71.32], [40.62, 71.28], [40.64, 71.24], [40.66, 71.20],
    [40.68, 71.16], [40.70, 71.12], [40.72, 71.08], [40.74, 71.04], [40.76, 71.00],
    [40.74, 70.96], [40.72, 70.92], [40.70, 70.88], [40.68, 70.84], [40.66, 70.80],
    [40.64, 70.76], [40.62, 70.72], [40.60, 70.68], [40.58, 70.64], [40.56, 70.60],
    [40.54, 70.56], [40.52, 70.52], [40.50, 70.48], [40.48, 70.44], [40.46, 70.40],
    [40.44, 70.36], [40.42, 70.32], [40.40, 70.28], [40.38, 70.24], [40.36, 70.20],
    [40.34, 70.16], [40.32, 70.12], [40.30, 70.08], [40.28, 70.04], [40.26, 70.00],
  ];
}

function uzRoute3(): [number, number][] {
  return [
    [39.75, 64.35], [39.78, 64.40], [39.82, 64.45], [39.86, 64.50], [39.90, 64.55],
    [39.94, 64.60], [39.98, 64.65], [40.02, 64.70], [40.06, 64.75], [40.10, 64.80],
    [40.14, 64.85], [40.18, 64.90], [40.22, 64.95], [40.26, 65.00], [40.30, 65.05],
    [40.34, 65.10], [40.38, 65.15], [40.42, 65.20], [40.46, 65.25], [40.50, 65.30],
    [40.54, 65.35], [40.58, 65.40], [40.62, 65.45], [40.66, 65.50], [40.70, 65.55],
    [40.68, 65.60], [40.64, 65.65], [40.60, 65.70], [40.56, 65.75], [40.52, 65.80],
    [40.48, 65.85], [40.44, 65.90], [40.40, 65.95], [40.36, 66.00], [40.32, 66.05],
    [40.28, 66.10], [40.24, 66.15], [40.20, 66.20], [40.16, 66.25], [40.12, 66.30],
    [40.08, 66.35], [40.04, 66.40], [40.00, 66.45], [39.96, 66.50], [39.92, 66.55],
  ];
}

/** Hudud markazi atrofida qisqa demo marshrut (14 viloyat uchun). */
function shortRegionRoute(lat: number, lng: number, points = 12): [number, number][] {
  const route: [number, number][] = [];
  const step = 0.04;
  for (let i = 0; i < points; i++) {
    const t = (i / points) * 2 * Math.PI;
    route.push([lat + step * Math.sin(t), lng + step * Math.cos(t)]);
  }
  return route;
}

/** 14 ta viloyat: nomi va markaziy koordinata [lat, lng]. */
const REGION_CENTERS: Array<{ name: string; lat: number; lng: number }> = [
  { name: 'Andijon', lat: 40.78, lng: 72.34 },
  { name: 'Buxoro', lat: 39.77, lng: 64.43 },
  { name: "Farg'ona", lat: 40.38, lng: 71.78 },
  { name: 'Jizzax', lat: 40.12, lng: 67.84 },
  { name: 'Namangan', lat: 41.0, lng: 71.6 },
  { name: 'Navoiy', lat: 42.0, lng: 64.5 },
  { name: 'Qashqadaryo', lat: 38.86, lng: 66.0 },
  { name: "Qoraqalpog'iston", lat: 43.78, lng: 59.0 },
  { name: 'Samarqand', lat: 39.65, lng: 66.96 },
  { name: 'Sirdaryo', lat: 40.5, lng: 68.7 },
  { name: 'Surxondaryo', lat: 37.22, lng: 67.28 },
  { name: 'Toshkent viloyati', lat: 41.3, lng: 69.3 },
  { name: 'Toshkent shahri', lat: 41.31, lng: 69.25 },
  { name: 'Xorazm', lat: 41.55, lng: 60.63 },
];

const DEMO_DRIVERS = ['Rustam Bekmurodov', 'Dilnoza Rahimova', 'Jasur Toshmatov', 'Madina Karimova', 'Aziz Yo\'ldoshev', 'Nilufar Rahimova', 'Bobur Turg\'unov', 'Sevinch Otaboyeva', 'Jahongir Ismoilov', 'Dilobar Xasanova', 'Sherzod Bekmurodov', 'Gulnora Karimova', 'Oybek Toshmatov', 'Malika Yusupova'];

/** 14 hududga demo transportlar: birinchi 3 ta uzun marshrut, qolgani qisqa aylana. */
export const DEMO_VEHICLES: DemoVehicle[] = [
  {
    id: 'demo-tractor',
    name: 'Tr-01 Chorvoq',
    transportType: 'tractor',
    plateNumber: '01 T 123 AB',
    forestry: "Toshkent viloyati - Chorvoq",
    driver: 'Rustam Bekmurodov',
    speedKmh: 18,
    destination: "Chorvoq ombor",
    routePoints: uzRoute1(),
  },
  {
    id: 'demo-light',
    name: 'L-02 Quvasoy',
    transportType: 'light_car',
    plateNumber: '02 F 456 CD',
    forestry: "Farg'ona - Quvasoy",
    driver: 'Dilnoza Rahimova',
    speedKmh: 52,
    destination: "Quvasoy uchastkasi",
    routePoints: uzRoute2(),
  },
  {
    id: 'demo-truck',
    name: 'K-03 Romitan',
    transportType: 'truck',
    plateNumber: '03 B 789 EF',
    forestry: 'Buxoro - Romitan',
    driver: 'Jasur Toshmatov',
    speedKmh: 45,
    destination: 'Romitan markaz',
    routePoints: uzRoute3(),
  },
  // 4–14: Andijon, Jizzax, Namangan, Navoiy, Qashqadaryo, Qoraqalpog'iston, Samarqand, Sirdaryo, Surxondaryo, Toshkent shahri, Xorazm
  ...REGION_CENTERS.filter((r) => !["Buxoro", "Farg'ona", "Toshkent viloyati"].includes(r.name)).map((r, i) => {
    const types: DemoVehicleType[] = ['tractor', 'light_car', 'truck'];
    const type = types[i % 3];
    const typePrefix = type === 'tractor' ? 'Tr' : type === 'light_car' ? 'L' : 'K';
    const num = String(i + 4).padStart(2, '0');
    return {
      id: `demo-region-${i + 4}`,
      name: `${typePrefix}-${num} ${r.name}`,
      transportType: type,
      plateNumber: `${num} ${r.name.slice(0, 1)} ${100 + i} XY`,
      forestry: r.name,
      driver: DEMO_DRIVERS[(i + 3) % DEMO_DRIVERS.length],
      speedKmh: type === 'tractor' ? 18 : type === 'light_car' ? 52 : 45,
      destination: `${r.name} markaz`,
      routePoints: shortRegionRoute(r.lat, r.lng),
    } satisfies DemoVehicle;
  }),
];
