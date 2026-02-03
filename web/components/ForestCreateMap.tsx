'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Feature, FeatureCollection, Polygon, MultiPolygon, Geometry, GeometryCollection } from 'geojson';
import area from '@turf/area';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import booleanWithin from '@turf/boolean-within';
import intersect from '@turf/intersect';
import { featureCollection } from '@turf/helpers';

const UZ_CENTER: [number, number] = [41.3, 64.5];
const UZ_ZOOM = 5;
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
    return [{ type: 'Feature', properties: (o.properties as Record<string, unknown>) ?? {}, geometry: o.geometry }];
  }
  if (hasGeometry(o)) {
    return [{ type: 'Feature', properties: (o.properties as Record<string, unknown>) ?? {}, geometry: o.geometry }];
  }
  if (Array.isArray(o.features)) {
    return o.features.flatMap((f: unknown) => normalizeToFeatures(f));
  }
  if (isGeometry(o)) {
    return [{ type: 'Feature', properties: {}, geometry: o }];
  }
  if (o.type === 'Polygon' || o.type === 'MultiPolygon') {
    return [{ type: 'Feature', properties: {}, geometry: o as Geometry }];
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
    out.push({ type: 'Feature', properties: {}, geometry: o as Polygon | MultiPolygon });
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

export default function ForestCreateMap() {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const regionsLayerRef = useRef<L.GeoJSON | null>(null);
  const highlightLayerRef = useRef<L.GeoJSON | null>(null);
  const uploadLayerRef = useRef<L.GeoJSON | null>(null);
  const savedAreasLayerRef = useRef<L.GeoJSON | null>(null);

  const [regionFeatures, setRegionFeatures] = useState<RegionFeature[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<RegionFeature | null>(null);
  const [uploadedFeatures, setUploadedFeatures] = useState<UploadedFeature[]>([]);
  const [totalAreaHa, setTotalAreaHa] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle');
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);
  const [forestName, setForestName] = useState('');
  const [inputMode, setInputMode] = useState<'map' | 'file'>('file');
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([]);
  const [savedAreasVersion, setSavedAreasVersion] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [drawError, setDrawError] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const refreshSavedRef = useRef<() => void>(() => {});
  const drawLayerRef = useRef<L.LayerGroup | null>(null);

  refreshSavedRef.current = () => setSavedAreasVersion((v) => v + 1);

  const initMap = useCallback(() => {
    if (!containerRef.current || mapRef.current) return;
    try {
      setMapError(null);
      const map = L.map(containerRef.current, { center: UZ_CENTER, zoom: UZ_ZOOM });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map);
      mapRef.current = map;
    } catch (err) {
      console.error('[ForestCreateMap] initMap', err);
      setMapError('Xarita ishga tushirilmadi. Sahifani yangilab ko‘ring.');
    }
  }, []);

  useEffect(() => {
    initMap();
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      regionsLayerRef.current = null;
      highlightLayerRef.current = null;
      uploadLayerRef.current = null;
      drawLayerRef.current = null;
      savedAreasLayerRef.current = null;
    };
  }, [initMap]);

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
        if (features.length === 0) return;
          const layer = L.geoJSON(
            { type: 'FeatureCollection', features },
            {
              style: () => ({ color: '#166534', weight: 2, fillColor: '#22c55e', fillOpacity: 0.2 }),
              onEachFeature: (feature, lyr) => {
                const props = feature.properties as Record<string, unknown>;
                const id = props?.id as string | undefined;
                const name = (props?.name || 'Hudud') as string;
                const areaHa = (props?.area_ha ?? 0) as number;
                const popupContent = document.createElement('div');
                popupContent.className = 'text-sm';
                popupContent.innerHTML = `<div><b>${name}</b></div><div>Maydon: <b>${Number(areaHa).toLocaleString('uz')} ga</b></div>`;
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
          ).addTo(mapRef.current);
          savedAreasLayerRef.current = layer;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      savedAreasLayerRef.current?.remove();
      savedAreasLayerRef.current = null;
    };
  }, [savedAreasVersion]);

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
        { type: 'FeatureCollection', features: forMap },
        {
          style: () => REGION_STYLE,
          onEachFeature: (feature, lyr) => {
            lyr.on('click', () => {
              const regionName = (feature.properties?.ADM1_UZ || feature.properties?.ADM1_EN || feature.properties?.ADM1_RU) as string | undefined;
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

  const selectedRegionId = selectedRegion ? getRegionName(selectedRegion) : '';

  useEffect(() => {
    if (!mapRef.current) return;
    highlightLayerRef.current?.remove();
    if (!selectedRegion) {
      highlightLayerRef.current = null;
      return;
    }
    const layer = L.geoJSON(
      { type: 'Feature', properties: selectedRegion.properties, geometry: selectedRegion.geometry },
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
    const getStyle = (type?: string) => {
      const t = (type ?? 'forest').toLowerCase();
      if (t === 'lease' || t === 'ijara') return { color: '#ca8a04', weight: 2, fillColor: '#eab308', fillOpacity: 0.4 };
      if (t === 'risk' || t === 'xavf') return { color: '#b91c1c', weight: 2, fillColor: '#ef4444', fillOpacity: 0.4 };
      return { color: '#166534', weight: 2, fillColor: '#22c55e', fillOpacity: 0.35 };
    };
    const layer = L.geoJSON(
      { type: 'FeatureCollection', features: uploadedFeatures },
      {
        style: (f) => getStyle((f?.properties?.type as string) ?? 'forest'),
        onEachFeature: (feature, lyr) => {
          const name = (feature.properties?.name || feature.properties?.region || 'Hudud') as string;
          const areaHa = (feature.properties?.area_ha ?? 0) as number;
          const type = (feature.properties?.type as string) ?? 'forest';
          const responsible = (feature.properties?.responsible as string) ?? '—';
          const popup = `<div class="text-sm"><b>${name}</b></div>
            <div>Maydon: <b>${areaHa.toLocaleString('uz')} ga</b></div>
            <div>Turi: ${type === 'forest' ? "O'rmon" : type === 'lease' ? 'Ijara' : 'Xavf'}</div>
            <div>Mas'ul: ${responsible}</div>`;
          lyr.bindPopup(popup);
        },
      }
    ).addTo(mapRef.current);
    uploadLayerRef.current = layer;
  }, [uploadedFeatures]);

  useEffect(() => {
    if (!mapRef.current) return;
    drawLayerRef.current?.remove();
    drawLayerRef.current = null;
    if (drawPoints.length === 0) return;
    const group = L.layerGroup().addTo(mapRef.current);
    const latlngs = drawPoints.map(([lat, lng]) => L.latLng(lat, lng));
    L.polyline(latlngs, { color: '#166534', weight: 3, dashArray: '8,8' }).addTo(group);
    drawPoints.forEach(([lat, lng]) => {
      L.circleMarker([lat, lng], { radius: 6, fillColor: '#22c55e', color: '#166534', weight: 2, fillOpacity: 1 }).addTo(group);
    });
    drawLayerRef.current = group;
    return () => {
      drawLayerRef.current?.remove();
      drawLayerRef.current = null;
    };
  }, [drawPoints]);

  useEffect(() => {
    if (!mapRef.current || inputMode !== 'map') return;
    const map = mapRef.current;
    const onMapClick = (e: L.LeafletMouseEvent) => {
      if (!selectedRegion) {
        setDrawError("Avval viloyatni tanlang. Kontur faqat tanlangan viloyat chegarasida bo'lishi kerak.");
        return;
      }
      const pt: [number, number] = [e.latlng.lng, e.latlng.lat];
      const geom = selectedRegion.geometry as Polygon | MultiPolygon | GeometryCollection;
      const inside = pointInRegionGeometry(pt, geom);
      if (!inside) {
        setDrawError("Nuqta tanlangan viloyat chegarasida emas. Faqat viloyat ichida belgilang.");
        return;
      }
      setDrawError(null);
      setDrawPoints((prev) => [...prev, [e.latlng.lat, e.latlng.lng]]);
    };
    map.on('click', onMapClick);
    return () => {
      map.off('click', onMapClick);
    };
  }, [inputMode, selectedRegion]);

  const closeDrawPolygon = () => {
    setDrawError(null);
    if (drawPoints.length < 3) return;
    if (!selectedRegion?.geometry) {
      setDrawError("Avval viloyatni tanlang. Kontur faqat tanlangan viloyat chegarasida bo'lishi kerak.");
      return;
    }
    const ring = [...drawPoints, drawPoints[0]];
    const coordinates = [ring.map(([lat, lng]) => [lng, lat])];
    const drawnPolygon: Polygon = { type: 'Polygon', coordinates };
    const geom = selectedRegion.geometry as Polygon | MultiPolygon | GeometryCollection;
    // Konturni viloyat chegarasiga kesib, chegaradan tashqariga chiqmasligini ta'minlash
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
    const feature: UploadedFeature = {
      type: 'Feature',
      properties: { name: forestName || 'Xaritada belgilangan', area_ha: areaHa },
      geometry: clipped,
    };
    setUploadedFeatures((prev) => [...prev, feature]);
    setTotalAreaHa((prev) => prev + areaHa);
    setDrawPoints([]);
  };

  const cancelDraw = () => {
    setDrawPoints([]);
    setInputMode('file');
  };

  const handleRegionSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (!value) {
      setSelectedRegion(null);
      return;
    }
    const feature = regionFeatures.find((f) => getRegionName(f) === value);
    if (feature) {
      setSelectedRegion(feature);
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
    const regionGeom = selectedRegion?.geometry as Polygon | MultiPolygon | GeometryCollection | undefined;
    if (regionGeom && flatFeatures.length > 0) {
      const clippedFeatures: Array<Feature<Polygon | MultiPolygon, Record<string, unknown>>> = [];
      for (const f of flatFeatures) {
        const clipped = clipGeometryToRegion(f.geometry, regionGeom);
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
        setUploadError(`Fayldagi konturlar tanlangan viloyat (${selectedRegion ? getRegionName(selectedRegion) : ''}) chegarasida maydon hosil qilmadi. Faqat shu viloyat uchun fayl yuklang.`);
        return;
      }
    } else {
      flatFeatures = flatFeatures.map((f) => ({
        ...f,
        properties: { ...f.properties, area_ha: calcAreaHa(f.geometry) },
      }));
    }
    const withArea: UploadedFeature[] = flatFeatures.map((f) => ({
      ...f,
      properties: { ...f.properties, area_ha: f.properties?.area_ha ?? calcAreaHa(f.geometry) },
    }));
    if (withArea.length === 0) {
      setUploadError('Faylda Polygon yoki MultiPolygon topilmadi. Faqat maydon (polygon) qo‘llab-quvvatlanadi.');
      return;
    }
    setUploadedFeatures(withArea);
    const total = withArea.reduce((s, f) => s + (f.properties?.area_ha ?? 0), 0);
    setTotalAreaHa(total);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;
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
    <div className="flex gap-5 h-[calc(100vh-var(--topbar-height)-8rem)]">
      <div className="w-80 shrink-0 overflow-y-auto scrollbar-thin">
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-lg shadow-slate-200/40 overflow-hidden">
          <div className="flex items-center gap-2 py-3 px-4 border-b border-slate-100">
            <SectionIcon d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" className="w-4 h-4 text-forest-600" />
            <span className="text-sm font-semibold text-slate-800">Hudud tanlash</span>
          </div>
          <div className="px-4 pb-4 pt-2 space-y-0 border-t-0">
            <section className="pt-3 pb-3 border-b border-slate-100">
              <h3 className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-2">
                <SectionIcon d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" className="w-3.5 h-3.5 text-slate-500" />
                Viloyat
              </h3>
              <select
                value={selectedRegionId}
                onChange={handleRegionSelect}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2 px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-forest-500/40 focus:border-forest-500 focus:bg-white hover:border-slate-300 transition-colors appearance-none cursor-pointer"
                style={{ color: selectedRegionId ? undefined : '#94a3b8' }}
              >
                <option value="">Viloyatni tanlang</option>
                {regionFeatures.map((f) => (
                  <option key={getRegionName(f)} value={getRegionName(f)}>{getRegionName(f)}</option>
                ))}
              </select>
            </section>

            <section className="py-3 border-b border-slate-100">
              <h3 className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-2">
                <SectionIcon d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" className="w-3.5 h-3.5 text-slate-500" />
                O'rmon xo'jaligi
              </h3>
              <input
                type="text"
                value={forestName}
                onChange={(e) => setForestName(e.target.value)}
                placeholder="O'rmon xo'jaligi nomini kiriting"
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2 px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-forest-500/40 focus:border-forest-500 focus:bg-white hover:border-slate-300 transition-colors"
              />
            </section>

            <section className="py-3 border-b border-slate-100">
              <h3 className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-2">
                <SectionIcon d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" className="w-3.5 h-3.5 text-slate-500" />
                Manba
              </h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setInputMode('map')}
                  className={`flex-1 w-full py-2 px-3 rounded-lg border text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-forest-500/40 focus:ring-offset-2 ${inputMode === 'map' ? 'border-forest-500 bg-forest-600 text-white hover:bg-forest-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300'}`}
                >
                  Xaritada belgilash
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('file')}
                  className={`flex-1 w-full py-2 px-3 rounded-lg border text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-forest-500/40 focus:ring-offset-2 ${inputMode === 'file' ? 'border-forest-500 bg-forest-600 text-white hover:bg-forest-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300'}`}
                >
                  File tanlash
                </button>
              </div>
            </section>

            {inputMode === 'map' && (
              <section className="py-3 border-b border-slate-100 space-y-2">
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
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={closeDrawPolygon}
                      className="flex-1 w-full py-2 px-3 rounded-lg bg-forest-600 text-white text-sm font-medium hover:bg-forest-700 focus:outline-none focus:ring-2 focus:ring-forest-500 focus:ring-offset-2 transition-colors"
                    >
                      Konturni yopish
                    </button>
                    <button
                      type="button"
                      onClick={cancelDraw}
                      className="py-2 px-3 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2 transition-colors"
                    >
                      Bekor qilish
                    </button>
                  </div>
                )}
              </section>
            )}

            {inputMode === 'file' && (
              <section className="py-3 border-b border-slate-100">
                <h3 className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-2">
                  <SectionIcon d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" className="w-3.5 h-3.5 text-slate-500" />
                  GeoJSON / Shapefile
                </h3>
                {selectedRegion && (
                  <p className="text-xs text-forest-600 mb-2">Viloyat tanlangan: faqat {getRegionName(selectedRegion)} chegarasidagi qism qo‘shiladi.</p>
                )}
                <label className="block w-full">
                  <input
                    type="file"
                    accept=".geojson,.json,.zip"
                    onChange={handleFile}
                    className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-forest-600 file:text-white file:font-medium file:text-xs file:cursor-pointer file:hover:bg-forest-700 file:transition-colors file:focus:outline-none file:focus:ring-2 file:focus:ring-forest-500 file:focus:ring-offset-2"
                  />
                </label>
                {uploadError && <p className="text-xs text-red-600 mt-1.5">{uploadError}</p>}
              </section>
            )}

            {uploadedFeatures.length > 0 && (
              <section className="py-3">
                <h3 className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-1.5">
                  <SectionIcon d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" className="w-3.5 h-3.5 text-slate-500" />
                  Maydon
                </h3>
                <p className="text-xl font-bold text-forest-600 mb-3">{totalAreaHa.toLocaleString('uz')} ga</p>
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saveStatus === 'saving'}
                    className="w-full py-2 px-3 rounded-lg bg-forest-600 text-white text-sm font-medium hover:bg-forest-700 focus:outline-none focus:ring-2 focus:ring-forest-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    {saveStatus === 'saving' ? 'Saqlanmoqda...' : saveStatus === 'ok' ? 'Saqlandi' : 'Saqlash'}
                  </button>
                  {saveStatus === 'error' && (
                    <p className="text-xs text-red-600">
                      {saveErrorMsg ? `Xatolik: ${saveErrorMsg}` : "Xatolik. Qayta urinib ko'ring."}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={clearUpload}
                    className="w-full py-2 px-3 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2 transition-colors"
                  >
                    Tozalash
                  </button>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 rounded-xl border border-slate-200/90 shadow-lg shadow-slate-200/40 overflow-hidden bg-slate-100 relative">
        {mapError ? (
          <div className="absolute inset-0 flex items-center justify-center p-6 bg-slate-100">
            <p className="text-sm text-amber-700 font-medium">{mapError}</p>
          </div>
        ) : null}
        <div ref={containerRef} className="absolute inset-0" />
      </div>
    </div>
  );
}
