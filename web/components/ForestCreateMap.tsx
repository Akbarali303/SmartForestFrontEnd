'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import type { Feature, FeatureCollection, Polygon, MultiPolygon, Geometry, GeometryCollection } from 'geojson';
import area from '@turf/area';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import booleanWithin from '@turf/boolean-within';
import intersect from '@turf/intersect';
import { featureCollection } from '@turf/helpers';
import Link from 'next/link';
import { CameraStreamModal } from '@/components/CameraStreamModal';
import { useForestAreas } from '@/contexts/ForestAreasContext';
import type { EffectiveAreaStatus } from '@/contexts/ForestAreasContext';
import { useContracts } from '@/contexts/ContractsContext';
import { useMonitoringNotificationsOptional } from '@/contexts/MonitoringNotificationsContext';
import { useUnattendedAreas } from '@/contexts/UnattendedAreasContext';
import {
  DEMO_VEHICLES,
  DEMO_VEHICLE_TYPE_LABELS,
  type DemoVehicle,
  type DemoVehicleType,
} from '@/lib/mockVehicles';
import { alertSound } from '@/lib/alertSound';
import { MONITORING_CAMERAS_WITH_POSITIONS } from '@/lib/mockCameras';

/** Hudud holati bo‘yicha xarita ranglari: Bo‘sh=yashil, Ijarada=sariq, Tugashiga yaqin=to‘q sariq, Muddati tugagan=qizil */
const AREA_STATUS_STYLE: Record<EffectiveAreaStatus, { fillColor: string; color: string }> = {
  empty: { fillColor: '#22c55e', color: '#166534' },
  leased: { fillColor: '#eab308', color: '#ca8a04' },
  expiring_soon: { fillColor: '#f97316', color: '#ea580c' },
  expired: { fillColor: '#ef4444', color: '#b91c1c' },
};

const STATUS_LABEL: Record<EffectiveAreaStatus, string> = {
  empty: "Bo'sh",
  leased: 'Ijarada',
  expiring_soon: 'Tugashiga yaqin',
  expired: 'Muddati tugagan',
};

/** Hudud nomi bo‘yicha mock kamerlar soni (takrorlanuvchi) */
function mockCamerasForArea(name: string): number {
  let n = 0;
  for (let i = 0; i < name.length; i++) n += name.charCodeAt(i);
  return (n % 5) + 1;
}

function formatRevenue(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} mln so'm`;
  return `${n.toLocaleString('uz')} so'm`;
}

function formatDateOnly(s: string): string {
  try {
    const d = new Date(s);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '—';
  }
}

export type ForestAreaInfoPanel = {
  hududNomi: string;
  maydonHa: number;
  /** Umumiy o'rmon maydoni (ga) */
  totalAreaHa: number;
  /** Ijara maydonlari yig'indisi (ga) */
  leasedAreaHa: number;
  /** Bo'sh maydon (ga) = total - leased */
  emptyAreaHa: number;
  status: EffectiveAreaStatus;
  ijarachi: string;
  contractEndDate: string;
  leasePaymentMonthly: number;
  cameras: number;
};

const UZ_CENTER: [number, number] = [41.3, 64.5];
/** Default: butun O‘zbekiston va atrofidagi mamlakatlar ko‘rinsin */
const UZ_ZOOM = 6;
const REGIONS_URL = '/public/geo/uzbekistan_regions.geojson';

const REGION_ORDER = [
  'Andijon',
  'Buxoro',
  "Farg'ona",
  'Jizzax',
  'Namangan',
  'Navoiy',
  'Qashqadaryo',
  "Qoraqalpog'iston",
  'Samarqand',
  'Sirdaryo',
  'Surxondaryo',
  'Toshkent viloyati',
  'Toshkent shahri',
  'Xorazm',
];

type RegionFeature = Feature<Polygon | MultiPolygon, { ADM1_EN?: string; ADM1_UZ?: string; ADM1_RU?: string }>;
type UploadedFeature = Feature<Polygon | MultiPolygon, Record<string, unknown>> & {
  properties?: { name?: string; type?: string; area_ha?: number; region?: string };
};

/** Xaritada chiziladigan hudud turi — rang va popup uchun */
export type DrawAreaType = 'forest' | 'lease' | 'empty';

/** Xarita rejimi: qaysi qatlamlar ko‘rinadi. */
export type MapMode = 'land_management' | 'monitoring' | 'transport_tracking';

/** Zoom asosida qatlam ko‘rinishi uchun minimal zoom darajalari. */
export const MAP_ZOOM_THRESHOLDS = {
  /** Kameralar: Monitoring rejimida barcha zoomlarda ko‘rinadi */
  cameras: 0,
  /** Hodisalar: Monitoring rejimida barcha zoomlarda ko‘rinadi */
  events: 0,
  /** Heatmap / risk: Monitoring rejimida barcha zoomlarda ko‘rinadi */
  heatmapRisk: 0,
  /** Inspektorlar va patrul: zoom >= 8 da ko‘rinadi */
  inspectorsPatrol: 8,
} as const;

/** Rejim bo‘yicha bazali xarita qatlami. Barcha rejimlar ishonchli OSM/CARTO tile ishlatadi (oppoq xarita bo‘lmasin). */
function createBaseTileLayer(mode: MapMode): L.TileLayer {
  const osm = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const osmOpts: L.TileLayerOptions = { attribution: '© OpenStreetMap' };
  switch (mode) {
    case 'land_management':
      return L.tileLayer(osm, osmOpts);
    case 'monitoring':
      return L.tileLayer(osm, { ...osmOpts, maxZoom: 19 });
    case 'transport_tracking':
      return L.tileLayer(osm, { ...osmOpts, maxZoom: 19 });
    default:
      return L.tileLayer(osm, osmOpts);
  }
}

/** Sahifa kontekstiga qarab xarita qatlamlari va rejimlarni boshqarish.
 * Map page: showMonitoringLayers=true, showEvents=true, drawingMode=false.
 * Area creation page: showMonitoringLayers=false, showEvents=false, drawingMode=true.
 * mapMode berilsa: land_management = faqat yer/hudud; monitoring = hamma; transport_tracking = inspektorlar, patrul, kameralar.
 */
export type ForestCreateMapConfig = {
  /** Monitoring qatlamlari: kameralar, heatmap, risk, patrul, inspektorlar. Faqat map sahifada true. */
  showMonitoringLayers?: boolean;
  /** Hodisa markerlari va incident paneli. Faqat map sahifada true. */
  showEvents?: boolean;
  /** Chizish rejimi: viloyat/hudud tanlash, chizish asboblari. Faqat hudud qo'shish sahifada true. */
  drawingMode?: boolean;
  /** True bo'lsa, konteyner to'ldiradi (map sahifada ishlatish uchun). */
  fillContainer?: boolean;
  /** Xarita rejimi: faqat tegishli qatlamlarni yoqadi. Berilmasa showMonitoringLayers/showEvents ishlatiladi. */
  mapMode?: MapMode;
};

const DRAW_AREA_TYPE_LABELS: Record<DrawAreaType, string> = {
  forest: "O'rmon yer maydoni",
  lease: 'Ijara yer maydoni',
  empty: "Bo'sh yer maydoni",
};

function getRegionName(f: RegionFeature): string {
  const p = f.properties;
  return (p?.ADM1_UZ || p?.ADM1_EN || p?.ADM1_RU || 'Viloyat') as string;
}

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/['']/g, "'")
    .replace(/sh\./g, 'shahri')
    .replace(/vil\./g, 'viloyati');
}

function sortRegions(features: RegionFeature[]): RegionFeature[] {
  const byName = new Map(features.map((f) => [normalizeForMatch(getRegionName(f)), f]));
  const ordered: RegionFeature[] = [];
  for (const label of REGION_ORDER) {
    const key = normalizeForMatch(label);
    for (const [k, f] of Array.from(byName.entries())) {
      if (k.includes(key) || key.includes(k)) {
        ordered.push(f);
        byName.delete(k);
        break;
      }
    }
  }
  const rest = Array.from(byName.values()).sort((a, b) => getRegionName(a).localeCompare(getRegionName(b)));
  return [...ordered, ...rest];
}

function calcAreaHa(geom: Polygon | MultiPolygon): number {
  const poly = geom.type === 'Polygon' ? geom : { type: 'MultiPolygon' as const, coordinates: geom.coordinates };
  const sqM = area({ type: 'Feature', properties: {}, geometry: poly });
  return Math.round((sqM / 10000) * 10) / 10;
}

function areaFromGeometry(geom: Geometry): number {
  if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
    return calcAreaHa(geom);
  }
  if (geom.type === 'GeometryCollection') {
    return (geom as GeometryCollection).geometries.reduce(
      (sum, g) => sum + (g && (g.type === 'Polygon' || g.type === 'MultiPolygon') ? areaFromGeometry(g) : 0),
      0
    );
  }
  return 0;
}

function flattenFeature(f: { type: string; properties?: Record<string, unknown>; geometry?: Geometry }): Array<Feature<Polygon | MultiPolygon, Record<string, unknown>>> {
  if (!f.geometry) return [];
  const g = f.geometry;
  if (g.type === 'Polygon' || g.type === 'MultiPolygon') {
    return [{ type: 'Feature', properties: f.properties ?? {}, geometry: g } as Feature<Polygon | MultiPolygon, Record<string, unknown>>];
  }
  if (g.type === 'GeometryCollection') {
    return (g as GeometryCollection).geometries
      .filter((sg): sg is Polygon | MultiPolygon => sg.type === 'Polygon' || sg.type === 'MultiPolygon')
      .map((sg) => ({ type: 'Feature' as const, properties: f.properties ?? {}, geometry: sg }));
  }
  return [];
}

function hasGeometry(obj: unknown): obj is { geometry: Geometry } {
  return typeof obj === 'object' && obj !== null && 'geometry' in obj && typeof (obj as { geometry: unknown }).geometry === 'object';
}

/** O'rmon maydonining centroidi qaysi viloyatda ekanini qaytaradi (region_name bo'lmasa geometriya orqali) */
function getRegionNameForForestFeature(
  feature: Feature<Polygon | MultiPolygon, Record<string, unknown>>,
  regionFeatures: RegionFeature[]
): string | null {
  if (!feature.geometry || (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon')) return null;
  const [lat, lng] = getCentroidFromFeature(feature.geometry);
  const point: [number, number] = [lng, lat];
  for (const region of regionFeatures) {
    const geom = region.geometry as Polygon | MultiPolygon | GeometryCollection;
    if (pointInRegionGeometry(point, geom)) return getRegionName(region);
  }
  return null;
}

/** Hodisa nuqtasi qaysi o'rmon va ijara maydonida ekanini aniqlaydi (polygon ma'lumotlari orqali) */
export type EventAreaLink = {
  forestName: string | null;
  rentalTenant: string | null;
};

function getAreaForPoint(
  lat: number,
  lng: number,
  forestFeatures: UploadedFeature[],
  leaseFeatures: UploadedFeature[],
  contracts: { hudud: string; ijarachi: string }[]
): EventAreaLink {
  const point: [number, number] = [lng, lat];
  let forestName: string | null = null;
  for (const f of forestFeatures) {
    if (!f.geometry || (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon')) continue;
    const geom = f.geometry as Polygon | MultiPolygon | GeometryCollection;
    if (pointInRegionGeometry(point, geom)) {
      forestName = (f.properties?.name as string) ?? null;
      break;
    }
  }
  let rentalTenant: string | null = null;
  for (const f of leaseFeatures) {
    if (!f.geometry || (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon')) continue;
    const geom = f.geometry as Polygon | MultiPolygon | GeometryCollection;
    if (pointInRegionGeometry(point, geom)) {
      const areaName = (f.properties?.name as string) ?? forestName ?? '';
      const contract = contracts.find(
        (c) => areaName && (c.hudud === areaName || c.hudud.includes(areaName) || areaName.includes(c.hudud))
      );
      if (contract) rentalTenant = contract.ijarachi;
      else if (forestName) {
        const byForest = contracts.find((c) => forestName && (c.hudud === forestName || c.hudud.includes(forestName) || forestName.includes(c.hudud)));
        if (byForest) rentalTenant = byForest.ijarachi;
      }
      break;
    }
  }
  if (!rentalTenant && forestName) {
    const contract = contracts.find((c) => forestName && (c.hudud === forestName || c.hudud.includes(forestName) || forestName.includes(c.hudud)));
    if (contract) rentalTenant = contract.ijarachi;
  }
  return { forestName, rentalTenant };
}

/** Nuqta [lng, lat] viloyat geometriyasi (Polygon, MultiPolygon yoki GeometryCollection) ichida ekanini tekshiradi */
function pointInRegionGeometry(point: [number, number], geometry: Polygon | MultiPolygon | GeometryCollection): boolean {
  if (geometry && (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon')) {
    return booleanPointInPolygon(point, geometry as Polygon | MultiPolygon);
  }
  const geoms = geometry && 'geometries' in geometry && Array.isArray((geometry as GeometryCollection).geometries) && (geometry as GeometryCollection).geometries;
  if (geoms) {
    for (const g of geoms) {
      if (g && (g.type === 'Polygon' || g.type === 'MultiPolygon') && pointInRegionGeometry(point, g as Polygon | MultiPolygon)) {
        return true;
      }
    }
  }
  return false;
}

/** Polygon yoki MultiPolygon dan bbox [minLng, minLat, maxLng, maxLat] olish */
function getBbox(geometry: Polygon | MultiPolygon): [number, number, number, number] {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  const collect = (coords: number[][]) => {
    for (const [lng, lat] of coords) {
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    }
  };
  if (geometry.type === 'Polygon') {
    for (const ring of geometry.coordinates) collect(ring);
  } else {
    for (const poly of geometry.coordinates) {
      for (const ring of poly) collect(ring);
    }
  }
  return [minLng, minLat, maxLng, maxLat];
}

/** Polygon yoki MultiPolygon ichida tasodifiy nuqta [lat, lng] (Leaflet uchun). Agar topilmasa null. */
function getRandomPointInGeometry(geometry: Polygon | MultiPolygon): [number, number] | null {
  const [minLng, minLat, maxLng, maxLat] = getBbox(geometry);
  for (let i = 0; i < 50; i++) {
    const lng = minLng + Math.random() * (maxLng - minLng);
    const lat = minLat + Math.random() * (maxLat - minLat);
    const point: [number, number] = [lng, lat];
    if (booleanPointInPolygon(point, geometry)) return [lat, lng];
  }
  return null;
}

/** Chizilgan kontur viloyat geometriyasi (Polygon, MultiPolygon yoki GeometryCollection) ichida ekanini tekshiradi */
function polygonWithinRegionGeometry(
  drawn: Feature<Polygon | MultiPolygon>,
  geometry: Polygon | MultiPolygon | GeometryCollection
): boolean {
  if (geometry && (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon')) {
    return booleanWithin(drawn, { type: 'Feature', properties: {}, geometry: geometry as Polygon | MultiPolygon });
  }
  const geoms = geometry && 'geometries' in geometry && Array.isArray((geometry as GeometryCollection).geometries) && (geometry as GeometryCollection).geometries;
  if (geoms) {
    for (const g of geoms) {
      if (g && (g.type === 'Polygon' || g.type === 'MultiPolygon')) {
        if (booleanWithin(drawn, { type: 'Feature', properties: {}, geometry: g })) return true;
      }
    }
  }
  return false;
}

/** Viloyat geometriyasini Polygon massiviga yoyadi (intersect uchun) */
function regionToPolygons(geometry: Polygon | MultiPolygon | GeometryCollection): Polygon[] {
  if (geometry.type === 'Polygon') return [geometry];
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.map((coords) => ({ type: 'Polygon' as const, coordinates: coords }));
  }
  const geoms = (geometry as GeometryCollection).geometries;
  if (!Array.isArray(geoms)) return [];
  const out: Polygon[] = [];
  for (const g of geoms) {
    if (g?.type === 'Polygon') out.push(g);
    if (g?.type === 'MultiPolygon') out.push(...regionToPolygons(g));
  }
  return out;
}

/** Chizilgan konturni viloyat chegarasiga kesib, faqat ichki qismini qaytaradi (chegaradan tashqariga chiqmasligini ta'minlash) */
function clipDrawnToRegion(
  drawn: Polygon,
  regionGeometry: Polygon | MultiPolygon | GeometryCollection
): Polygon | MultiPolygon | null {
  const drawnFeature = { type: 'Feature' as const, properties: {}, geometry: drawn };
  const regionPolys = regionToPolygons(regionGeometry);
  const parts: Polygon[] = [];
  for (const regionPoly of regionPolys) {
    try {
      const fc = featureCollection([
        drawnFeature,
        { type: 'Feature' as const, properties: {}, geometry: regionPoly },
      ]);
      const result = intersect(fc);
      if (result?.geometry && (result.geometry.type === 'Polygon' || result.geometry.type === 'MultiPolygon')) {
        if (result.geometry.type === 'Polygon') parts.push(result.geometry);
        else result.geometry.coordinates.forEach((c) => parts.push({ type: 'Polygon' as const, coordinates: c }));
      }
    } catch {
      // ignore invalid intersection
    }
  }
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return { type: 'MultiPolygon', coordinates: parts.map((p) => p.coordinates) };
}

/** Ikki maydon ustma-ust tushadimi (ijara/bo'sh tekshiruvi uchun) */
function polygonsOverlap(geomA: Polygon | MultiPolygon, geomB: Polygon | MultiPolygon): boolean {
  try {
    const fa = { type: 'Feature' as const, properties: {}, geometry: geomA };
    const fb = { type: 'Feature' as const, properties: {}, geometry: geomB };
    const result = intersect(featureCollection([fa, fb]));
    if (!result?.geometry || (result.geometry.type !== 'Polygon' && result.geometry.type !== 'MultiPolygon')) return false;
    const sqM = area(result);
    return sqM > 1e-6;
  } catch {
    return false;
  }
}

/** Polygon yoki MultiPolygon ni viloyat chegarasiga kesib qaytaradi (fayl yuklashda faqat tanlangan viloyat qismi) */
function clipGeometryToRegion(
  geom: Polygon | MultiPolygon,
  regionGeometry: Polygon | MultiPolygon | GeometryCollection
): Polygon | MultiPolygon | null {
  if (geom.type === 'Polygon') return clipDrawnToRegion(geom, regionGeometry);
  const parts: Polygon[] = [];
  for (const coords of geom.coordinates) {
    const poly: Polygon = { type: 'Polygon', coordinates: coords };
    const clipped = clipDrawnToRegion(poly, regionGeometry);
    if (clipped) {
      if (clipped.type === 'Polygon') parts.push(clipped);
      else clipped.coordinates.forEach((c) => parts.push({ type: 'Polygon' as const, coordinates: c }));
    }
  }
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return { type: 'MultiPolygon', coordinates: parts.map((p) => p.coordinates) };
}

function isGeometry(obj: unknown): obj is Geometry {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    typeof (obj as { type: string }).type === 'string' &&
    'coordinates' in obj
  );
}

/** Istalgan GeoJSON-o‘xshash formatni features ro‘yxatiga aylantiradi */
function normalizeToFeatures(raw: unknown): Array<{ type: string; properties: Record<string, unknown>; geometry: Geometry }> {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.flatMap((item) => normalizeToFeatures(item));
  }
  const o = raw as Record<string, unknown>;
  if (typeof o !== 'object') return [];

  if (o.type === 'FeatureCollection' && Array.isArray(o.features)) {
    return o.features.flatMap((f: unknown) => normalizeToFeatures(f));
  }
  if (o.type === 'Feature' && hasGeometry(o)) {
    return [{ type: 'Feature', properties: ((o as Record<string, unknown>).properties as Record<string, unknown>) ?? {}, geometry: o.geometry }];
  }
  if (hasGeometry(o)) {
    return [{ type: 'Feature', properties: ((o as Record<string, unknown>).properties as Record<string, unknown>) ?? {}, geometry: o.geometry }];
  }
  if (Array.isArray(o.features)) {
    return o.features.flatMap((f: unknown) => normalizeToFeatures(f));
  }
  if (isGeometry(o)) {
    return [{ type: 'Feature', properties: {}, geometry: o }];
  }
  if (o.type === 'Polygon' || o.type === 'MultiPolygon') {
    return [{ type: 'Feature', properties: {}, geometry: o as unknown as Geometry }];
  }
  return [];
}

/** JSON ichidan istalgan chuqurlikda Polygon/MultiPolygon qidiradi (struktura farq qilsa ham) */
function deepCollectPolygons(obj: unknown, out: Array<{ type: string; properties: Record<string, unknown>; geometry: Polygon | MultiPolygon }> = []): void {
  if (obj == null || typeof obj !== 'object') return;
  const o = obj as Record<string, unknown>;
  if (
    (o.type === 'Polygon' || o.type === 'MultiPolygon') &&
    Array.isArray(o.coordinates) &&
    (o.type === 'MultiPolygon' ? Array.isArray((o.coordinates as unknown[])[0]) : true)
  ) {
    out.push({ type: 'Feature', properties: {}, geometry: o as unknown as Polygon | MultiPolygon });
    return;
  }
  if (Array.isArray(o)) {
    for (const item of o) deepCollectPolygons(item, out);
    return;
  }
  for (const key of Object.keys(o)) {
    if (key === 'type' || key === 'coordinates') continue;
    deepCollectPolygons(o[key], out);
  }
}

const REGION_STYLE = { color: '#166534', weight: 2, fillColor: '#22c55e', fillOpacity: 0.15 };
const HIGHLIGHT_STYLE = { color: '#0d4d21', weight: 3, fillColor: '#16a34a', fillOpacity: 0.25 };

/** Nazoratsiz hudud (hech qanday inspektor radius ichida emas) — ko‘k/binafsha chegarasi */
const UNATTENDED_AREA_STYLE = { color: '#7c3aed', weight: 3, fillColor: '#a78bfa', fillOpacity: 0.25 };

/** Polygon styles and order: forest (bottom) → empty (middle) → lease (top). Polygons stay clickable via onEachFeature. */
const FOREST_LAYER_STYLE: L.PathOptions = { color: '#14532d', weight: 2, fillColor: '#166534', fillOpacity: 0 };
const LEASE_LAYER_STYLE: L.PathOptions = { color: '#a16207', weight: 2, fillColor: '#eab308', fillOpacity: 0.55 };
const EMPTY_LAYER_STYLE: L.PathOptions = { color: '#6b7280', weight: 2, fillColor: '#e5e7eb', fillOpacity: 0.5 };

const ATTENDANCE_RADIUS_KM = 80;

function getCentroidFromFeature(geometry: Polygon | MultiPolygon): [number, number] {
  let lngSum = 0;
  let latSum = 0;
  let n = 0;
  const addRing = (ring: number[][]) => {
    for (const c of ring) {
      if (c.length >= 2) {
        lngSum += c[0];
        latSum += c[1];
        n++;
      }
    }
  };
  if (geometry.type === 'Polygon' && geometry.coordinates?.[0]) {
    addRing(geometry.coordinates[0]);
  } else if (geometry.type === 'MultiPolygon' && geometry.coordinates) {
    for (const poly of geometry.coordinates) {
      if (poly?.[0]) addRing(poly[0]);
    }
  }
  if (n === 0) return [41.3, 64.5];
  return [latSum / n, lngSum / n];
}

/** Geometriya uchun [minLng, minLat, maxLng, maxLat] qaytaradi */
function getBboxOfGeometry(geometry: Polygon | MultiPolygon | GeometryCollection): [number, number, number, number] {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  const addRing = (ring: number[][]) => {
    for (const c of ring) {
      if (c.length >= 2) {
        minLng = Math.min(minLng, c[0]);
        minLat = Math.min(minLat, c[1]);
        maxLng = Math.max(maxLng, c[0]);
        maxLat = Math.max(maxLat, c[1]);
      }
    }
  };
  if (geometry.type === 'Polygon' && geometry.coordinates?.[0]) addRing(geometry.coordinates[0]);
  else if (geometry.type === 'MultiPolygon' && geometry.coordinates) {
    for (const poly of geometry.coordinates) {
      if (poly?.[0]) addRing(poly[0]);
    }
  } else if (geometry.type === 'GeometryCollection' && 'geometries' in geometry) {
    for (const g of (geometry as GeometryCollection).geometries) {
      if (g && (g.type === 'Polygon' || g.type === 'MultiPolygon')) {
        const [a, b, c, d] = getBboxOfGeometry(g);
        minLng = Math.min(minLng, a); minLat = Math.min(minLat, b); maxLng = Math.max(maxLng, c); maxLat = Math.max(maxLat, d);
      }
    }
  }
  if (minLng === Infinity) return [64.5, 41.3, 64.5, 41.3];
  return [minLng, minLat, maxLng, maxLat];
}

/** Viloyat ichida tasodifiy nuqta (GeoJSON [lng,lat] emas, [lat, lng] qaytaradi). */
function getRandomPointInRegion(region: RegionFeature): [number, number] | null {
  const geom = region.geometry as Polygon | MultiPolygon | GeometryCollection;
  const [minLng, minLat, maxLng, maxLat] = getBboxOfGeometry(geom);
  for (let i = 0; i < 80; i++) {
    const lng = minLng + Math.random() * (maxLng - minLng);
    const lat = minLat + Math.random() * (maxLat - minLat);
    const point: [number, number] = [lng, lat];
    if (pointInRegionGeometry(point, geom)) return [lat, lng];
  }
  const [lat, lng] = getCentroidFromFeature(region.geometry as Polygon | MultiPolygon);
  return [lat, lng];
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

type HeatmapRiskLevel = 'low' | 'medium' | 'high';
const RISK_HEATMAP_STYLE: Record<HeatmapRiskLevel, { fillColor: string; color: string; fillOpacity: number }> = {
  low: { fillColor: '#22c55e', color: '#166534', fillOpacity: 0.4 },
  medium: { fillColor: '#eab308', color: '#ca8a04', fillOpacity: 0.45 },
  high: { fillColor: '#ef4444', color: '#b91c1c', fillOpacity: 0.45 },
};

/** Hodisalar soni bo‘yicha viloyat uchun xavf darajasi: 0 = low, 1 = medium, 2+ = high */
function getRiskLevel(eventCount: number): HeatmapRiskLevel {
  if (eventCount <= 0) return 'low';
  if (eventCount === 1) return 'medium';
  return 'high';
}

/** Mock hodisalar bo‘yicha viloyatlar uchun hodisalar sonini hisoblaydi (nuqta viloyat ichida). */
function getEventCountByRegion(
  regionFeatures: RegionFeature[],
  events: MockMonitoringEvent[]
): Record<string, number> {
  const count: Record<string, number> = {};
  for (const f of regionFeatures) {
    const name = getRegionName(f);
    count[name] = 0;
    const geom = f.geometry as Polygon | MultiPolygon | GeometryCollection;
    for (const ev of events) {
      const point: [number, number] = [ev.lng, ev.lat];
      if (pointInRegionGeometry(point, geom)) count[name]++;
    }
  }
  return count;
}

/** Risk bashorati: 0–2 = low, 3–5 = medium, 6+ = high (o‘tmishdagi hodisalar soni bo‘yicha). */
type PredictionRiskLevel = 'low' | 'medium' | 'high';
function getPredictionRiskLevel(eventCount: number): PredictionRiskLevel {
  if (eventCount <= 2) return 'low';
  if (eventCount <= 5) return 'medium';
  return 'high';
}

const RISK_PREDICTION_STYLE: Record<PredictionRiskLevel, { fillColor: string; color: string; fillOpacity: number; dashArray: string }> = {
  low: { fillColor: '#22c55e', color: '#166534', fillOpacity: 0.2, dashArray: '8,8' },
  medium: { fillColor: '#eab308', color: '#ca8a04', fillOpacity: 0.25, dashArray: '8,8' },
  high: { fillColor: '#ef4444', color: '#b91c1c', fillOpacity: 0.25, dashArray: '8,8' },
};

const RISK_PREDICTION_LEGEND: Record<PredictionRiskLevel, string> = {
  low: 'Past xavf (0–2)',
  medium: 'O‘rta xavf (3–5)',
  high: 'Yuqori xavf (6+)',
};

type MockCamera = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: 'online' | 'offline';
  forestArea: string;
  lastActive: string;
  /** HLS oqim URL — live rejim uchun */
  streamUrl: string;
};

/** 30 ta kamera — har xil hududlarda (mockCameras dan) */
const MOCK_CAMERAS: MockCamera[] = MONITORING_CAMERAS_WITH_POSITIONS as MockCamera[];

function formatCameraTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

/** O‘rmon hududi nomlarini solishtirish (bog‘lash uchun). */
function sameForestArea(a: string, b: string): boolean {
  const na = a.replace(/\s+/g, ' ').trim().toLowerCase();
  const nb = b.replace(/\s+/g, ' ').trim().toLowerCase();
  return na === nb || na.includes(nb) || nb.includes(na);
}

/** Kamera uchun hodisa bor-yo‘qligi — shu kameraning o‘rmon hududida hodisa bo‘lsa “active” (yonadi). */
function cameraHasLinkedEvent(cam: MockCamera): boolean {
  return MOCK_EVENTS.some((ev) => sameForestArea(cam.forestArea, ev.forestArea));
}

/** Kamera marker ikonkasi (localhost:9000/map dagi kabi): kamera SVG, hodisa bo‘lsa yonadi (active). */
function createCameraMarkerIcon(hasLinkedEvent: boolean): L.DivIcon {
  const activeClass = hasLinkedEvent ? ' camera-marker-active' : '';
  const CAM_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="4"/><line x1="2" y1="10" x2="2" y2="14"/><line x1="22" y1="10" x2="22" y2="14"/></svg>';
  const boxShadow = hasLinkedEvent
    ? '0 0 10px 3px rgba(34,197,94,.5),0 0 20px 6px rgba(34,197,94,.3),0 2px 6px rgba(0,0,0,.35)'
    : '0 0 5px 2px rgba(34,197,94,.25),0 0 12px 4px rgba(34,197,94,.15),0 2px 5px rgba(0,0,0,.3)';
  const borderColor = hasLinkedEvent ? 'rgba(34,197,94,.75)' : 'rgba(34,197,94,.45)';
  return L.divIcon({
    className: 'camera-marker-icon',
    html: `<div class="camera-marker-wrap${activeClass}" style="position:relative;width:26px;height:26px;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 35% 35%,#2a3035,#0d0f12);border-radius:50%;border:1px solid ${borderColor};box-shadow:${boxShadow};cursor:pointer;transition:transform .2s,box-shadow .2s,border-color .2s;"><span style="width:14px;height:14px;color:rgba(255,255,255,.95);display:inline-flex;">${CAM_SVG}</span>${hasLinkedEvent ? '<span style="position:absolute;bottom:-1px;right:-1px;width:6px;height:6px;background:#4ade80;border-radius:50%;border:1px solid #0d0f12;box-shadow:0 0 4px rgba(74,222,128,.8)"></span>' : ''}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type MonitoringEventType = 'fire_risk' | 'illegal_logging' | 'suspicious_activity' | 'camera_offline';

/** Demo hodisa generator uchun turlar */
export type DemoEventType = 'fire' | 'person' | 'transport' | 'camera' | 'risk';

const DEMO_EVENT_TYPES: DemoEventType[] = ['fire', 'person', 'transport', 'camera', 'risk'];

const DEMO_EVENT_TYPE_CONFIG: Record<
  DemoEventType,
  { label: string; color: string; iconSvg: string }
> = {
  fire: {
    label: "Yong'in",
    color: '#ef4444',
    iconSvg: '<path fill="currentColor" d="M12 23c0-2.5 2-3.5 2-5.5 0-1.5-.5-2.5-1-3 1.5 0 3-1.5 3-4 0-2-1-3-2.5-3.5.5 2-2 3-2 5.5 0 2 2 3.5 2 5.5z"/>',
  },
  person: {
    label: 'Shaxs',
    color: '#3b82f6',
    iconSvg: '<path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>',
  },
  transport: {
    label: 'Transport',
    color: '#16a34a',
    iconSvg: '<path fill="currentColor" d="M18 18.5H6v-5h12v5zM6 12V6.5l6-3 6 3V12H6z"/>',
  },
  camera: {
    label: 'Kamera',
    color: '#6b7280',
    iconSvg: '<path fill="currentColor" d="M18 10.5V6a2 2 0 00-2-2H8a2 2 0 00-2 2v4.5M14 19l-3-3m0 0l-3 3m3-3v-6"/>',
  },
  risk: {
    label: 'Xavf',
    color: '#dc2626',
    iconSvg: '<path fill="currentColor" d="M12 2L2 20h20L12 2zm0 6v6m0-4h.01"/>',
  },
};

export type DemoEvent = {
  id: string;
  lat: number;
  lng: number;
  type: DemoEventType;
  time: string;
  regionName: string;
};

/** AI detection dan kelgan hodisa — /api/ai-events/list dan. Koordinata kamera joylashuviga bog‘langan. */
export type AIEventMap = {
  id: string;
  cameraId: string;
  cameraName: string;
  timestamp: string;
  imageUrl: string | null;
  lat: number;
  lng: number;
};

type MockMonitoringEvent = {
  id: string;
  type: MonitoringEventType;
  lat: number;
  lng: number;
  location: string;
  time: string;
  forestArea: string;
};

const MOCK_EVENTS: MockMonitoringEvent[] = [
  { id: 'ev1', type: 'fire_risk', lat: 41.28, lng: 69.35, location: 'Chorvoq tumani, 12-km', time: '2025-02-02T09:15:00', forestArea: 'Toshkent viloyati — Chorvoq' },
  { id: 'ev2', type: 'illegal_logging', lat: 39.62, lng: 67.02, location: 'Nurota tog\' etagi', time: '2025-02-02T08:42:00', forestArea: 'Samarqand — Nurota' },
  { id: 'ev3', type: 'suspicious_activity', lat: 40.35, lng: 71.82, location: 'Quvasoy shimol', time: '2025-02-02T10:20:00', forestArea: "Farg'ona — Quvasoy" },
  { id: 'ev4', type: 'camera_offline', lat: 40.10, lng: 67.88, location: 'Zomin yo\'li', time: '2025-02-02T07:00:00', forestArea: 'Jizzax — Zomin' },
  { id: 'ev5', type: 'fire_risk', lat: 39.80, lng: 64.38, location: 'Romitan janub', time: '2025-02-01T18:30:00', forestArea: 'Buxoro — Romitan' },
  { id: 'ev6', type: 'suspicious_activity', lat: 40.75, lng: 72.38, location: "Bo'z massivi", time: '2025-02-02T06:55:00', forestArea: "Andijon — Bo'z" },
];

type MockInspector = { id: string; name: string };
const MOCK_INSPECTORS: MockInspector[] = [
  { id: 'insp1', name: 'Rustam Karimov' },
  { id: 'insp2', name: 'Dilnoza Toshpulatova' },
  { id: 'insp3', name: 'Jasur Beknazarov' },
  { id: 'insp4', name: 'Madina Yusupova' },
];

/** Live tracking: inspektor xaritada (mock koordinatalar va harakat). */
type InspectorMapStatus = 'available' | 'busy';
type InspectorLiveData = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: InspectorMapStatus;
  assignedTasks: string[];
};
const INSPECTOR_STATUS_LABEL: Record<InspectorMapStatus, string> = {
  available: 'Mavjud',
  busy: 'Bandi',
};
const MOCK_INSPECTORS_LIVE_INITIAL: InspectorLiveData[] = [
  { id: 'insp1', name: 'Rustam Karimov', lat: 41.32, lng: 69.22, status: 'busy', assignedTasks: ["Yong'in xavfi — Chorvoq", "Romitan tekshiruv"] },
  { id: 'insp2', name: 'Dilnoza Toshpulatova', lat: 39.58, lng: 67.10, status: 'available', assignedTasks: ['Nurota hududi'] },
  { id: 'insp3', name: 'Jasur Beknazarov', lat: 40.38, lng: 71.75, status: 'busy', assignedTasks: ["Quvasoy shubhali harakat", "Kamera Zomin"] },
  { id: 'insp4', name: 'Madina Yusupova', lat: 40.72, lng: 72.30, status: 'available', assignedTasks: ["Bo'z massivi kuzatuv"] },
];

function createInspectorPopupContent(data: InspectorLiveData): string {
  const statusLabel = INSPECTOR_STATUS_LABEL[data.status];
  const tasksHtml = data.assignedTasks.length > 0
    ? data.assignedTasks.map((t) => `<li class="text-slate-700">${escapeHtml(t)}</li>`).join('')
    : '<li class="text-slate-500">—</li>';
  return `<div class="text-sm min-w-[200px]">
    <div class="font-semibold text-slate-800 border-b border-slate-200 pb-1 mb-2">${escapeHtml(data.name)}</div>
    <div class="space-y-1 text-xs">
      <p><span class="text-slate-500">Holat:</span> <span class="font-medium ${data.status === 'available' ? 'text-green-600' : 'text-amber-600'}">${statusLabel}</span></p>
      <p class="text-slate-500 mt-1">Biriktirilgan vazifalar:</p>
      <ul class="list-disc list-inside mt-0.5 space-y-0.5">${tasksHtml}</ul>
    </div>
  </div>`;
}

function createInspectorMarkerIcon(status: InspectorMapStatus): L.DivIcon {
  const color = status === 'available' ? '#22c55e' : '#f59e0b';
  return L.divIcon({
    className: 'inspector-marker-icon',
    html: `<div style="background:${color};width:24px;height:24px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

type TaskStatus = 'new' | 'in_progress' | 'resolved';
const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  new: 'Yangi',
  in_progress: 'Jarayonda',
  resolved: 'Hal qilindi',
};
type EventAssignment = { inspectorId: string | null; status: TaskStatus };

/** Hodisa timeline bosqichlari — mock vaqtlar */
type TimelineStepKey = 'event_detected' | 'inspector_assigned' | 'work_started' | 'issue_resolved';
const TIMELINE_STEP_LABELS: Record<TimelineStepKey, string> = {
  event_detected: 'Hodisa aniqlandi',
  inspector_assigned: 'Inspektor biriktirildi',
  work_started: 'Ish boshlandi',
  issue_resolved: 'Muammo hal qilindi',
};
const TIMELINE_ORDER: TimelineStepKey[] = ['event_detected', 'inspector_assigned', 'work_started', 'issue_resolved'];

type EventTimeline = Partial<Record<TimelineStepKey, string | null>>;
const MOCK_EVENT_TIMELINES: Record<string, EventTimeline> = {
  ev1: {
    event_detected: '2025-02-02T09:15:00',
    inspector_assigned: '2025-02-02T10:00:00',
    work_started: '2025-02-02T10:30:00',
    issue_resolved: '2025-02-02T14:00:00',
  },
  ev2: {
    event_detected: '2025-02-02T08:42:00',
    inspector_assigned: '2025-02-02T09:15:00',
    work_started: '2025-02-02T09:45:00',
    issue_resolved: null,
  },
  ev3: {
    event_detected: '2025-02-02T10:20:00',
    inspector_assigned: '2025-02-02T11:00:00',
    work_started: null,
    issue_resolved: null,
  },
  ev4: {
    event_detected: '2025-02-02T07:00:00',
    inspector_assigned: '2025-02-02T08:00:00',
    work_started: '2025-02-02T08:30:00',
    issue_resolved: '2025-02-02T12:00:00',
  },
  ev5: {
    event_detected: '2025-02-01T18:30:00',
    inspector_assigned: '2025-02-02T09:00:00',
    work_started: '2025-02-02T09:30:00',
    issue_resolved: null,
  },
  ev6: {
    event_detected: '2025-02-02T06:55:00',
    inspector_assigned: '2025-02-02T07:30:00',
    work_started: '2025-02-02T08:00:00',
    issue_resolved: '2025-02-02T11:00:00',
  },
};

const EVENT_TYPE_CONFIG: Record<
  MonitoringEventType,
  { label: string; color: string; iconSvg: string }
> = {
  fire_risk: {
    label: 'Yong\'in xavfi',
    color: '#ef4444',
    iconSvg: '<path fill="currentColor" d="M12 23c0-2.5 2-3.5 2-5.5 0-1.5-.5-2.5-1-3 1.5 0 3-1.5 3-4 0-2-1-3-2.5-3.5.5 2-2 3-2 5.5 0 2 2 3.5 2 5.5z"/>',
  },
  illegal_logging: {
    label: 'Noqonuniy daraxt kesish',
    color: '#f97316',
    iconSvg: '<path fill="currentColor" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>',
  },
  suspicious_activity: {
    label: 'Shubhali harakat',
    color: '#eab308',
    iconSvg: '<path fill="currentColor" d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>',
  },
  camera_offline: {
    label: 'Kamera o\'flayn',
    color: '#6b7280',
    iconSvg: '<path fill="currentColor" d="M18 10.5V6a2 2 0 00-2-2H8a2 2 0 00-2 2v4.5M14 19l-3-3m0 0l-3 3m3-3v-6"/>',
  },
};

function formatEventTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function createEventIcon(type: MonitoringEventType, options?: { pulse?: boolean }): L.DivIcon {
  const cfg = EVENT_TYPE_CONFIG[type];
  if (!cfg) return createEventIcon('fire_risk');
  const pulseClass = options?.pulse ? ' event-marker-pulse' : '';
  return L.divIcon({
    className: 'event-marker-icon' + pulseClass,
    html: `<div style="background:${cfg.color};width:28px;height:28px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:#fff;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#fff">${cfg.iconSvg}</svg></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

/** Demo hodisa marker (fire/person/transport/camera/risk) — pulsatsiya bilan. */
function createDemoEventIcon(type: DemoEventType, pulse: boolean): L.DivIcon {
  const cfg = DEMO_EVENT_TYPE_CONFIG[type];
  if (!cfg) return createDemoEventIcon('fire', pulse);
  const pulseClass = pulse ? ' event-marker-pulse' : '';
  return L.divIcon({
    className: 'event-marker-icon demo-event-marker' + pulseClass,
    html: `<div style="background:${cfg.color};width:28px;height:28px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:#fff;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#fff">${cfg.iconSvg}</svg></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

/** AI detection hodisa marker — pulsatsiya, kamera joylashuvida. */
function createAIEventIcon(): L.DivIcon {
  const color = '#f59e0b';
  const iconSvg =
    '<path fill="currentColor" d="M18 10.5V6a2 2 0 00-2-2H8a2 2 0 00-2 2v4.5M14 19l-3-3m0 0l-3 3m3-3v-6"/>';
  return L.divIcon({
    className: 'event-marker-icon event-marker-pulse ai-event-marker',
    html: `<div style="background:${color};width:28px;height:28px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:#fff;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#fff">${iconSvg}</svg></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

/** Event cluster xavf darajasi: soni bo‘yicha rang (yashil / sariq / qizil). */
const EVENT_CLUSTER_RISK = {
  low: { max: 3, class: 'event-cluster-low' },
  medium: { max: 9, class: 'event-cluster-medium' },
  high: { max: Infinity, class: 'event-cluster-high' },
} as const;

function getEventClusterRiskClass(count: number): string {
  if (count <= EVENT_CLUSTER_RISK.low.max) return EVENT_CLUSTER_RISK.low.class;
  if (count <= EVENT_CLUSTER_RISK.medium.max) return EVENT_CLUSTER_RISK.medium.class;
  return EVENT_CLUSTER_RISK.high.class;
}

/** Monitoring hodisalari uchun cluster icon: ichida soni, xavf ranglari (yashil / sariq / qizil). */
function createEventClusterIcon(cluster: { getChildCount(): number }): L.DivIcon {
  const count = cluster.getChildCount();
  const riskClass = getEventClusterRiskClass(count);
  return L.divIcon({
    className: `event-cluster-icon ${riskClass}`,
    html: `<div><span>${count}</span></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

/** Vehicle marker icons for Transport tracking mode: Tractor, Light car, Truck (Kamaz). */
function createVehicleMarkerIcon(type: DemoVehicleType): L.DivIcon {
  const config: Record<DemoVehicleType, { bg: string; symbol: string }> = {
    tractor: { bg: '#166534', symbol: '🚜' },
    light_car: { bg: '#1d4ed8', symbol: '🚗' },
    truck: { bg: '#c2410c', symbol: '🚛' },
  };
  const { bg, symbol } = config[type];
  return L.divIcon({
    className: 'vehicle-marker-icon',
    html: `<div style="background:${bg};width:32px;height:32px;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:18px;line-height:1;">${symbol}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function createDemoVehiclePopupContent(v: DemoVehicle, traveledKm: number, speedKmh: number): string {
  const typeLabel = DEMO_VEHICLE_TYPE_LABELS[v.transportType];
  return `<div class="text-sm min-w-[200px]">
    <div class="font-semibold text-slate-800 border-b border-slate-200 pb-1 mb-2">${escapeHtml(v.name)}</div>
    <div class="space-y-1 text-xs">
      <p><span class="text-slate-500">Turi:</span> <span class="text-slate-800">${escapeHtml(typeLabel)}</span></p>
      <p><span class="text-slate-500">O'rmon xo'jaligi:</span> <span class="text-slate-800">${escapeHtml(v.forestry)}</span></p>
      <p><span class="text-slate-500">Haydovchi:</span> <span class="text-slate-800">${escapeHtml(v.driver)}</span></p>
      <p><span class="text-slate-500">Tezlik:</span> <span class="text-slate-800">${speedKmh.toFixed(0)} km/h</span></p>
      <p><span class="text-slate-500">Bosib o'tgan:</span> <span class="text-slate-800">${traveledKm.toFixed(1)} km</span></p>
    </div>
  </div>`;
}

export default function ForestCreateMap(props: ForestCreateMapConfig = {}) {
  const {
    showMonitoringLayers: propShowMonitoring = false,
    showEvents: propShowEvents = false,
    drawingMode = true,
    fillContainer = false,
    mapMode,
  } = props;

  const showMonitoringLayers = mapMode === 'monitoring' ? true : mapMode === 'land_management' || mapMode === 'transport_tracking' ? false : propShowMonitoring;
  const showEvents = mapMode === 'monitoring' ? true : mapMode === 'land_management' || mapMode === 'transport_tracking' ? false : propShowEvents;
  const showHeatmapAndRisk = mapMode === 'monitoring' || (mapMode == null && propShowMonitoring);
  const showInspectorsAndPatrol = mapMode == null && propShowMonitoring;
  const showVehiclesAndRoutes = mapMode === 'transport_tracking';
  const showLeaseAndEmptyAreas = mapMode !== 'monitoring' && mapMode !== 'transport_tracking';

  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const baseLayerRef = useRef<L.TileLayer | null>(null);
  const mapModeRef = useRef<MapMode | undefined>(mapMode);
  mapModeRef.current = mapMode;
  const regionsLayerRef = useRef<L.GeoJSON | null>(null);
  const highlightLayerRef = useRef<L.GeoJSON | null>(null);
  const uploadLayerRef = useRef<L.Layer | null>(null);
  const savedAreasLayerRef = useRef<L.LayerGroup | null>(null);
  const camerasLayerRef = useRef<L.LayerGroup | null>(null);
  const eventsLayerRef = useRef<L.LayerGroup | null>(null);
  const heatmapLayerRef = useRef<L.GeoJSON | null>(null);
  const riskPredictionLayerRef = useRef<L.GeoJSON | null>(null);
  const inspectorsLayerRef = useRef<L.LayerGroup | null>(null);
  const inspectorLiveDataRef = useRef<InspectorLiveData[]>(MOCK_INSPECTORS_LIVE_INITIAL.map((d) => ({ ...d, assignedTasks: [...d.assignedTasks] })));
  const inspectorMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const savedAreaCentroidsRef = useRef<Map<string, [number, number]>>(new Map());
  const savedAreaMetaRef = useRef<Map<string, { name: string; layer: L.Path; type: string }>>(new Map());
  const patrolRouteLayerRef = useRef<L.LayerGroup | null>(null);
  const vehiclesLayerRef = useRef<L.LayerGroup | null>(null);
  const demoVehicleStateRef = useRef<Map<string, { routeIndex: number; segmentT: number; traveledKm: number; polyline: L.Polyline; marker: L.Marker }>>(new Map());
  const showPatrolRoutesRef = useRef(false);
  const showLeaseAndEmptyAreasRef = useRef(showLeaseAndEmptyAreas);
  const showMonitoringLayersRef = useRef(showMonitoringLayers);
  const [mapZoomLevel, setMapZoomLevel] = useState<number>(UZ_ZOOM);
  const mapZoomLevelRef = useRef(mapZoomLevel);
  const unattendedAreaIdsRef = useRef<string[]>([]);
  const updateSavedAreaStylesRef = useRef<() => void>(() => {});

  useEffect(() => {
    showMonitoringLayersRef.current = showMonitoringLayers;
  }, [showMonitoringLayers]);
  const prevShowLeaseAndEmptyRef = useRef(showLeaseAndEmptyAreas);
  useEffect(() => {
    showLeaseAndEmptyAreasRef.current = showLeaseAndEmptyAreas;
    if (prevShowLeaseAndEmptyRef.current !== showLeaseAndEmptyAreas) {
      prevShowLeaseAndEmptyRef.current = showLeaseAndEmptyAreas;
      refreshSavedRef.current();
    }
  }, [showLeaseAndEmptyAreas]);
  useEffect(() => {
    mapZoomLevelRef.current = mapZoomLevel;
  }, [mapZoomLevel]);
  useEffect(() => {
    showLeaseAndEmptyAreasRef.current = showLeaseAndEmptyAreas;
  }, [showLeaseAndEmptyAreas]);

  const { setUnattendedCount } = useUnattendedAreas();
  const { areas: forestAreas, getEffectiveStatus } = useForestAreas();
  const [unattendedAreaIds, setUnattendedAreaIds] = useState<string[]>([]);
  const [showPatrolRoutes, setShowPatrolRoutes] = useState(false);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [completedPatrolAreaIds, setCompletedPatrolAreaIds] = useState<string[]>([]);
  const [completedPatrolTimes, setCompletedPatrolTimes] = useState<Record<string, string>>({});
  const completedPatrolAreaIdsRef = useRef<string[]>([]);

  /** Transport tracking panel: open/closed and selected vehicle for table highlight */
  const [transportPanelOpen, setTransportPanelOpen] = useState(true);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  type DemoVehicleStatus = 'moving' | 'stopped' | 'offline';
  const [demoVehicleLiveState, setDemoVehicleLiveState] = useState<
    Record<string, { lat: number; lng: number; traveledKm: number; speedKmh: number; status: DemoVehicleStatus }>
  >(() => {
    const init: Record<string, { lat: number; lng: number; traveledKm: number; speedKmh: number; status: DemoVehicleStatus }> = {};
    DEMO_VEHICLES.forEach((v) => {
      const [lat, lng] = v.routePoints[0] ?? [41.3, 69.2];
      init[v.id] = { lat, lng, traveledKm: 0, speedKmh: v.speedKmh, status: 'moving' };
    });
    return init;
  });

  const effectiveUnattendedIds = unattendedAreaIds.filter((id) => !completedPatrolAreaIds.includes(id));

  useEffect(() => {
    showPatrolRoutesRef.current = showPatrolRoutes;
  }, [showPatrolRoutes]);

  useEffect(() => {
    completedPatrolAreaIdsRef.current = completedPatrolAreaIds;
  }, [completedPatrolAreaIds]);

  useEffect(() => {
    setUnattendedCount(effectiveUnattendedIds.length);
  }, [effectiveUnattendedIds.length, setUnattendedCount]);

  useEffect(() => {
    unattendedAreaIdsRef.current = unattendedAreaIds;
  }, [unattendedAreaIds]);

  useEffect(() => {
    updateSavedAreaStylesRef.current = () => {
      const useUnattendedStyle = showMonitoringLayersRef.current;
      savedAreaMetaRef.current.forEach((meta, id) => {
        const isEffectiveUnattended =
          useUnattendedStyle &&
          unattendedAreaIdsRef.current.includes(id) &&
          !completedPatrolAreaIdsRef.current.includes(id);
        const style = isEffectiveUnattended
          ? UNATTENDED_AREA_STYLE
          : meta.type === 'lease'
            ? LEASE_LAYER_STYLE
            : meta.type === 'empty'
              ? EMPTY_LAYER_STYLE
              : FOREST_LAYER_STYLE;
        try {
          meta.layer.setStyle(style);
        } catch {
          // ignore if layer already removed
        }
      });
    };
  }, []);

  useEffect(() => {
    updateSavedAreaStylesRef.current?.();
  }, [showMonitoringLayers, unattendedAreaIds, completedPatrolAreaIds]);

  const [regionFeatures, setRegionFeatures] = useState<RegionFeature[]>([]);
  const [riskHeatmapOn, setRiskHeatmapOn] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<RegionFeature | null>(null);
  const [uploadedFeatures, setUploadedFeatures] = useState<UploadedFeature[]>([]);
  const [totalAreaHa, setTotalAreaHa] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle');
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);
  const [forestName, setForestName] = useState('');
  const [inputMode, setInputMode] = useState<'map' | 'file'>('file');
  const [drawAreaType, setDrawAreaType] = useState<DrawAreaType | null>(null);
  /** Lease/bo'sh maydonlarni faqat tanlangan o'rmon maydoni ichida chizish uchun */
  const [selectedForestFeature, setSelectedForestFeature] = useState<UploadedFeature | null>(null);
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([]);
  /** Ijara narxi — tarif 1 ga uchun (so'm), mock */
  const [leaseTariffPerHa, setLeaseTariffPerHa] = useState<number>(1_000_000);
  const [savedAreasVersion, setSavedAreasVersion] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [drawError, setDrawError] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  /** Saved forest areas from API — Rental/Free flows show these in selected region */
  const [savedForestFeatures, setSavedForestFeatures] = useState<UploadedFeature[]>([]);
  /** Saved lease/empty from API — overlap tekshiruvi uchun (konturlar ustma-ust tushmasin) */
  const [savedLeaseFeatures, setSavedLeaseFeatures] = useState<UploadedFeature[]>([]);
  const [savedEmptyFeatures, setSavedEmptyFeatures] = useState<UploadedFeature[]>([]);
  const refreshSavedRef = useRef<() => void>(() => {});
  const drawLayerRef = useRef<L.LayerGroup | null>(null);

  const { contracts } = useContracts();
  const notificationsContext = useMonitoringNotificationsOptional();
  const pendingEventId = notificationsContext?.pendingEventId ?? null;
  const setPendingEventId = notificationsContext?.setPendingEventId ?? (() => {});
  const [selectedAreaInfo, setSelectedAreaInfo] = useState<ForestAreaInfoPanel | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [alertMuted, setAlertMuted] = useState(() => (typeof window !== 'undefined' ? alertSound.isMuted() : false));
  /** Qatlamlar paneli: hodisa belgilari ko‘rinishi (Monitoring) */
  const [showEventsOverlay, setShowEventsOverlay] = useState(true);
  /** Qatlamlar paneli: kamerlar qatlami ko‘rinishi */
  const [showCamerasOverlay, setShowCamerasOverlay] = useState(true);
  /** Qatlamlar paneli yig‘ilganmi */
  const [layersPanelCollapsed, setLayersPanelCollapsed] = useState(false);
  /** Hudud qo'shish paneli yig'ilganmi (ochilib-yopiladigan) */
  const [addAreaPanelCollapsed, setAddAreaPanelCollapsed] = useState(false);
  /** Demo hodisalar — har 30 sekundda tasodifiy hududda yaratiladi (Monitoring rejimi) */
  const [demoEvents, setDemoEvents] = useState<DemoEvent[]>([]);
  /** AI detection hodisalari — /api/ai-events/list dan real-time, kamera koordinatasida */
  const [aiDetectionEvents, setAIDetectionEvents] = useState<AIEventMap[]>([]);
  /** So'nggi hodisalar — yangi hodisa kelganda o'ng yuqorida 2 sekund ko'rsatiladi */
  const [showRecentEventsPanel, setShowRecentEventsPanel] = useState(false);
  const recentEventsHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevEventsCountRef = useRef(0);
  const [selectedCamera, setSelectedCamera] = useState<MockCamera | null>(null);
  const [eventAssignments, setEventAssignments] = useState<Record<string, EventAssignment>>({});
  const [incidentInspectorChoice, setIncidentInspectorChoice] = useState<string>('');
  const forestAreasRef = useRef(forestAreas);
  const contractsRef = useRef(contracts);
  forestAreasRef.current = forestAreas;
  contractsRef.current = contracts;

  /** Hodisalarni hududlar bilan bog'lash: har bir hodisa koordinatasi bo'yicha o'rmon va ijara (ijarachi) aniqlanadi */
  const eventAreaLinks = useMemo(() => {
    const links: Record<string, EventAreaLink> = {};
    for (const ev of MOCK_EVENTS) {
      links[ev.id] = getAreaForPoint(
        ev.lat,
        ev.lng,
        savedForestFeatures,
        savedLeaseFeatures,
        contracts.map((c) => ({ hudud: c.hudud, ijarachi: c.ijarachi }))
      );
    }
    return links;
  }, [savedForestFeatures, savedLeaseFeatures, contracts]);

  /** Ijara/bo'sh maydonlarni shu o'rmon ichida chizish uchun ro'yxat (faqat sessiyadagi upload) */
  const forestFeaturesFromUpload = useMemo(
    () => uploadedFeatures.filter((f) => (f.properties?.type as string) === 'forest') as UploadedFeature[],
    [uploadedFeatures]
  );

  /** Viloyat bo'yicha saqlangan o'rmon maydonlari — Rental/Free uchun "o'rmon tanlang" ro'yxati (API region_name yoki geometriya orqali) */
  const forestFeaturesInRegion = useMemo(() => {
    if (!selectedRegion) return [];
    const regionName = getRegionName(selectedRegion);
    const normRegion = normalizeForMatch(regionName);
    return savedForestFeatures.filter((f) => {
      const apiRegion = (f.properties?.region_name as string) ?? '';
      if (apiRegion && normalizeForMatch(apiRegion) === normRegion) return true;
      const geomRegion = getRegionNameForForestFeature(f, regionFeatures);
      return geomRegion != null && (geomRegion === regionName || normalizeForMatch(geomRegion) === normRegion);
    });
  }, [savedForestFeatures, selectedRegion, regionFeatures]);

  /** O'rmon maydoni uchun avtomatik yer statistikasi (tanlangan hudud forest bo'lsa): total, ijara yig'indisi, bo'sh yig'indisi, qolgan */
  const forestLandStats = useMemo(() => {
    if (!selectedAreaInfo?.hududNomi) return null;
    const name = selectedAreaInfo.hududNomi;
    const allForest = [
      ...savedForestFeatures.filter((f) => (f.properties?.name as string) === name || (name && ((f.properties?.name as string)?.includes(name) || name.includes((f.properties?.name as string) ?? '')))),
      ...uploadedFeatures.filter((f) => (f.properties?.type as string) === 'forest' && ((f.properties?.name as string) === name || (name && ((f.properties?.name as string)?.includes(name) || name.includes((f.properties?.name as string) ?? ''))))),
    ];
    const forestFeature = allForest[0];
    if (!forestFeature?.geometry || (forestFeature.geometry.type !== 'Polygon' && forestFeature.geometry.type !== 'MultiPolygon')) return null;
    const forestGeom = forestFeature.geometry as Polygon | MultiPolygon | GeometryCollection;
    const totalHa = (forestFeature.properties?.area_ha as number) ?? selectedAreaInfo.maydonHa ?? 0;

    const isInsideForest = (f: UploadedFeature): boolean => {
      if (!f.geometry || (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon')) return false;
      return polygonWithinRegionGeometry(
        { type: 'Feature', properties: {}, geometry: f.geometry as Polygon | MultiPolygon },
        forestGeom
      );
    };

    const rentalSum = [...savedLeaseFeatures, ...uploadedFeatures.filter((f) => (f.properties?.type as string) === 'lease')]
      .filter(isInsideForest)
      .reduce((s, f) => s + (f.properties?.area_ha ?? 0), 0);
    const freeSum = [...savedEmptyFeatures, ...uploadedFeatures.filter((f) => (f.properties?.type as string) === 'empty')]
      .filter(isInsideForest)
      .reduce((s, f) => s + (f.properties?.area_ha ?? 0), 0);
    const remaining = Math.max(0, totalHa - rentalSum - freeSum);

    return { totalHa, rentalSum, freeSum, remaining };
  }, [
    selectedAreaInfo?.hududNomi,
    selectedAreaInfo?.maydonHa,
    savedForestFeatures,
    savedLeaseFeatures,
    savedEmptyFeatures,
    uploadedFeatures,
  ]);

  /** Yuklangan ijara maydonlari yig'indisi (ga) — maydon avtomatik hisoblanadi */
  const leaseAreaHa = useMemo(
    () =>
      uploadedFeatures
        .filter((f) => (f.properties?.type as string) === 'lease')
        .reduce((sum, f) => sum + (f.properties?.area_ha ?? 0), 0),
    [uploadedFeatures]
  );
  /** Umumiy ijara narxi = maydon × tarif */
  const totalLeasePrice = leaseAreaHa * leaseTariffPerHa;

  /** Ijara o'zgarganda ochiq hudud panelidagi maydonlarni qayta hisobla */
  useEffect(() => {
    if (!selectedAreaInfo) return;
    const area = forestAreas.find(
      (a) =>
        a.name === selectedAreaInfo.hududNomi ||
        (selectedAreaInfo.hududNomi && (a.name.includes(selectedAreaInfo.hududNomi) || selectedAreaInfo.hududNomi.includes(a.name)))
    );
    const totalAreaHa = area?.maydon ?? selectedAreaInfo.totalAreaHa;
    const leasedAreaHa = area?.status === 'leased' ? (area.maydon ?? 0) : 0;
    const emptyAreaHa = totalAreaHa - leasedAreaHa;
    const effectiveStatus = area ? getEffectiveStatus(area) : selectedAreaInfo.status;
    setSelectedAreaInfo((prev) =>
      prev
        ? {
            ...prev,
            totalAreaHa,
            leasedAreaHa,
            emptyAreaHa,
            status: effectiveStatus,
          }
        : null
    );
  }, [forestAreas, selectedAreaInfo?.hududNomi]);

  refreshSavedRef.current = () => setSavedAreasVersion((v) => v + 1);

  useEffect(() => {
    if (selectedEventId) setIncidentInspectorChoice(eventAssignments[selectedEventId]?.inspectorId ?? '');
  }, [selectedEventId, eventAssignments]);

  const showEventsLayer = showMonitoringLayers && showEvents && showEventsOverlay;

  useEffect(() => {
    if (!showMonitoringLayers) setUnattendedAreaIds([]);
  }, [showMonitoringLayers]);

  useEffect(() => {
    if (!showEventsLayer) setSelectedEventId(null);
  }, [showEventsLayer]);

  useEffect(() => {
    if (!selectedEventId) alertSound.stop();
  }, [selectedEventId]);

  useEffect(() => {
    if (!showEventsLayer || !pendingEventId) return;
    const timer = setTimeout(() => {
      if (!mapRef.current) return;
      const ev = MOCK_EVENTS.find((e) => e.id === pendingEventId);
      if (ev) {
        setSelectedEventId(pendingEventId);
        mapRef.current.setView([ev.lat, ev.lng], 12);
      }
      setPendingEventId(null);
    }, 600);
    return () => clearTimeout(timer);
  }, [showEventsLayer, pendingEventId, setPendingEventId]);

  const initMap = useCallback(() => {
    if (!containerRef.current || mapRef.current) return;
    try {
      setMapError(null);
      const map = L.map(containerRef.current, { center: UZ_CENTER, zoom: UZ_ZOOM, zoomControl: false });
      const baseLayer = createBaseTileLayer(mapModeRef.current ?? 'land_management');
      baseLayer.addTo(map);
      baseLayerRef.current = baseLayer;
      L.control.zoom({ position: 'bottomleft' }).addTo(map);
      const updateZoom = () => setMapZoomLevel(map.getZoom());
      map.on('zoomend', updateZoom);
      map.on('moveend', updateZoom);
      updateZoom();
      mapRef.current = map;
    } catch (err) {
      console.error('[ForestCreateMap] initMap', err);
      setMapError('Xarita ishga tushirilmadi. Sahifani yangilab ko‘ring.');
    }
  }, []);

  useEffect(() => {
    initMap();
    return () => {
      baseLayerRef.current = null;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      regionsLayerRef.current = null;
      highlightLayerRef.current = null;
      uploadLayerRef.current = null;
      drawLayerRef.current = null;
      savedAreasLayerRef.current = null;
      camerasLayerRef.current = null;
      eventsLayerRef.current = null;
      heatmapLayerRef.current = null;
      riskPredictionLayerRef.current = null;
      inspectorsLayerRef.current = null;
      inspectorMarkersRef.current.clear();
      patrolRouteLayerRef.current = null;
      vehiclesLayerRef.current = null;
    };
  }, [initMap]);

  useEffect(() => {
    if (!mapRef.current || !baseLayerRef.current) return;
    const map = mapRef.current;
    map.removeLayer(baseLayerRef.current);
    const newBase = createBaseTileLayer(mapMode ?? 'land_management');
    newBase.addTo(map);
    baseLayerRef.current = newBase;
    map.invalidateSize();
  }, [mapMode]);

  useEffect(() => {
    if (!mapRef.current) return;
    camerasLayerRef.current?.remove();
    camerasLayerRef.current = null;
    if (!showMonitoringLayers) return;
    const group = (L as unknown as { markerClusterGroup: (o?: object) => L.LayerGroup }).markerClusterGroup({ maxClusterRadius: 50 });
    MOCK_CAMERAS.forEach((cam) => {
      const isOnline = cam.status === 'online';
      const hasEvent = cameraHasLinkedEvent(cam);
      const marker = L.marker([cam.lat, cam.lng], { icon: createCameraMarkerIcon(hasEvent) });
      const statusLabel = isOnline ? 'Onlayn' : 'O\'flayn';
      const eventNote = hasEvent ? '<p><span class="text-slate-500">Hodisa:</span> <span class="font-medium text-amber-600">Shu hududda hodisa bor</span></p>' : '';
      const popupContent = `<div class="text-sm min-w-[180px]">
        <div class="font-semibold text-slate-800 border-b border-slate-200 pb-1 mb-2">${escapeHtml(cam.name)}</div>
        <div class="space-y-1 text-xs">
          <p><span class="text-slate-500">Holat:</span> <span class="font-medium ${isOnline ? 'text-green-600' : 'text-red-600'}">${statusLabel}</span></p>
          <p><span class="text-slate-500">O'rmon hududi:</span> <span class="text-slate-800">${escapeHtml(cam.forestArea)}</span></p>
          ${eventNote}
          <p><span class="text-slate-500">So'nggi faol:</span> <span class="text-slate-800">${formatCameraTime(cam.lastActive)}</span></p>
          <p class="pt-2 mt-2 border-t border-slate-100">
            <button type="button" class="live-cam-btn font-medium text-forest-600 hover:text-forest-700 hover:underline cursor-pointer bg-transparent border-0 p-0 text-left">Live ko&apos;rish →</button>
          </p>
        </div>
      </div>`;
      marker.bindPopup(popupContent);
      marker.on('click', () => setSelectedCamera(cam));
      marker.on('popupopen', () => {
        const popup = marker.getPopup();
        const el = popup?.getElement();
        const btn = el?.querySelector<HTMLButtonElement>('button.live-cam-btn');
        if (btn) {
          btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            setSelectedCamera(cam);
          };
        }
      });
      group.addLayer(marker);
    });
    camerasLayerRef.current = group;
    return () => {
      camerasLayerRef.current?.remove();
      camerasLayerRef.current = null;
    };
  }, [showMonitoringLayers, setSelectedCamera]);

  useEffect(() => {
    if (!mapRef.current || !camerasLayerRef.current) return;
    if (mapZoomLevel >= MAP_ZOOM_THRESHOLDS.cameras && showCamerasOverlay) {
      camerasLayerRef.current.addTo(mapRef.current);
    } else {
      camerasLayerRef.current.remove();
    }
  }, [mapZoomLevel, showCamerasOverlay]);

  useEffect(() => {
    if (!mapRef.current) return;
    eventsLayerRef.current?.remove();
    eventsLayerRef.current = null;
    if (!showEventsLayer) return;
    const group = (L as unknown as { markerClusterGroup: (o?: object) => L.LayerGroup }).markerClusterGroup({
      maxClusterRadius: 60,
      iconCreateFunction: createEventClusterIcon,
    });
    MOCK_EVENTS.forEach((ev) => {
      const marker = L.marker([ev.lat, ev.lng], { icon: createEventIcon(ev.type, { pulse: true }) });
      const cfg = EVENT_TYPE_CONFIG[ev.type];
      const link = eventAreaLinks[ev.id];
      const forestDisplay = link?.forestName ?? ev.forestArea;
      const tenantDisplay = link?.rentalTenant ?? '—';
      const popupContent = `<div class="text-sm min-w-[200px]">
        <div class="font-semibold text-slate-800 border-b border-slate-200 pb-1 mb-2">${escapeHtml(cfg.label)}</div>
        <div class="space-y-1 text-xs">
          <p><span class="text-slate-500">Joy:</span> <span class="text-slate-800">${escapeHtml(ev.location)}</span></p>
          <p><span class="text-slate-500">Vaqt:</span> <span class="text-slate-800">${formatEventTime(ev.time)}</span></p>
          <p><span class="text-slate-500">O'rmon hududi:</span> <span class="text-slate-800">${escapeHtml(forestDisplay)}</span></p>
          <p><span class="text-slate-500">Ijarachi:</span> <span class="text-slate-800">${escapeHtml(tenantDisplay)}</span></p>
        </div>
      </div>`;
      marker.bindPopup(popupContent);
      marker.on('click', () => {
        setSelectedEventId(ev.id);
        if (ev.type === 'fire_risk') alertSound.play();
      });
      group.addLayer(marker);
    });
    demoEvents.forEach((ev) => {
      const marker = L.marker([ev.lat, ev.lng], { icon: createDemoEventIcon(ev.type, true) });
      const cfg = DEMO_EVENT_TYPE_CONFIG[ev.type];
      const popupContent = `<div class="text-sm min-w-[200px]">
        <div class="font-semibold text-slate-800 border-b border-slate-200 pb-1 mb-2">${escapeHtml(cfg.label)}</div>
        <div class="space-y-1 text-xs">
          <p><span class="text-slate-500">Hodisa turi:</span> <span class="text-slate-800">${escapeHtml(cfg.label)}</span></p>
          <p><span class="text-slate-500">Vaqt:</span> <span class="text-slate-800">${formatEventTime(ev.time)}</span></p>
          <p><span class="text-slate-500">Hudud:</span> <span class="text-slate-800">${escapeHtml(ev.regionName)}</span></p>
        </div>
      </div>`;
      marker.bindPopup(popupContent);
      group.addLayer(marker);
    });
    aiDetectionEvents.forEach((ev) => {
      const marker = L.marker([ev.lat, ev.lng], { icon: createAIEventIcon() });
      const imgPart = ev.imageUrl
        ? `<div class="mt-2"><img src="${ev.imageUrl.replace(/"/g, '&quot;')}" alt="Preview" class="w-full max-h-32 object-contain rounded border border-slate-200" /></div>`
        : '';
      const popupContent = `<div class="text-sm min-w-[200px]">
        <div class="font-semibold text-slate-800 border-b border-slate-200 pb-1 mb-2">AI aniqlandi</div>
        <div class="space-y-1 text-xs">
          <p><span class="text-slate-500">Kamera:</span> <span class="text-slate-800">${escapeHtml(ev.cameraName)}</span></p>
          <p><span class="text-slate-500">Vaqt:</span> <span class="text-slate-800">${formatEventTime(ev.timestamp)}</span></p>
        </div>
        ${imgPart}
      </div>`;
      marker.bindPopup(popupContent);
      group.addLayer(marker);
    });
    eventsLayerRef.current = group;
    if (mapRef.current && mapZoomLevel >= MAP_ZOOM_THRESHOLDS.events) {
      group.addTo(mapRef.current);
    }
    return () => {
      eventsLayerRef.current?.remove();
      eventsLayerRef.current = null;
    };
  }, [showEventsLayer, eventAreaLinks, demoEvents, aiDetectionEvents, mapZoomLevel]);

  /** Har 30 sekundda Monitoring rejimida tasodifiy hududda demo hodisa yaratish */
  useEffect(() => {
    if (mapMode !== 'monitoring' || !showEventsLayer) return;
    const areas: { name: string; geometry: Polygon | MultiPolygon }[] = [];
    if (savedForestFeatures.length > 0) {
      for (const f of savedForestFeatures) {
        if (f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')) {
          areas.push({
            name: (f.properties?.name as string) ?? 'O\'rmon hududi',
            geometry: f.geometry as Polygon | MultiPolygon,
          });
        }
      }
    }
    if (areas.length === 0 && regionFeatures.length > 0) {
      for (const f of regionFeatures) {
        if (f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')) {
          areas.push({
            name: getRegionName(f),
            geometry: f.geometry as Polygon | MultiPolygon,
          });
        }
      }
    }
    if (areas.length === 0) return;
    const tick = () => {
      const area = areas[Math.floor(Math.random() * areas.length)];
      const point = getRandomPointInGeometry(area.geometry);
      if (!point) return;
      const [lat, lng] = point;
      const type = DEMO_EVENT_TYPES[Math.floor(Math.random() * DEMO_EVENT_TYPES.length)];
      const event: DemoEvent = {
        id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        lat,
        lng,
        type,
        time: new Date().toISOString(),
        regionName: area.name,
      };
      setDemoEvents((prev) => [...prev, event].slice(-200));
      if (type === 'fire' || type === 'risk') alertSound.play();
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [mapMode, showEventsLayer, savedForestFeatures, regionFeatures]);

  /** AI detection hodisalarni real-time olish — har 3 sekundda /api/ai-events/list */
  useEffect(() => {
    if (mapMode !== 'monitoring' || !showEventsLayer) return;
    const fetchAIEvents = async () => {
      try {
        const res = await fetch('/api/ai-events/list');
        const data = await res.json();
        if (Array.isArray(data?.events)) setAIDetectionEvents(data.events);
      } catch {
        // ignore
      }
    };
    fetchAIEvents();
    const id = setInterval(fetchAIEvents, 3_000);
    return () => clearInterval(id);
  }, [mapMode, showEventsLayer]);

  /** Yangi hodisa kelganda So'nggi hodisalar panelini ko'rsatish va xaritani shu hududga zoom qilish */
  useEffect(() => {
    const total = demoEvents.length + aiDetectionEvents.length;
    if (total > prevEventsCountRef.current) {
      setShowRecentEventsPanel(true);
      const merged = [
        ...demoEvents.map((ev) => ({ lat: ev.lat, lng: ev.lng, time: new Date(ev.time).getTime() })),
        ...aiDetectionEvents.map((ev) => ({ lat: ev.lat, lng: ev.lng, time: new Date(ev.timestamp).getTime() })),
      ].sort((a, b) => b.time - a.time);
      const latest = merged[0];
      if (latest && mapRef.current) {
        mapRef.current.flyTo([latest.lat, latest.lng], 12, { animate: true, duration: 0.8 });
      }
      if (recentEventsHideTimerRef.current) clearTimeout(recentEventsHideTimerRef.current);
      recentEventsHideTimerRef.current = setTimeout(() => {
        recentEventsHideTimerRef.current = null;
        setShowRecentEventsPanel(false);
      }, 2000);
    }
    prevEventsCountRef.current = total;
    return () => {
      if (recentEventsHideTimerRef.current) clearTimeout(recentEventsHideTimerRef.current);
    };
  }, [demoEvents.length, aiDetectionEvents.length]);

  useEffect(() => {
    if (!mapRef.current || !eventsLayerRef.current) return;
    if (mapZoomLevel >= MAP_ZOOM_THRESHOLDS.events) {
      eventsLayerRef.current.addTo(mapRef.current);
    } else {
      eventsLayerRef.current.remove();
    }
  }, [mapZoomLevel]);

  useEffect(() => {
    if (!mapRef.current) return;
    inspectorsLayerRef.current?.remove();
    inspectorsLayerRef.current = null;
    inspectorMarkersRef.current.clear();
    if (!showMonitoringLayers || !showInspectorsAndPatrol) return;
    const group = L.layerGroup();
    const data = inspectorLiveDataRef.current;
    data.forEach((d) => {
      const marker = L.marker([d.lat, d.lng], { icon: createInspectorMarkerIcon(d.status) });
      marker.bindPopup(createInspectorPopupContent(d));
      marker.addTo(group);
      inspectorMarkersRef.current.set(d.id, marker);
    });
    inspectorsLayerRef.current = group;
    return () => {
      inspectorsLayerRef.current?.remove();
      inspectorsLayerRef.current = null;
      inspectorMarkersRef.current.clear();
    };
  }, [showMonitoringLayers, showInspectorsAndPatrol]);

  useEffect(() => {
    if (!mapRef.current || !inspectorsLayerRef.current) return;
    if (mapZoomLevel >= MAP_ZOOM_THRESHOLDS.inspectorsPatrol) {
      inspectorsLayerRef.current.addTo(mapRef.current);
    } else {
      inspectorsLayerRef.current.remove();
    }
  }, [mapZoomLevel]);

  useEffect(() => {
    if (mapZoomLevel < MAP_ZOOM_THRESHOLDS.inspectorsPatrol) {
      patrolRouteLayerRef.current?.remove();
    }
  }, [mapZoomLevel]);

  useEffect(() => {
    if (!mapRef.current) return;
    vehiclesLayerRef.current?.remove();
    vehiclesLayerRef.current = null;
    demoVehicleStateRef.current.clear();
    if (!showVehiclesAndRoutes) return;

    const group = L.layerGroup();
    const state = demoVehicleStateRef.current;

    DEMO_VEHICLES.forEach((v) => {
      const route = v.routePoints;
      if (route.length === 0) return;
      const [lat0, lng0] = route[0];
      const polyline = L.polyline([[lat0, lng0]], { color: '#2563eb', weight: 3, opacity: 0.7 });
      polyline.addTo(group);
      const marker = L.marker([lat0, lng0], { icon: createVehicleMarkerIcon(v.transportType) });
      marker.bindPopup(createDemoVehiclePopupContent(v, 0, v.speedKmh));
      marker.on('click', () => setSelectedVehicleId(v.id));
      marker.addTo(group);
      state.set(v.id, { routeIndex: 0, segmentT: 0, traveledKm: 0, polyline, marker });
    });

    group.addTo(mapRef.current);
    vehiclesLayerRef.current = group;

    const INTERVAL_MS = 800;
    const id = setInterval(() => {
      if (!mapRef.current || !vehiclesLayerRef.current) return;
      const nextLive: Record<string, { lat: number; lng: number; traveledKm: number; speedKmh: number; status: DemoVehicleStatus }> = {};
      DEMO_VEHICLES.forEach((v) => {
        const s = state.get(v.id);
        if (!s || v.routePoints.length < 2) return;
        const route = v.routePoints;
        const idx = s.routeIndex;
        const nextIdx = (idx + 1) % route.length;
        const [prevLat, prevLng] = route[idx];
        const [nextLat, nextLng] = route[nextIdx];
        const segmentKm = distanceKm(prevLat, prevLng, nextLat, nextLng);
        const step = 0.06 + Math.random() * 0.18;
        let t = s.segmentT + step;
        if (t >= 1) {
          t = t - 1;
          s.routeIndex = nextIdx;
        }
        s.segmentT = t;
        const lat = prevLat + t * (nextLat - prevLat);
        const lng = prevLng + t * (nextLng - prevLng);
        s.traveledKm += segmentKm * step;
        s.polyline.addLatLng(L.latLng(lat, lng));
        s.marker.setLatLng([lat, lng]);
        const displaySpeed = Math.round(v.speedKmh * (0.75 + Math.random() * 0.5));
        const popup = s.marker.getPopup();
        if (popup) popup.setContent(createDemoVehiclePopupContent(v, s.traveledKm, displaySpeed));
        nextLive[v.id] = { lat, lng, traveledKm: s.traveledKm, speedKmh: displaySpeed, status: 'moving' };
      });
      setDemoVehicleLiveState((prev) => ({ ...prev, ...nextLive }));
    }, INTERVAL_MS);

    return () => {
      clearInterval(id);
      vehiclesLayerRef.current?.remove();
      vehiclesLayerRef.current = null;
      demoVehicleStateRef.current.clear();
    };
  }, [showVehiclesAndRoutes]);

  useEffect(() => {
    if (!mapRef.current || !showMonitoringLayers || !showInspectorsAndPatrol) return;
    const INTERVAL_MS = 4000;
    const MOVE_DELTA = 0.008;
    const id = setInterval(() => {
      const data = inspectorLiveDataRef.current;
      data.forEach((d) => {
        d.lat += (Math.random() - 0.5) * 2 * MOVE_DELTA;
        d.lng += (Math.random() - 0.5) * 2 * MOVE_DELTA;
        d.lat = Math.max(38.5, Math.min(44, d.lat));
        d.lng = Math.max(56, Math.min(74, d.lng));
        if (Math.random() < 0.15) d.status = d.status === 'available' ? 'busy' : 'available';
        const marker = inspectorMarkersRef.current.get(d.id);
        if (marker) {
          marker.setLatLng([d.lat, d.lng]);
          marker.setIcon(createInspectorMarkerIcon(d.status));
          const popup = marker.getPopup();
          if (popup) popup.setContent(createInspectorPopupContent(d));
        }
      });
      const centroids = savedAreaCentroidsRef.current;
      const unattended: string[] = [];
      centroids.forEach(([areaLat, areaLng], areaId) => {
        let minDistKm = Infinity;
        data.forEach((insp) => {
          const km = distanceKm(areaLat, areaLng, insp.lat, insp.lng);
          if (km < minDistKm) minDistKm = km;
        });
        if (minDistKm > ATTENDANCE_RADIUS_KM) unattended.push(areaId);
      });
      setUnattendedAreaIds(unattended);
      if (showPatrolRoutesRef.current && mapRef.current) {
        const completed = completedPatrolAreaIdsRef.current;
        const effective = unattended.filter((id) => !completed.includes(id));
        if (effective.length > 0) {
          patrolRouteLayerRef.current?.remove();
          const group = L.layerGroup();
          effective.forEach((areaId) => {
          const centroid = savedAreaCentroidsRef.current.get(areaId);
          if (!centroid) return;
          const [areaLat, areaLng] = centroid;
          let nearestInspector: InspectorLiveData | null = null;
          let minKm = Infinity;
          data.forEach((insp) => {
            const km = distanceKm(areaLat, areaLng, insp.lat, insp.lng);
            if (km < minKm) {
              minKm = km;
              nearestInspector = insp;
            }
          });
          if (nearestInspector) {
            const insp = nearestInspector as InspectorLiveData;
            L.polyline(
              [[insp.lat, insp.lng], [areaLat, areaLng]],
              { color: '#2563eb', weight: 4, opacity: 0.9 }
            ).addTo(group);
          }
        });
        patrolRouteLayerRef.current = group;
        if (mapZoomLevelRef.current >= MAP_ZOOM_THRESHOLDS.inspectorsPatrol) {
          group.addTo(mapRef.current);
        }
        } else {
          patrolRouteLayerRef.current?.remove();
          patrolRouteLayerRef.current = null;
        }
      }
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, [showMonitoringLayers, showInspectorsAndPatrol]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/v1/forest-areas')
      .then((r) => r.json())
      .then((rows: Array<{ id?: string; region_name?: string; name?: string; type?: string; area_ha?: number; responsible?: string; geometry?: Polygon | MultiPolygon | string }>) => {
        if (cancelled || !mapRef.current || !Array.isArray(rows)) return;
        const parseGeom = (g: Polygon | MultiPolygon | string | undefined): Polygon | MultiPolygon | null =>
          !g ? null : typeof g === 'string' ? (JSON.parse(g) as Polygon | MultiPolygon) : g;
        const features = rows
          .map((r) => ({ ...r, geometry: parseGeom(r.geometry) }))
          .filter((r): r is typeof r & { geometry: Polygon | MultiPolygon } => r.geometry != null && (r.geometry.type === 'Polygon' || r.geometry.type === 'MultiPolygon'))
          .map((r) => ({
            type: 'Feature' as const,
            properties: {
              id: r.id,
              name: r.name ?? 'Hudud',
              type: r.type ?? 'forest',
              area_ha: r.area_ha ?? 0,
              region_name: r.region_name,
              responsible: r.responsible,
            },
            geometry: r.geometry!,
          }));
        setSavedCount(features.length);
        savedAreasLayerRef.current?.remove();
        savedAreaCentroidsRef.current.clear();
        savedAreaMetaRef.current.clear();
        if (features.length === 0) {
          setSavedForestFeatures([]);
          setSavedLeaseFeatures([]);
          setSavedEmptyFeatures([]);
          return;
        }
        const getStatusForFeature = (name: string): EffectiveAreaStatus => {
          const area = forestAreas.find(
            (a) => a.name === name || (name && (a.name.includes(name) || name.includes(a.name)))
          );
          return area ? getEffectiveStatus(area) : 'empty';
        };
        features.forEach((f) => {
          const id = (f.properties as Record<string, unknown>)?.id as string | undefined;
          if (id && f.geometry) {
            const centroid = getCentroidFromFeature(f.geometry);
            savedAreaCentroidsRef.current.set(id, centroid);
          }
        });
        const areaType = (f: (typeof features)[0]) => ((f.properties as Record<string, unknown>)?.type as string) ?? 'forest';
        const forestFeatures = features.filter((f) => areaType(f) === 'forest');
        const emptyFeatures = features.filter((f) => areaType(f) === 'empty');
        const leaseFeatures = features.filter((f) => areaType(f) === 'lease');
        setSavedForestFeatures(forestFeatures as UploadedFeature[]);
        setSavedLeaseFeatures(leaseFeatures as UploadedFeature[]);
        setSavedEmptyFeatures(emptyFeatures as UploadedFeature[]);
        const group = L.layerGroup();
        const addSavedLayer = (feats: typeof features, style: L.PathOptions, type: string) => {
          if (feats.length === 0) return;
          const layer = L.geoJSON(
            { type: 'FeatureCollection', features: feats } as FeatureCollection,
            {
              style: () => style,
              onEachFeature: (feature, lyr) => {
                const props = feature.properties as Record<string, unknown>;
                const id = props?.id as string | undefined;
                const name = (props?.name || 'Hudud') as string;
                if (id) savedAreaMetaRef.current.set(id, { name, layer: lyr as L.Path, type });
                const areaHa = (props?.area_ha ?? 0) as number;
                const status = getStatusForFeature(name);
                const statusLabel = STATUS_LABEL[status];
                lyr.on('click', () => {
                  setSelectedAreaId(id ?? null);
                  const areas = forestAreasRef.current;
                  const contractsList = contractsRef.current;
                  const area = areas.find((a) => a.name === name || (name && (a.name.includes(name) || name.includes(a.name))));
                  const contract = contractsList.find((c) => c.hudud === name || (name && (c.hudud.includes(name) || name.includes(c.hudud))));
                  const effectiveStatus = area ? getEffectiveStatus(area) : 'empty';
                  const totalAreaHa = area?.maydon ?? areaHa;
                  const leasedAreaHa = area?.status === 'leased' ? (area.maydon ?? 0) : 0;
                  const emptyAreaHa = totalAreaHa - leasedAreaHa;
                  setSelectedAreaInfo({
                    hududNomi: name,
                    maydonHa: areaHa,
                    totalAreaHa,
                    leasedAreaHa,
                    emptyAreaHa,
                    status: effectiveStatus,
                    ijarachi: contract?.ijarachi ?? '—',
                    contractEndDate: area?.contractEndDate ?? contract?.tugashSanasi ?? '—',
                    leasePaymentMonthly: area ? (contract?.monthlyAmount ?? 0) : (contract?.monthlyAmount ?? 0),
                    cameras: mockCamerasForArea(name),
                  });
                });
                const popupContent = document.createElement('div');
                popupContent.className = 'text-sm';
                popupContent.innerHTML = `<div><b>${name}</b></div><div>Maydon: <b>${Number(areaHa).toLocaleString('uz')} ga</b></div><div class="text-slate-500 text-xs mt-1">Holat: ${statusLabel}</div>`;
                if (id) {
                  const btn = document.createElement('button');
                  btn.type = 'button';
                  btn.textContent = "O'chirish";
                  btn.className = 'mt-2 w-full py-1.5 px-2 rounded bg-red-100 text-red-700 text-xs font-medium hover:bg-red-200';
                  btn.onclick = async () => {
                    try {
                      await fetch(`/api/v1/forest-areas/${id}`, { method: 'DELETE' });
                      refreshSavedRef.current();
                      lyr.closePopup?.();
                    } catch {}
                  };
                  popupContent.appendChild(btn);
                }
                lyr.bindPopup(popupContent);
              },
            }
          );
          layer.addTo(group);
        };
        addSavedLayer(forestFeatures, FOREST_LAYER_STYLE, 'forest');
        if (showLeaseAndEmptyAreasRef.current) {
          addSavedLayer(emptyFeatures, EMPTY_LAYER_STYLE, 'empty');
          addSavedLayer(leaseFeatures, LEASE_LAYER_STYLE, 'lease');
        }
        group.addTo(mapRef.current);
        savedAreasLayerRef.current = group;
        regionsLayerRef.current?.bringToBack?.();
        updateSavedAreaStylesRef.current?.();
        const data = inspectorLiveDataRef.current;
        const centroids = savedAreaCentroidsRef.current;
        const unattended: string[] = [];
        centroids.forEach(([areaLat, areaLng], areaId) => {
          let minDistKm = Infinity;
          data.forEach((insp) => {
            const km = distanceKm(areaLat, areaLng, insp.lat, insp.lng);
            if (km < minDistKm) minDistKm = km;
          });
          if (minDistKm > ATTENDANCE_RADIUS_KM) unattended.push(areaId);
        });
        setUnattendedAreaIds(unattended);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      savedAreasLayerRef.current?.remove();
      savedAreasLayerRef.current = null;
    };
  }, [savedAreasVersion, forestAreas, getEffectiveStatus]);

  useEffect(() => {
    let cancelled = false;
    fetch(REGIONS_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((fc: unknown) => {
        if (cancelled) return;
        const features = (fc && typeof fc === 'object' && 'features' in fc && Array.isArray((fc as FeatureCollection).features))
          ? ((fc as FeatureCollection).features || []) as RegionFeature[]
          : [];
        setRegionFeatures(sortRegions(features));
      })
      .catch((err) => {
        if (!cancelled) setUploadError('Viloyatlar xaritasi yuklanmadi.');
        console.error('[ForestCreateMap] regions fetch', err);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!mapRef.current || regionFeatures.length === 0) return;
    const forMap = regionFeatures.flatMap((f) =>
      flattenFeature({ type: 'Feature', properties: f.properties, geometry: f.geometry })
    );
    if (forMap.length === 0) return;
    regionsLayerRef.current?.remove();
    try {
      const layer = L.geoJSON(
        { type: 'FeatureCollection', features: forMap } as FeatureCollection,
        {
          style: () => REGION_STYLE,
          onEachFeature: (feature, lyr) => {
            lyr.on('click', () => {
              const regionName = (feature?.properties?.ADM1_UZ || feature?.properties?.ADM1_EN || feature?.properties?.ADM1_RU) as string | undefined;
              const region = regionFeatures.find((f) => getRegionName(f) === (regionName || ''));
              if (region) {
                setSelectedRegion(region);
                const layerObj = lyr as L.Polygon;
                if (layerObj.getBounds && mapRef.current) {
                  mapRef.current.fitBounds(layerObj.getBounds().pad(0.1), { maxZoom: 11 });
                }
              }
            });
          },
        }
      ).addTo(mapRef.current);
      regionsLayerRef.current = layer;
    } catch (err) {
      console.error('[ForestCreateMap] regions layer', err);
    }
    return () => {
      regionsLayerRef.current?.remove();
      regionsLayerRef.current = null;
    };
  }, [regionFeatures]);

  useEffect(() => {
    if (!mapRef.current || !showMonitoringLayers || !showHeatmapAndRisk || !riskHeatmapOn || regionFeatures.length === 0) {
      heatmapLayerRef.current?.remove();
      heatmapLayerRef.current = null;
      return;
    }
    const eventCountByRegion = getEventCountByRegion(regionFeatures, MOCK_EVENTS);
    const forMap = regionFeatures.flatMap((f) =>
      flattenFeature({ type: 'Feature', properties: f.properties, geometry: f.geometry })
    );
    if (forMap.length === 0) return;
    heatmapLayerRef.current?.remove();
    try {
      const layer = L.geoJSON(
        { type: 'FeatureCollection', features: forMap } as FeatureCollection,
        {
          style: (feature) => {
            const regionName = (feature?.properties?.ADM1_UZ || feature?.properties?.ADM1_EN || feature?.properties?.ADM1_RU) as string | undefined;
            const count = regionName != null ? (eventCountByRegion[regionName] ?? 0) : 0;
            const risk = getRiskLevel(count);
            return { weight: 2, ...RISK_HEATMAP_STYLE[risk] };
          },
        }
      ).addTo(mapRef.current);
      heatmapLayerRef.current = layer;
    } catch (err) {
      console.error('[ForestCreateMap] heatmap layer', err);
    }
    return () => {
      heatmapLayerRef.current?.remove();
      heatmapLayerRef.current = null;
    };
  }, [showMonitoringLayers, showHeatmapAndRisk, riskHeatmapOn, regionFeatures]);

  useEffect(() => {
    if (!mapRef.current || !showMonitoringLayers || !showHeatmapAndRisk || regionFeatures.length === 0) {
      riskPredictionLayerRef.current?.remove();
      riskPredictionLayerRef.current = null;
      return;
    }
    const eventCountByRegion = getEventCountByRegion(regionFeatures, MOCK_EVENTS);
    const forMap = regionFeatures.flatMap((f) =>
      flattenFeature({ type: 'Feature', properties: f.properties, geometry: f.geometry })
    );
    if (forMap.length === 0) return;
    riskPredictionLayerRef.current?.remove();
    try {
      const layer = L.geoJSON(
        { type: 'FeatureCollection', features: forMap } as FeatureCollection,
        {
          style: (feature) => {
            const regionName = (feature?.properties?.ADM1_UZ || feature?.properties?.ADM1_EN || feature?.properties?.ADM1_RU) as string | undefined;
            const count = regionName != null ? (eventCountByRegion[regionName] ?? 0) : 0;
            const risk = getPredictionRiskLevel(count);
            const s = RISK_PREDICTION_STYLE[risk];
            return { weight: 2, fillColor: s.fillColor, color: s.color, fillOpacity: s.fillOpacity, dashArray: s.dashArray };
          },
        }
      ).addTo(mapRef.current);
      riskPredictionLayerRef.current = layer;
    } catch (err) {
      console.error('[ForestCreateMap] risk prediction layer', err);
    }
    return () => {
      riskPredictionLayerRef.current?.remove();
      riskPredictionLayerRef.current = null;
    };
  }, [showMonitoringLayers, showHeatmapAndRisk, regionFeatures]);

  useEffect(() => {
    if (!mapRef.current || !showMonitoringLayers || !showInspectorsAndPatrol) {
      patrolRouteLayerRef.current?.remove();
      patrolRouteLayerRef.current = null;
      return;
    }
    if (!showPatrolRoutes || effectiveUnattendedIds.length === 0) {
      patrolRouteLayerRef.current?.remove();
      patrolRouteLayerRef.current = null;
      return;
    }
    const inspectors = inspectorLiveDataRef.current;
    const centroids = savedAreaCentroidsRef.current;
    const group = L.layerGroup();
    effectiveUnattendedIds.forEach((areaId) => {
      const centroid = centroids.get(areaId);
      if (!centroid) return;
      const [areaLat, areaLng] = centroid;
      let nearestInspector: InspectorLiveData | null = null;
      let minKm = Infinity;
      inspectors.forEach((insp) => {
        const km = distanceKm(areaLat, areaLng, insp.lat, insp.lng);
        if (km < minKm) {
          minKm = km;
          nearestInspector = insp;
        }
      });
      if (nearestInspector) {
        const insp = nearestInspector as InspectorLiveData;
        const line = L.polyline(
          [[insp.lat, insp.lng], [areaLat, areaLng]],
          { color: '#2563eb', weight: 4, opacity: 0.9 }
        );
        line.addTo(group);
      }
    });
    patrolRouteLayerRef.current = group;
    if (mapZoomLevel >= MAP_ZOOM_THRESHOLDS.inspectorsPatrol) {
      group.addTo(mapRef.current);
    }
    return () => {
      patrolRouteLayerRef.current?.remove();
      patrolRouteLayerRef.current = null;
    };
  }, [showMonitoringLayers, showInspectorsAndPatrol, showPatrolRoutes, effectiveUnattendedIds, mapZoomLevel]);

  const selectedRegionId = selectedRegion ? getRegionName(selectedRegion) : '';

  useEffect(() => {
    if (!mapRef.current) return;
    highlightLayerRef.current?.remove();
    if (!selectedRegion) {
      highlightLayerRef.current = null;
      return;
    }
    const layer = L.geoJSON(
      { type: 'Feature', properties: selectedRegion.properties, geometry: selectedRegion.geometry } as Feature,
      { style: () => HIGHLIGHT_STYLE }
    ).addTo(mapRef.current);
    highlightLayerRef.current = layer;
  }, [selectedRegion]);

  useEffect(() => {
    if (!mapRef.current || uploadedFeatures.length === 0) {
      uploadLayerRef.current?.remove();
      uploadLayerRef.current = null;
      return;
    }
    uploadLayerRef.current?.remove();
    const areaType = (f: UploadedFeature) => ((f.properties?.type as string) ?? 'forest').toLowerCase();
    const forestUpload = uploadedFeatures.filter((f) => areaType(f) === 'forest' || areaType(f) === "o'rmon");
    const emptyUpload = uploadedFeatures.filter((f) => areaType(f) === 'empty' || areaType(f) === "bo'sh");
    const leaseUpload = uploadedFeatures.filter((f) => areaType(f) === 'lease' || areaType(f) === 'ijara');
    const riskUpload = uploadedFeatures.filter((f) => areaType(f) === 'risk' || areaType(f) === 'xavf');
    const group = L.layerGroup();
    const addUploadLayer = (feats: UploadedFeature[], style: L.PathOptions) => {
      if (feats.length === 0) return;
      const layer = L.geoJSON(
        { type: 'FeatureCollection', features: feats } as FeatureCollection,
        {
          style: () => style,
          onEachFeature: (feature, lyr) => {
            const name = (feature.properties?.name || feature.properties?.region || 'Hudud') as string;
            const areaHa = (feature.properties?.area_ha ?? 0) as number;
            const type = (feature.properties?.type as string) ?? 'forest';
            const responsible = (feature.properties?.responsible as string) ?? '—';
            const typeLabel = type === 'forest' ? "O'rmon" : type === 'lease' ? 'Ijara' : type === 'empty' ? "Bo'sh yer" : 'Xavf';
            const popup = `<div class="text-sm"><b>${name}</b></div>
              <div>Maydon: <b>${areaHa.toLocaleString('uz')} ga</b></div>
              <div>Turi: ${typeLabel}</div>
              <div>Mas'ul: ${responsible}</div>`;
            lyr.bindPopup(popup);
          },
        }
      );
      layer.addTo(group);
    };
    addUploadLayer(forestUpload, FOREST_LAYER_STYLE);
    addUploadLayer(emptyUpload, EMPTY_LAYER_STYLE);
    addUploadLayer(leaseUpload, LEASE_LAYER_STYLE);
    addUploadLayer(riskUpload, { color: '#b91c1c', weight: 2, fillColor: '#ef4444', fillOpacity: 0.4 });
    group.addTo(mapRef.current);
    uploadLayerRef.current = group;
    regionsLayerRef.current?.bringToBack?.();
    (savedAreasLayerRef.current as unknown as { bringToBack?: () => void })?.bringToBack?.();
  }, [uploadedFeatures]);

  useEffect(() => {
    if (!mapRef.current) return;
    drawLayerRef.current?.remove();
    drawLayerRef.current = null;
    if (drawPoints.length === 0) return;
    const group = L.layerGroup().addTo(mapRef.current);
    const stroke = drawAreaType === 'lease' ? '#ca8a04' : drawAreaType === 'empty' ? '#6b7280' : '#166534';
    const fill = drawAreaType === 'lease' ? '#eab308' : drawAreaType === 'empty' ? '#9ca3af' : '#22c55e';
    const latlngs = drawPoints.map(([lat, lng]) => L.latLng(lat, lng));
    L.polyline(latlngs, { color: stroke, weight: 3, dashArray: '8,8' }).addTo(group);
    drawPoints.forEach(([lat, lng]) => {
      L.circleMarker([lat, lng], { radius: 6, fillColor: fill, color: stroke, weight: 2, fillOpacity: 1 }).addTo(group);
    });
    drawLayerRef.current = group;
    return () => {
      drawLayerRef.current?.remove();
      drawLayerRef.current = null;
    };
  }, [drawPoints, drawAreaType]);

  useEffect(() => {
    if (!mapRef.current || inputMode !== 'map' || !drawingMode) return;
    const map = mapRef.current;
    const onMapClick = (e: L.LeafletMouseEvent) => {
      if (!drawAreaType) return;
      const pt: [number, number] = [e.latlng.lng, e.latlng.lat];
      if (drawAreaType === 'forest') {
        if (!selectedRegion) {
          setDrawError("Avval viloyatni tanlang. Kontur faqat tanlangan viloyat chegarasida bo'lishi kerak.");
          return;
        }
        const geom = selectedRegion.geometry as Polygon | MultiPolygon | GeometryCollection;
        if (!pointInRegionGeometry(pt, geom)) {
          setDrawError("Nuqta tanlangan viloyat chegarasida emas. Faqat viloyat ichida belgilang.");
          return;
        }
      } else {
        if (!selectedForestFeature?.geometry) {
          setDrawError("Avval o'rmon maydonini tanlang. Ijara yoki bo'sh maydon faqat o'rmon ichida chiziladi.");
          return;
        }
        const geom = selectedForestFeature.geometry as Polygon | MultiPolygon | GeometryCollection;
        if (!pointInRegionGeometry(pt, geom)) {
          setDrawError("Nuqta tanlangan o'rmon chegarasida emas. Faqat o'rmon maydoni ichida belgilang.");
          return;
        }
      }
      setDrawError(null);
      setDrawPoints((prev) => [...prev, [e.latlng.lat, e.latlng.lng]]);
    };
    map.on('click', onMapClick);
    return () => {
      map.off('click', onMapClick);
    };
  }, [drawingMode, inputMode, selectedRegion, drawAreaType, selectedForestFeature]);

  /** Rental/Free: zoom map to selected forest polygon when user selects a forest area */
  useEffect(() => {
    if (!mapRef.current || !selectedForestFeature?.geometry || drawAreaType === 'forest') return;
    const geom = selectedForestFeature.geometry;
    if (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon') return;
    const layer = L.geoJSON(selectedForestFeature as Feature<Polygon | MultiPolygon>);
    const bounds = layer.getBounds();
    layer.remove();
    if (bounds.isValid()) {
      mapRef.current.fitBounds(bounds.pad(0.1), { maxZoom: 11 });
    }
  }, [selectedForestFeature, drawAreaType]);

  const closeDrawPolygon = () => {
    setDrawError(null);
    if (drawPoints.length < 3) return;
    const ring = [...drawPoints, drawPoints[0]];
    const coordinates = [ring.map(([lat, lng]) => [lng, lat])];
    const drawnPolygon: Polygon = { type: 'Polygon', coordinates };

    if (drawAreaType === 'forest') {
      if (!selectedRegion?.geometry) {
        setDrawError("Avval viloyatni tanlang. Kontur faqat tanlangan viloyat chegarasida bo'lishi kerak.");
        return;
      }
      const geom = selectedRegion.geometry as Polygon | MultiPolygon | GeometryCollection;
      const clipped = clipDrawnToRegion(drawnPolygon, geom);
      if (!clipped) {
        setDrawError("Kontur tanlangan viloyat chegarasida maydon hosil qilmadi. Faqat viloyat ichida kontur yarating.");
        return;
      }
      const areaHa = calcAreaHa(clipped);
      if (areaHa < 0.01) {
        setDrawError("Kontur maydoni juda kichik yoki viloyat chegarasida emas. Viloyat ichida aniq belgilang.");
        return;
      }
      const regionName = selectedRegion ? getRegionName(selectedRegion) : '';
      const existingForest = [
        ...uploadedFeatures.filter((f) => (f.properties?.type as string) === 'forest'),
        ...savedForestFeatures.filter((f) => (f.properties?.region_name as string) === regionName),
      ];
      for (const existing of existingForest) {
        if (!existing.geometry || (existing.geometry.type !== 'Polygon' && existing.geometry.type !== 'MultiPolygon')) continue;
        if (polygonsOverlap(clipped, existing.geometry as Polygon | MultiPolygon)) {
          setDrawError('Kontur boshqa o\'rmon maydoni bilan ustma-ust tushmoqda. Hech qanday kontur bir-birini ustiga tushmasligi kerak.');
          return;
        }
      }
      const feature: UploadedFeature = {
        type: 'Feature',
        properties: { name: forestName || 'Xaritada belgilangan', area_ha: areaHa, type: 'forest' },
        geometry: clipped,
      };
      setUploadedFeatures((prev) => [...prev, feature]);
      setTotalAreaHa((prev) => prev + areaHa);
      setDrawPoints([]);
      return;
    }

    // Lease yoki bo'sh: faqat tanlangan o'rmon maydoni ichida
    if (!selectedForestFeature?.geometry) {
      setDrawError("Avval o'rmon maydonini tanlang. Ijara yoki bo'sh maydon faqat o'rmon ichida chiziladi.");
      return;
    }
    const forestGeom = selectedForestFeature.geometry as Polygon | MultiPolygon | GeometryCollection;
    for (const [lat, lng] of drawPoints) {
      const pt: [number, number] = [lng, lat];
      if (!pointInRegionGeometry(pt, forestGeom)) {
        setDrawError("Kontur o'rmon chegarasidan tashqarida. Faqat tanlangan o'rmon maydoni ichida chizing.");
        return;
      }
    }
    const clipped = clipDrawnToRegion(drawnPolygon, forestGeom);
    if (!clipped) {
      setDrawError("Kontur tanlangan o'rmon chegarasida maydon hosil qilmadi. Faqat o'rmon ichida kontur yarating.");
      return;
    }
    const areaHa = calcAreaHa(clipped);
    if (areaHa < 0.01) {
      setDrawError("Kontur maydoni juda kichik yoki o'rmon chegarasida emas. O'rmon ichida aniq belgilang.");
      return;
    }
    const existingLeaseOrEmpty = [
      ...uploadedFeatures.filter(
        (f) => (f.properties?.type as string) === 'lease' || (f.properties?.type as string) === 'empty'
      ),
      ...savedLeaseFeatures,
      ...savedEmptyFeatures,
    ];
    for (const existing of existingLeaseOrEmpty) {
      if (!existing.geometry || (existing.geometry.type !== 'Polygon' && existing.geometry.type !== 'MultiPolygon')) continue;
      if (polygonsOverlap(clipped, existing.geometry as Polygon | MultiPolygon)) {
        setDrawError('Kontur boshqa hudud bilan ustma-ust tushmoqda. Hech qanday kontur bir-birini ustiga tushmasligi kerak.');
        return;
      }
    }
    const feature: UploadedFeature = {
      type: 'Feature',
      properties: { name: forestName || 'Xaritada belgilangan', area_ha: areaHa, type: drawAreaType ?? 'forest' },
      geometry: clipped,
    };
    setUploadedFeatures((prev) => [...prev, feature]);
    setTotalAreaHa((prev) => prev + areaHa);
    setDrawPoints([]);
  };

  const cancelDraw = () => {
    setDrawPoints([]);
    setDrawAreaType(null);
    setSelectedForestFeature(null);
    setInputMode('file');
  };

  const handleRegionSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (!value) {
      setSelectedRegion(null);
      setSelectedForestFeature(null);
      return;
    }
    const feature = regionFeatures.find((f) => getRegionName(f) === value);
    if (feature) {
      setSelectedRegion(feature);
      setSelectedForestFeature(null);
      const layer = L.geoJSON(feature);
      const bounds = layer.getBounds();
      layer.remove();
      if (mapRef.current && bounds.isValid()) {
        mapRef.current.fitBounds(bounds.pad(0.1), { maxZoom: 11 });
      }
    }
  };

  const processGeoJSON = (raw: unknown): void => {
    let inputFeatures = normalizeToFeatures(raw);
    if (inputFeatures.length === 0) {
      const collected: Array<{ type: string; properties: Record<string, unknown>; geometry: Polygon | MultiPolygon }> = [];
      deepCollectPolygons(raw, collected);
      inputFeatures = collected;
    }
    let flatFeatures = inputFeatures.flatMap((f) =>
      flattenFeature({ type: 'Feature', properties: f.properties, geometry: f.geometry })
    );
    const clipGeom =
      drawAreaType === 'forest'
        ? (selectedRegion?.geometry as Polygon | MultiPolygon | GeometryCollection | undefined)
        : (selectedForestFeature?.geometry as Polygon | MultiPolygon | GeometryCollection | undefined);
    if (clipGeom && flatFeatures.length > 0) {
      const clippedFeatures: Array<Feature<Polygon | MultiPolygon, Record<string, unknown>>> = [];
      for (const f of flatFeatures) {
        const clipped = clipGeometryToRegion(f.geometry, clipGeom);
        if (clipped && calcAreaHa(clipped) >= 0.01) {
          clippedFeatures.push({
            type: 'Feature',
            properties: { ...f.properties, area_ha: calcAreaHa(clipped) },
            geometry: clipped,
          });
        }
      }
      flatFeatures = clippedFeatures;
      if (flatFeatures.length === 0) {
        const msg =
          drawAreaType === 'forest'
            ? `Fayldagi konturlar tanlangan viloyat (${selectedRegion ? getRegionName(selectedRegion) : ''}) chegarasida maydon hosil qilmadi.`
            : "Fayldagi konturlar tanlangan o'rmon maydoni chegarasida maydon hosil qilmadi. Faqat o'rmon ichidagi qism qo'shiladi.";
        setUploadError(msg);
        return;
      }
    } else {
      flatFeatures = flatFeatures.map((f) => ({
        ...f,
        properties: { ...f.properties, area_ha: calcAreaHa(f.geometry) },
      }));
    }
    const withArea: UploadedFeature[] = flatFeatures.map((f) => {
      const areaHa = (f.properties?.area_ha as number | undefined) ?? calcAreaHa(f.geometry);
      return {
        ...f,
        properties: { ...f.properties, area_ha: areaHa, type: drawAreaType ?? 'forest' },
      };
    });
    if (withArea.length === 0) {
      setUploadError('Faylda Polygon yoki MultiPolygon topilmadi. Faqat maydon (polygon) qo‘llab-quvvatlanadi.');
      return;
    }
    const regionName = selectedRegion ? getRegionName(selectedRegion) : '';
    const existingForOverlap =
      drawAreaType === 'forest'
        ? [
            ...uploadedFeatures.filter((f) => (f.properties?.type as string) === 'forest'),
            ...savedForestFeatures.filter((f) => (f.properties?.region_name as string) === regionName),
          ]
        : [
            ...uploadedFeatures.filter(
              (f) => (f.properties?.type as string) === 'lease' || (f.properties?.type as string) === 'empty'
            ),
            ...savedLeaseFeatures,
            ...savedEmptyFeatures,
          ];
    const accepted: UploadedFeature[] = [];
    for (const feat of withArea) {
      const geom = feat.geometry;
      if (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon') continue;
      for (const existing of existingForOverlap) {
        if (!existing.geometry || (existing.geometry.type !== 'Polygon' && existing.geometry.type !== 'MultiPolygon')) continue;
        if (polygonsOverlap(geom, existing.geometry as Polygon | MultiPolygon)) {
          setUploadError(
            'Fayldagi kontur(lar) mavjud hudud(lar) bilan ustma-ust tushmoqda. Hech qanday kontur bir-birini ustiga tushmasligi kerak.'
          );
          return;
        }
      }
      for (const other of accepted) {
        if (!other.geometry || (other.geometry.type !== 'Polygon' && other.geometry.type !== 'MultiPolygon')) continue;
        if (polygonsOverlap(geom, other.geometry as Polygon | MultiPolygon)) {
          setUploadError(
            'Fayldagi konturlar o\'zaro ustma-ust tushmoqda. Hech qanday kontur bir-birini ustiga tushmasligi kerak.'
          );
          return;
        }
      }
      accepted.push(feat);
    }
    if (accepted.length === 0) {
      setUploadError('Barcha konturlar mavjud hududlar bilan ustma-ust tushdi. Hech narsa qo‘shilmadi.');
      return;
    }
    setUploadedFeatures(accepted);
    const total = accepted.reduce((s, f) => s + (f.properties?.area_ha ?? 0), 0);
    setTotalAreaHa(total);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    const isZip = file.name.toLowerCase().endsWith('.zip');

    if (isZip) {
      try {
        const buf = await file.arrayBuffer();
        const shp = (await import('shpjs')).default;
        const geojson = await shp(buf);
        let raw: unknown = geojson;
        if (Array.isArray(geojson) && geojson.length > 0) {
          const first = geojson[0];
          raw = (first as { type?: string; features?: unknown[] }).type === 'FeatureCollection' ? first : { type: 'FeatureCollection', features: [first] };
        }
        processGeoJSON(raw);
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        setUploadError(msg ? `Shapefile: ${msg}` : 'Shapefile (.zip) o‘qib bo‘lmadi. .shp, .dbf fayllari zip ichida bo‘lishi kerak.');
      }
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result as string) as unknown;
        processGeoJSON(raw);
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        setUploadError(msg && msg.includes('JSON') ? "Fayl JSON emas yoki noto'g'ri." : "Faylni o'qib bo'lmadi. JSON va geometriya (polygon) bo'lishi kerak.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const clearUpload = () => {
    setUploadedFeatures([]);
    setTotalAreaHa(0);
    setSaveStatus('idle');
    setSaveErrorMsg(null);
    setDrawError(null);
    setUploadedFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    uploadLayerRef.current?.remove();
    uploadLayerRef.current = null;
  };

  const handleSave = async () => {
    if (uploadedFeatures.length === 0) return;
    setSaveStatus('saving');
    setSaveErrorMsg(null);
    try {
      const res = await fetch('/api/v1/forest-areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geojson: { type: 'FeatureCollection', features: uploadedFeatures },
          regionName: selectedRegion ? getRegionName(selectedRegion) : undefined,
          forestName: forestName.trim() || undefined,
        }),
      });
      const text = await res.text();
      if (!res.ok) {
        let msg = text || `HTTP ${res.status}`;
        try {
          const data = JSON.parse(text);
          if (typeof data?.message === 'string') msg = data.message;
        } catch {}
        setSaveErrorMsg(msg);
        throw new Error(msg);
      }
      setSaveStatus('ok');
      setSavedAreasVersion((v) => v + 1);
      clearUpload();
      setForestName('');
    } catch (e) {
      setSaveStatus('error');
      setSaveErrorMsg(e instanceof Error ? e.message : 'Tarmoq xatosi');
    }
  };

  const SectionIcon = ({ d, className = 'w-4 h-4' }: { d: string; className?: string }) => (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
      </svg>
    );

    return (
    <div className={`relative min-h-0 ${fillContainer ? 'h-full' : 'h-[calc(100vh-var(--topbar-height)-8rem)]'}`}>
      {drawingMode && (
      <aside
        className={`absolute top-4 right-4 bottom-4 z-[900] flex flex-col bg-white/95 backdrop-blur rounded-xl border border-slate-200 shadow-md overflow-hidden transition-[width] duration-200 ease-out ${addAreaPanelCollapsed ? 'w-12 max-w-[90vw]' : 'w-72 max-w-[90vw]'}`}
        aria-label="Hudud qo'shish"
      >
        <div className="flex items-center justify-between gap-1.5 py-3 px-4 border-b border-slate-100 shrink-0 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <SectionIcon d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" className="w-3.5 h-3.5 text-forest-600 shrink-0" />
            {!addAreaPanelCollapsed && <span className="text-sm font-medium text-slate-800 truncate">Hudud qo&apos;shish</span>}
          </div>
          <button
            type="button"
            onClick={() => setAddAreaPanelCollapsed((c) => !c)}
            className="p-0.5 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-1 focus:ring-forest-500/40 shrink-0"
            aria-label={addAreaPanelCollapsed ? "Panelni ochish" : "Panelni yig'ish"}
          >
            <svg className={`w-4 h-4 transition-transform ${addAreaPanelCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>
        {!addAreaPanelCollapsed && (
        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3 space-y-0 scrollbar-thin min-h-0">
            {/* Step 1: Area type first */}
            <section className="py-2.5 border-b border-slate-100">
              <h3 className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-2">
                <SectionIcon d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                1. Hudud turi
              </h3>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => { setDrawAreaType('forest'); setSelectedForestFeature(null); }}
                  className={`flex items-center gap-2 w-full py-2 px-3 rounded-lg border text-sm font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-forest-500/40 ${drawAreaType === 'forest' ? 'border-green-500 bg-green-50 text-green-800' : 'border-green-200 bg-green-50/50 text-green-700 hover:bg-green-100 hover:border-green-300'}`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
                  {DRAW_AREA_TYPE_LABELS.forest}
                </button>
                <button
                  type="button"
                  onClick={() => { setDrawAreaType('lease'); setSelectedForestFeature(null); }}
                  className={`flex items-center gap-2 w-full py-2 px-3 rounded-lg border text-sm font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-forest-500/40 ${drawAreaType === 'lease' ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-amber-200 bg-amber-50/50 text-amber-700 hover:bg-amber-100 hover:border-amber-300'}`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                  {DRAW_AREA_TYPE_LABELS.lease}
                </button>
                <button
                  type="button"
                  onClick={() => { setDrawAreaType('empty'); setSelectedForestFeature(null); }}
                  className={`flex items-center gap-2 w-full py-2 px-3 rounded-lg border text-sm font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-forest-500/40 ${drawAreaType === 'empty' ? 'border-slate-500 bg-slate-100 text-slate-800' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:border-slate-300'}`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-500 shrink-0" />
                  {DRAW_AREA_TYPE_LABELS.empty}
                </button>
              </div>
            </section>

            {/* Step 2: Region selector (enabled only after type selected) */}
            <section className="py-2.5 border-b border-slate-100">
              <h3 className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-2">
                <SectionIcon d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                2. Viloyat
              </h3>
              <select
                value={selectedRegionId}
                onChange={handleRegionSelect}
                disabled={!drawAreaType}
                className={`w-full rounded-lg border py-2 px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-forest-500/40 focus:border-forest-500 transition-colors appearance-none ${drawAreaType ? 'border-slate-200 bg-slate-50/50 focus:bg-white hover:border-slate-300 cursor-pointer' : 'border-slate-200 bg-slate-100 cursor-not-allowed opacity-60'}`}
                style={{ color: selectedRegionId ? undefined : '#94a3b8' }}
              >
                <option value="">Viloyatni tanlang</option>
                {regionFeatures.map((f) => (
                  <option key={getRegionName(f)} value={getRegionName(f)}>{getRegionName(f)}</option>
                ))}
              </select>
              {!drawAreaType && (
                <p className="text-xs text-slate-500 mt-1.5">Avval hudud turini tanlang.</p>
              )}
            </section>

            {/* Step 3a: Forestry name only for Forest area (required for base layer) */}
            {drawAreaType === 'forest' && (
              <section className="py-2.5 border-b border-slate-100">
                <h3 className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-2">
                  <SectionIcon d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  3. O&apos;rmon xo&apos;jaligi nomi
                </h3>
                <input
                  type="text"
                  value={forestName}
                  onChange={(e) => setForestName(e.target.value)}
                  placeholder="O'rmon xo'jaligi nomini kiriting"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2 px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-forest-500/40 focus:border-forest-500 focus:bg-white hover:border-slate-300 transition-colors"
                />
              </section>
            )}

            {/* Step 3b: Rental/Free — select forest area in region (drawing only inside forest) */}
            {(drawAreaType === 'lease' || drawAreaType === 'empty') && selectedRegion && (
              <section className="py-2.5 border-b border-slate-100">
                <h3 className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-2">
                  <SectionIcon d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  3. O&apos;rmon maydonini tanlang
                </h3>
                <p className="text-xs text-slate-500 mb-2">
                  Ijara va bo&apos;sh maydonlar faqat o&apos;rmon maydoni ichida chiziladi.
                </p>
                {forestFeaturesInRegion.length === 0 ? (
                  <p className="text-sm text-amber-600 font-medium">
                    Bu viloyatda hozircha o&apos;rmon maydoni yo&apos;q. Avval «O&apos;rmon yer maydoni» turini tanlab, shu viloyatda o&apos;rmon yarating.
                  </p>
                ) : !selectedForestFeature ? (
                  <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
                    {forestFeaturesInRegion.map((f, idx) => (
                      <button
                        key={(f.properties?.id as string) ?? idx}
                        type="button"
                        onClick={() => setSelectedForestFeature(f)}
                        className="text-left py-2 px-3 rounded-lg border border-green-200 bg-green-50/80 text-green-800 text-sm hover:bg-green-100 hover:border-green-300 focus:outline-none focus:ring-1 focus:ring-green-500/40 transition-colors"
                      >
                        <span className="font-medium">{f.properties?.name ?? "O'rmon maydoni"}</span>
                        <span className="block text-xs text-green-600 mt-0.5">{(f.properties?.area_ha ?? 0).toLocaleString('uz')} ga</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg border border-forest-200 bg-forest-50/80">
                    <span className="text-sm font-medium text-forest-800 truncate">{selectedForestFeature.properties?.name ?? "Tanlangan o'rmon"}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedForestFeature(null)}
                      className="text-sm text-slate-500 hover:text-slate-700 underline shrink-0"
                    >
                      O&apos;zgartirish
                    </button>
                  </div>
                )}
              </section>
            )}

            {/* Step 4: Drawing/upload — Forest: after region; Rental/Free: after forest selected */}
            <section className="py-2.5 border-b border-slate-100">
              <h3 className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-2">
                <SectionIcon d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                Xaritada chizish / File
              </h3>
              {drawAreaType === 'forest' && !selectedRegion && (
                <p className="text-xs text-slate-500 mb-2">Avval viloyatni tanlang.</p>
              )}
              {(drawAreaType === 'lease' || drawAreaType === 'empty') && !selectedForestFeature && (
                <p className="text-xs text-slate-500 mb-2">Avval yuqorida o&apos;rmon maydonini tanlang.</p>
              )}
              {(() => {
                const canEnableDraw = drawAreaType === 'forest' ? !!selectedRegion : !!(drawAreaType && selectedForestFeature);
                return (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!canEnableDraw}
                      onClick={() => setInputMode('map')}
                      className={`flex-1 w-full py-2 px-3 rounded-lg border text-sm font-medium transition-all focus:outline-none focus:ring-1 focus:ring-forest-500/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none ${inputMode === 'map' ? 'border-forest-500 bg-forest-600 text-white hover:bg-forest-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300'}`}
                    >
                      Xaritada belgilash
                    </button>
                    <button
                      type="button"
                      disabled={!canEnableDraw}
                      onClick={() => setInputMode('file')}
                      className={`flex-1 w-full py-2 px-3 rounded-lg border text-sm font-medium transition-all focus:outline-none focus:ring-1 focus:ring-forest-500/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none ${inputMode === 'file' ? 'border-forest-500 bg-forest-600 text-white hover:bg-forest-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300'}`}
                    >
                      File tanlash
                    </button>
                  </div>
                );
              })()}
            </section>

            {inputMode === 'map' && (
              <section className="py-2.5 border-b border-slate-100 space-y-2">
                {drawAreaType === null ? (
                  <p className="text-sm text-slate-500">Hudud turini yuqorida tanlang.</p>
                ) : drawAreaType === 'lease' || drawAreaType === 'empty' ? (
                  <>
                    <p className="text-xs text-slate-500">
                      Turi: <span className="font-medium text-slate-700">{DRAW_AREA_TYPE_LABELS[drawAreaType]}</span>
                    </p>
                    {!selectedForestFeature ? (
                      <p className="text-xs text-amber-600 font-medium">Avval yuqorida «O&apos;rmon maydonini tanlang» qadamida o&apos;rmon tanlang.</p>
                    ) : (
                      <>
                        <p className="text-xs text-forest-600 font-medium mb-1">O&apos;rmon: {selectedForestFeature.properties?.name ?? 'Tanlangan'}</p>
                        <p className="text-xs text-slate-500">Xaritada nuqtalarni bosib kontur yarating, keyin «Konturni yopish» bosing. Faqat shu o&apos;rmon chegarasida.</p>
                        {drawError && <p className="text-xs text-red-600">{drawError}</p>}
                        {drawPoints.length >= 3 && (
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={closeDrawPolygon}
                              className="flex-1 w-full py-2 px-3 rounded-lg bg-forest-600 text-white text-sm font-medium hover:bg-forest-700 focus:outline-none focus:ring-1 focus:ring-forest-500 transition-colors"
                            >
                              Konturni yopish
                            </button>
                            <button
                              type="button"
                              onClick={cancelDraw}
                              className="py-2 px-3 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300 transition-colors"
                            >
                              Bekor qilish
                            </button>
                          </div>
                        )}
                        {selectedForestFeature && drawPoints.length < 3 && (
                          <button
                            type="button"
                            onClick={cancelDraw}
                            className="text-xs text-slate-500 hover:text-slate-700 underline"
                          >
                            Bekor qilish
                          </button>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-xs text-slate-500">
                      Turi: <span className="font-medium text-slate-700">{DRAW_AREA_TYPE_LABELS[drawAreaType]}</span>
                    </p>
                    {!selectedRegion ? (
                      <p className="text-xs text-amber-600 font-medium">Avval viloyatni tanlang. Kontur faqat tanlangan viloyat chegarasida bo‘ladi.</p>
                    ) : (
                      <>
                        <p className="text-xs text-slate-500">Xaritada nuqtalarni bosib kontur yarating, keyin «Konturni yopish» bosing.</p>
                        <p className="text-xs text-forest-600 font-medium">Tanlangan viloyat ichida belgilang: {getRegionName(selectedRegion)}</p>
                      </>
                    )}
                    {drawError && <p className="text-xs text-red-600">{drawError}</p>}
                    {drawPoints.length >= 3 && (
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={closeDrawPolygon}
                          className="flex-1 w-full py-2 px-3 rounded-lg bg-forest-600 text-white text-sm font-medium hover:bg-forest-700 focus:outline-none focus:ring-1 focus:ring-forest-500 transition-colors"
                        >
                          Konturni yopish
                        </button>
                        <button
                          type="button"
                          onClick={cancelDraw}
                          className="py-2 px-3 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300 transition-colors"
                        >
                          Bekor qilish
                        </button>
                      </div>
                    )}
                  </>
                )}
              </section>
            )}

            {inputMode === 'file' && (
              <section className="py-2.5 border-b border-slate-100">
                <h3 className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-2">
                  <SectionIcon d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  GeoJSON / Shapefile
                </h3>
                {selectedRegion && (
                  <p className="text-xs text-forest-600 mb-2">Viloyat tanlangan: faqat {getRegionName(selectedRegion)} chegarasidagi qism qo‘shiladi.</p>
                )}
                {(() => {
                  const canEnableFile = drawAreaType === 'forest' ? !!selectedRegion : !!(drawAreaType && selectedForestFeature);
                  return (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".geojson,.json,.zip"
                        onChange={handleFile}
                        disabled={!canEnableFile}
                        className="hidden"
                        aria-hidden="true"
                      />
                      <button
                        type="button"
                        disabled={!canEnableFile}
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-2 px-3 rounded-lg border-0 bg-forest-600 text-white text-sm font-medium cursor-pointer hover:bg-forest-700 focus:outline-none focus:ring-1 focus:ring-forest-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                      >
                        Fayl tanlash
                      </button>
                      <p className="text-sm text-slate-500 mt-1.5">{uploadedFileName ?? 'Fayl tanlanmadi'}</p>
                      {uploadError && <p className="text-sm text-red-600 mt-1.5">{uploadError}</p>}
                    </>
                  );
                })()}
              </section>
            )}

            {uploadedFeatures.length > 0 && (
              <section className="py-2.5">
                <h3 className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-2">
                  <SectionIcon d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  Maydon
                </h3>
                <p className="text-xl font-bold text-forest-600 mb-3">{totalAreaHa.toLocaleString('uz')} ga</p>
                {leaseAreaHa > 0 && (
                  <div className="mb-3 p-3 rounded-lg border border-amber-200 bg-amber-50/80 space-y-2">
                    <p className="text-sm font-medium text-amber-800">Ijara narxi</p>
                    <div>
                      <p className="text-xs text-slate-600">Maydon hajmi</p>
                      <p className="mt-0.5 text-sm font-medium text-slate-800">{leaseAreaHa.toLocaleString('uz')} ga</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">Tarif (1 ga), so&apos;m</p>
                      <input
                        type="number"
                        min={0}
                        step={100000}
                        value={leaseTariffPerHa || ''}
                        onChange={(e) => setLeaseTariffPerHa(Math.max(0, Number(e.target.value) || 0))}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-forest-500/40 focus:border-forest-500"
                      />
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">Umumiy ijara narxi</p>
                      <p className="mt-0.5 text-sm font-bold text-amber-800">{totalLeasePrice.toLocaleString('uz')} so&apos;m</p>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Saqlash va Tozalash — doim ko‘rinadi */}
            <section className="py-2.5 border-t border-slate-100 mt-auto pt-3">
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saveStatus === 'saving' || uploadedFeatures.length === 0 || (drawAreaType === 'forest' && !forestName.trim())}
                  className="w-full py-2 px-3 rounded-lg bg-forest-600 text-white text-sm font-medium hover:bg-forest-700 focus:outline-none focus:ring-1 focus:ring-forest-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {saveStatus === 'saving' ? 'Saqlanmoqda...' : saveStatus === 'ok' ? 'Saqlandi' : 'Saqlash'}
                </button>
                {saveStatus === 'error' && (
                  <p className="text-sm text-red-600">
                    {saveErrorMsg ? `Xatolik: ${saveErrorMsg}` : "Xatolik. Qayta urinib ko'ring."}
                  </p>
                )}
                <button
                  type="button"
                  onClick={clearUpload}
                  disabled={uploadedFeatures.length === 0}
                  className="w-full py-2 px-3 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  Tozalash
                </button>
              </div>
            </section>
        </div>
        )}
      </aside>
      )}
      {showVehiclesAndRoutes && (
        <div className="absolute right-0 top-0 bottom-0 z-[890] flex flex-row-reverse items-stretch pointer-events-none">
          <div
            className={`pointer-events-auto flex flex-col bg-white border-l border-slate-200 shadow-xl overflow-hidden transition-[width] duration-300 ease-out ${
              transportPanelOpen ? 'w-[min(400px,calc(100%-2rem))] min-w-[350px] max-w-[450px]' : 'w-0 min-w-0'
            }`}
          >
            <div className="flex items-center justify-between shrink-0 py-2.5 px-3 border-b border-slate-100">
              <span className="text-sm font-semibold text-slate-800 truncate">Transport — Faol transportlar</span>
              <button
                type="button"
                onClick={() => setTransportPanelOpen(false)}
                className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-forest-500/40"
                aria-label="Panelni yopish"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto min-h-0">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-xs font-semibold text-slate-600">Nomi</th>
                    <th className="px-3 py-2 text-xs font-semibold text-slate-600">Turi</th>
                    <th className="px-3 py-2 text-xs font-semibold text-slate-600">Raqam</th>
                    <th className="px-3 py-2 text-xs font-semibold text-slate-600">O‘rmon</th>
                    <th className="px-3 py-2 text-xs font-semibold text-slate-600">Haydovchi</th>
                    <th className="px-3 py-2 text-xs font-semibold text-slate-600">Tezlik</th>
                    <th className="px-3 py-2 text-xs font-semibold text-slate-600">Holat</th>
                    <th className="px-3 py-2 text-xs font-semibold text-slate-600">Yo‘nalish</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700">
                  {DEMO_VEHICLES.map((v) => {
                    const live = demoVehicleLiveState[v.id];
                    const isSelected = selectedVehicleId === v.id;
                    return (
                      <tr
                        key={v.id}
                        onClick={() => {
                          setSelectedVehicleId(v.id);
                          if (mapRef.current && live) {
                            mapRef.current.panTo([live.lat, live.lng], { animate: true, duration: 0.5 });
                          }
                        }}
                        className={`border-b border-slate-100 cursor-pointer transition-colors ${
                          isSelected ? 'bg-forest-50 border-l-2 border-l-forest-500' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="px-3 py-2 text-xs font-medium text-slate-800">{v.name}</td>
                        <td className="px-3 py-2 text-xs">{DEMO_VEHICLE_TYPE_LABELS[v.transportType]}</td>
                        <td className="px-3 py-2 text-xs">{v.plateNumber}</td>
                        <td className="px-3 py-2 text-xs truncate max-w-[120px]" title={v.forestry}>{v.forestry}</td>
                        <td className="px-3 py-2 text-xs">{v.driver}</td>
                        <td className="px-3 py-2 text-xs">{live ? `${live.speedKmh} km/h` : '—'}</td>
                        <td className="px-3 py-2 text-xs">
                          {live ? (
                            <span className={live.status === 'moving' ? 'text-green-600' : live.status === 'stopped' ? 'text-amber-600' : 'text-slate-500'}>
                              {live.status === 'moving' ? 'Harakatda' : live.status === 'stopped' ? 'To‘xtab' : 'O‘flayn'}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500">{v.destination ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTransportPanelOpen((o) => !o)}
            className="pointer-events-auto self-center shrink-0 w-8 h-14 rounded-l-lg border border-r-0 border-slate-200 bg-white shadow-md flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/40 transition-colors"
            aria-label={transportPanelOpen ? 'Panelni yopish' : 'Panelni ochish'}
          >
            {transportPanelOpen ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            )}
          </button>
        </div>
      )}
      <div className="absolute inset-0 z-0 rounded-xl border border-slate-200/90 shadow-lg shadow-slate-200/40 overflow-hidden bg-slate-100">
        {mapError ? (
          <div className="absolute inset-0 flex items-center justify-center p-6 bg-slate-100 z-10">
            <p className="text-sm text-amber-700 font-medium">{mapError}</p>
          </div>
        ) : null}
        <div
          ref={containerRef}
          className={`absolute inset-0 ${showMonitoringLayers && showHeatmapAndRisk ? 'map-zoom-above-legend' : ''}`}
        />
        {drawingMode && (
          <div className="absolute bottom-4 left-4 z-[1000] bg-white/95 backdrop-blur rounded-lg border border-slate-200 shadow-md p-3 text-xs">
            <p className="font-semibold text-slate-700 mb-2">Hudud holati</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded border border-slate-300 shrink-0" style={{ backgroundColor: AREA_STATUS_STYLE.empty.fillColor, borderColor: AREA_STATUS_STYLE.empty.color }} />
                <span className="text-slate-700">Bo&apos;sh</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded border border-slate-300 shrink-0" style={{ backgroundColor: AREA_STATUS_STYLE.leased.fillColor, borderColor: AREA_STATUS_STYLE.leased.color }} />
                <span className="text-slate-700">Ijarada</span>
              </div>
            </div>
          </div>
        )}
        {showMonitoringLayers && (
          <div
            className={`absolute top-4 right-4 z-[1000] bg-white/95 backdrop-blur rounded-lg border border-slate-200 shadow-md overflow-hidden transition-[width] duration-200 ease-out ${layersPanelCollapsed ? 'w-32' : 'w-44'}`}
          >
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-100 whitespace-nowrap">
              <span className="font-medium text-slate-800 text-xs">Qatlamlar paneli</span>
              <button
                type="button"
                onClick={() => setLayersPanelCollapsed((c) => !c)}
                className="p-0.5 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-1 focus:ring-forest-500/40"
                aria-label={layersPanelCollapsed ? 'Panelni ochish' : 'Panelni yig\'ish'}
              >
                <svg className={`w-4 h-4 transition-transform ${layersPanelCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
            </div>
            {!layersPanelCollapsed && (
              <div className="p-1.5 space-y-0.5">
                {showEvents && (
                  <div className="flex items-center justify-between gap-1.5 py-1 px-1.5 rounded hover:bg-slate-50">
                    <span className="flex items-center gap-1.5 text-xs text-slate-700">
                      <svg className="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      Hodisa belgilari
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={showEventsOverlay}
                      onClick={() => setShowEventsOverlay((v) => !v)}
                      className={`relative inline-flex h-5 w-8 shrink-0 rounded-full border border-transparent transition-colors focus:outline-none focus:ring-1 focus:ring-forest-500/40 ${showEventsOverlay ? 'bg-forest-600' : 'bg-slate-200'}`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform mt-0.5 ${showEventsOverlay ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                )}
                {showMonitoringLayers && (
                  <div className="flex items-center justify-between gap-1.5 py-1 px-1.5 rounded hover:bg-slate-50">
                    <span className="flex items-center gap-1.5 text-xs text-slate-700">
                      <svg className="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      Kamerlar
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={showCamerasOverlay}
                      onClick={() => setShowCamerasOverlay((v) => !v)}
                      className={`relative inline-flex h-5 w-8 shrink-0 rounded-full border border-transparent transition-colors focus:outline-none focus:ring-1 focus:ring-forest-500/40 ${showCamerasOverlay ? 'bg-forest-600' : 'bg-slate-200'}`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform mt-0.5 ${showCamerasOverlay ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                )}
                <div className="flex items-center justify-between gap-1.5 py-1 px-1.5 rounded hover:bg-slate-50">
                  <span className="flex items-center gap-1.5 text-xs text-slate-700">
                    {alertMuted ? (
                      <svg className="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                    ) : (
                      <svg className="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                    )}
                    Tovush
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!alertMuted}
                    onClick={() => {
                      const next = !alertMuted;
                      setAlertMuted(next);
                      alertSound.setMuted(next);
                    }}
                    className={`relative inline-flex h-5 w-8 shrink-0 rounded-full border border-transparent transition-colors focus:outline-none focus:ring-1 focus:ring-forest-500/40 ${!alertMuted ? 'bg-forest-600' : 'bg-slate-200'}`}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform mt-0.5 ${!alertMuted ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                {showHeatmapAndRisk && (
                  <div className="flex items-center justify-between gap-1.5 py-1 px-1.5 rounded hover:bg-slate-50">
                    <span className="flex items-center gap-1.5 text-xs text-slate-700">
                      <svg className="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                      Risk Heatmap
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={riskHeatmapOn}
                      onClick={() => setRiskHeatmapOn((on) => !on)}
                      className={`relative inline-flex h-5 w-8 shrink-0 rounded-full border border-transparent transition-colors focus:outline-none focus:ring-1 focus:ring-forest-500/40 ${riskHeatmapOn ? 'bg-forest-600' : 'bg-slate-200'}`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform mt-0.5 ${riskHeatmapOn ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                )}
                {showInspectorsAndPatrol && (
                  <div className="flex items-center justify-between gap-1.5 py-1 px-1.5 rounded hover:bg-slate-50 border-t border-slate-100 mt-0.5 pt-1.5">
                    <span className="flex items-center gap-1.5 text-xs text-slate-700">Patrul marshruti</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={showPatrolRoutes}
                      onClick={() => setShowPatrolRoutes((on) => !on)}
                      className={`relative inline-flex h-5 w-8 shrink-0 rounded-full border border-transparent transition-colors focus:outline-none focus:ring-1 focus:ring-forest-500/40 ${showPatrolRoutes ? 'bg-[#2563eb]' : 'bg-slate-200'}`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform mt-0.5 ${showPatrolRoutes ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {showEventsLayer && mapMode === 'monitoring' && showRecentEventsPanel && (
          <div className="absolute top-[6.5rem] right-4 z-[999] w-72 max-h-64 bg-white/95 backdrop-blur rounded-xl border border-slate-200 shadow-lg flex flex-col overflow-hidden transition-all duration-200">
            <p className="font-semibold text-slate-700 px-3 py-2 border-b border-slate-100">So&apos;nggi hodisalar</p>
            <ul className="overflow-y-auto scrollbar-thin p-2 space-y-1.5 text-xs">
              {[
                ...demoEvents.map((ev) => ({ type: 'demo' as const, id: ev.id, time: ev.time, ev })),
                ...aiDetectionEvents.map((ev) => ({ type: 'ai' as const, id: ev.id, time: ev.timestamp, ev })),
              ]
                .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
                .slice(0, 50)
                .map((item) =>
                  item.type === 'demo' ? (
                    <li key={`demo-${item.id}`} className="flex items-start gap-2 py-1.5 px-2 rounded-md hover:bg-slate-50">
                      <span className="shrink-0 w-2.5 h-2.5 rounded-full mt-1.5" style={{ backgroundColor: DEMO_EVENT_TYPE_CONFIG[item.ev.type].color }} />
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800">{DEMO_EVENT_TYPE_CONFIG[item.ev.type].label}</p>
                        <p className="text-slate-500">{formatEventTime(item.ev.time)}</p>
                        <p className="text-slate-600 truncate" title={item.ev.regionName}>{item.ev.regionName}</p>
                      </div>
                    </li>
                  ) : (
                    <li key={`ai-${item.id}`} className="flex items-start gap-2 py-1.5 px-2 rounded-md hover:bg-slate-50">
                      <span className="shrink-0 w-2.5 h-2.5 rounded-full mt-1.5 bg-amber-500" />
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800">AI aniqlandi</p>
                        <p className="text-slate-500">{formatEventTime(item.ev.timestamp)}</p>
                        <p className="text-slate-600 truncate" title={item.ev.cameraName}>{item.ev.cameraName}</p>
                      </div>
                    </li>
                  )
                )}
              {demoEvents.length === 0 && aiDetectionEvents.length === 0 && (
                <li className="py-4 text-center text-slate-500">Har 30 sekundda demo hodisa; AI dan kelgan hodisalar shu yerda chiqadi.</li>
              )}
            </ul>
          </div>
        )}
        {showMonitoringLayers && showHeatmapAndRisk && (
          <div className="absolute bottom-4 left-4 z-[1000] bg-white/95 backdrop-blur rounded-lg border border-slate-200 shadow-md p-3 text-xs">
            <p className="font-semibold text-slate-700 mb-2">Xavf bashorati</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded border-2 border-dashed shrink-0" style={{ borderColor: RISK_PREDICTION_STYLE.low.color, backgroundColor: RISK_PREDICTION_STYLE.low.fillColor }} />
                <span className="text-slate-700">{RISK_PREDICTION_LEGEND.low}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded border-2 border-dashed shrink-0" style={{ borderColor: RISK_PREDICTION_STYLE.medium.color, backgroundColor: RISK_PREDICTION_STYLE.medium.fillColor }} />
                <span className="text-slate-700">{RISK_PREDICTION_LEGEND.medium}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded border-2 border-dashed shrink-0" style={{ borderColor: RISK_PREDICTION_STYLE.high.color, backgroundColor: RISK_PREDICTION_STYLE.high.fillColor }} />
                <span className="text-slate-700">{RISK_PREDICTION_LEGEND.high}</span>
              </div>
            </div>
          </div>
        )}

        {showEventsLayer && selectedEventId && (() => {
          const ev = MOCK_EVENTS.find((e) => e.id === selectedEventId);
          if (!ev) return null;
          const cfg = EVENT_TYPE_CONFIG[ev.type];
          const assignment: EventAssignment = eventAssignments[selectedEventId] ?? { inspectorId: null, status: 'new' };
          const assignedInspector = assignment.inspectorId ? MOCK_INSPECTORS.find((i) => i.id === assignment.inspectorId) : null;
          const link = eventAreaLinks[selectedEventId];
          const forestName = link?.forestName ?? ev.forestArea;
          const rentalTenant = link?.rentalTenant ?? '—';
          const responsibleInspector = assignedInspector?.name ?? '—';
          return (
            <div className="absolute top-4 right-4 bottom-4 w-80 z-[1000] bg-white rounded-xl border border-slate-200 shadow-lg flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
                <h3 className="font-semibold text-slate-800">Hodisa tahrirlash</h3>
                <button
                  type="button"
                  onClick={() => setSelectedEventId(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                  aria-label="Yopish"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4 space-y-3 overflow-y-auto text-sm flex-1">
                <div>
                  <p className="text-xs font-medium text-slate-500">Hodisa turi</p>
                  <p className="mt-0.5 font-medium text-slate-800">{cfg.label}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Joy</p>
                  <p className="mt-0.5 text-slate-800">{ev.location}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Vaqt</p>
                  <p className="mt-0.5 text-slate-800">{formatEventTime(ev.time)}</p>
                </div>
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-600 mb-2">Hududga biriktirilgan</p>
                  <div>
                    <p className="text-xs font-medium text-slate-500">O&apos;rmon hududi</p>
                    <p className="mt-0.5 text-slate-800">{forestName}</p>
                  </div>
                  <div className="mt-2">
                    <p className="text-xs font-medium text-slate-500">Ijarachi</p>
                    <p className="mt-0.5 text-slate-800">{rentalTenant}</p>
                  </div>
                  <div className="mt-2">
                    <p className="text-xs font-medium text-slate-500">Mas&apos;ul inspektor</p>
                    <p className="mt-0.5 text-slate-800">{responsibleInspector}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Biriktirilgan inspektor</p>
                  <p className="mt-0.5 text-slate-800">{assignedInspector ? assignedInspector.name : 'Biriktirilmagan'}</p>
                  <select
                    value={incidentInspectorChoice}
                    onChange={(e) => setIncidentInspectorChoice(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2 px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/40 focus:border-forest-500"
                  >
                    <option value="">Inspektorni tanlang</option>
                    {MOCK_INSPECTORS.map((i) => (
                      <option key={i.id} value={i.id}>{i.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedEventId) return;
                      setEventAssignments((prev) => ({
                        ...prev,
                        [selectedEventId]: {
                          ...(prev[selectedEventId] ?? { inspectorId: null, status: 'new' }),
                          inspectorId: incidentInspectorChoice || null,
                        },
                      }));
                    }}
                    className="mt-2 w-full py-2 px-4 rounded-lg bg-forest-600 text-white text-sm font-medium hover:bg-forest-700 focus:outline-none focus:ring-2 focus:ring-forest-500 focus:ring-offset-2"
                  >
                    Inspektor biriktirish
                  </button>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Vazifa holati</p>
                  <select
                    value={assignment.status}
                    onChange={(e) => {
                      if (!selectedEventId) return;
                      const status = e.target.value as TaskStatus;
                      setEventAssignments((prev) => ({
                        ...prev,
                        [selectedEventId]: {
                          ...(prev[selectedEventId] ?? { inspectorId: null, status: 'new' }),
                          status,
                        },
                      }));
                    }}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2 px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500/40 focus:border-forest-500"
                  >
                    {(['new', 'in_progress', 'resolved'] as TaskStatus[]).map((s) => (
                      <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
                <div className="pt-2 border-t border-slate-200">
                  <p className="text-xs font-medium text-slate-500 mb-2">Timeline</p>
                  <div className="relative pl-4 border-l-2 border-slate-200 space-y-3">
                    {TIMELINE_ORDER.map((stepKey) => {
                      const timeline = selectedEventId ? (MOCK_EVENT_TIMELINES[selectedEventId] ?? {}) : {};
                      const ts = timeline[stepKey];
                      const hasTimestamp = ts != null && ts !== '';
                      return (
                        <div key={stepKey} className="relative -left-4 flex items-start gap-2">
                          <span
                            className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 ${
                              hasTimestamp ? 'bg-forest-500 border-forest-500' : 'bg-slate-100 border-slate-200'
                            }`}
                          />
                          <div className="min-w-0">
                            <p className={`text-xs font-medium ${hasTimestamp ? 'text-slate-800' : 'text-slate-400'}`}>
                              {TIMELINE_STEP_LABELS[stepKey]}
                            </p>
                            <p className={`text-xs mt-0.5 ${hasTimestamp ? 'text-slate-600' : 'text-slate-400'}`}>
                              {hasTimestamp ? formatEventTime(ts) : '—'}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
        {selectedAreaInfo && (
          <div className="absolute top-4 right-4 bottom-4 w-80 z-[1000] bg-white rounded-xl border border-slate-200 shadow-lg flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h3 className="font-semibold text-slate-800">Hudud ma&apos;lumoti</h3>
              <button
                type="button"
                onClick={() => { setSelectedAreaInfo(null); setSelectedAreaId(null); }}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                aria-label="Yopish"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto text-sm">
              <div>
                <p className="text-xs font-medium text-slate-500">Hudud nomi</p>
                <p className="mt-0.5 font-medium text-slate-800">{selectedAreaInfo.hududNomi}</p>
              </div>
              {forestLandStats ? (
                <>
                  <div>
                    <p className="text-xs font-medium text-slate-500">Umumiy maydon</p>
                    <p className="mt-0.5 text-slate-800">{forestLandStats.totalHa.toLocaleString('uz')} ga</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">Ijara maydoni (ichidagi yig&apos;indi)</p>
                    <p className="mt-0.5 text-slate-800">{forestLandStats.rentalSum.toLocaleString('uz')} ga</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">Bo&apos;sh maydon (ichidagi yig&apos;indi)</p>
                    <p className="mt-0.5 text-slate-800">{forestLandStats.freeSum.toLocaleString('uz')} ga</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">Qolgan foydalanilmagan yer</p>
                    <p className="mt-0.5 font-semibold text-forest-700">{forestLandStats.remaining.toLocaleString('uz')} ga</p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-xs font-medium text-slate-500">Umumiy maydon</p>
                    <p className="mt-0.5 text-slate-800">{selectedAreaInfo.totalAreaHa.toLocaleString('uz')} ga</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">Ijara maydoni (jami)</p>
                    <p className="mt-0.5 text-slate-800">{selectedAreaInfo.leasedAreaHa.toLocaleString('uz')} ga</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">Bo&apos;sh maydon</p>
                    <p className="mt-0.5 text-slate-800">{selectedAreaInfo.emptyAreaHa.toLocaleString('uz')} ga</p>
                  </div>
                </>
              )}
              <div>
                <p className="text-xs font-medium text-slate-500">Holat</p>
                <p className="mt-0.5">
                  <span
                    className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: AREA_STATUS_STYLE[selectedAreaInfo.status].fillColor,
                      borderColor: AREA_STATUS_STYLE[selectedAreaInfo.status].color,
                      color: AREA_STATUS_STYLE[selectedAreaInfo.status].color,
                    }}
                  >
                    {STATUS_LABEL[selectedAreaInfo.status]}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Ijarachi</p>
                <p className="mt-0.5 text-slate-800">{selectedAreaInfo.ijarachi}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Shartnoma tugash sanasi</p>
                <p className="mt-0.5 text-slate-800">{formatDateOnly(selectedAreaInfo.contractEndDate)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Oylik ijara to&apos;lovi</p>
                <p className="mt-0.5 text-slate-800">
                  {selectedAreaInfo.leasePaymentMonthly > 0 ? formatRevenue(selectedAreaInfo.leasePaymentMonthly) : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Kameralar soni</p>
                <p className="mt-0.5 text-slate-800">{selectedAreaInfo.cameras} ta</p>
              </div>
              {selectedAreaId && completedPatrolTimes[selectedAreaId] && (
                <div>
                  <p className="text-xs font-medium text-slate-500">Patrul bajarilgan</p>
                  <p className="mt-0.5 text-slate-800">{formatEventTime(completedPatrolTimes[selectedAreaId])}</p>
                </div>
              )}
              {selectedAreaId && effectiveUnattendedIds.includes(selectedAreaId) && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedAreaId) return;
                      setCompletedPatrolAreaIds((prev) => (prev.includes(selectedAreaId) ? prev : [...prev, selectedAreaId]));
                      setCompletedPatrolTimes((prev) => ({ ...prev, [selectedAreaId]: new Date().toISOString() }));
                    }}
                    className="w-full py-2.5 px-4 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
                  >
                    Patrul bajarildi
                  </button>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-200 shrink-0">
              <Link
                href="/dashboard/contracts"
                className="block w-full py-2.5 px-4 rounded-lg bg-forest-600 text-white text-sm font-medium text-center hover:bg-forest-700 focus:outline-none focus:ring-2 focus:ring-forest-500 focus:ring-offset-2"
              >
                Shartnomani ko&apos;rish
              </Link>
            </div>
          </div>
        )}
      <CameraStreamModal
        open={!!selectedCamera}
        onClose={() => setSelectedCamera(null)}
        streamUrl={selectedCamera?.streamUrl ?? ''}
        cameraName={selectedCamera?.name ?? ''}
      />
      </div>
    </div>
  );
}
