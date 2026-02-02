'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from 'geojson';
import area from '@turf/area';

const UZ_CENTER: [number, number] = [41.3, 64.5];
const UZ_ZOOM = 5;
const REGIONS_URL = '/public/geo/uzbekistan_regions.geojson';

type RegionFeature = Feature<Polygon | MultiPolygon, { ADM1_EN?: string; ADM1_UZ?: string; ADM1_RU?: string }>;
type UploadedFeature = Feature<Polygon | MultiPolygon, Record<string, unknown>> & {
  properties?: { name?: string; type?: string; area_ha?: number; region?: string };
};

function getRegionName(f: RegionFeature): string {
  const p = f.properties;
  return (p?.ADM1_UZ || p?.ADM1_EN || p?.ADM1_RU || 'Viloyat') as string;
}

function calcAreaHa(geom: Polygon | MultiPolygon): number {
  const poly = geom.type === 'Polygon' ? geom : { type: 'MultiPolygon' as const, coordinates: geom.coordinates };
  const sqM = area({ type: 'Feature', properties: {}, geometry: poly });
  return Math.round((sqM / 10000) * 10) / 10;
}

export default function ForestCreateMap() {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const regionsLayerRef = useRef<L.GeoJSON | null>(null);
  const uploadLayerRef = useRef<L.GeoJSON | null>(null);

  const [selectedRegion, setSelectedRegion] = useState<RegionFeature | null>(null);
  const [uploadedFeatures, setUploadedFeatures] = useState<UploadedFeature[]>([]);
  const [totalAreaHa, setTotalAreaHa] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle');

  const initMap = useCallback(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: UZ_CENTER, zoom: UZ_ZOOM });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
    }).addTo(map);
    mapRef.current = map;
  }, []);

  useEffect(() => {
    initMap();
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      regionsLayerRef.current = null;
      uploadLayerRef.current = null;
    };
  }, [initMap]);

  useEffect(() => {
    if (!mapRef.current) return;
    fetch(REGIONS_URL)
      .then((r) => r.json())
      .then((fc: FeatureCollection) => {
        if (!mapRef.current) return;
        const layer = L.geoJSON(fc, {
          style: () => ({ color: '#166534', weight: 2, fillColor: '#22c55e', fillOpacity: 0.15 }),
          onEachFeature: (feature, lyr) => {
            lyr.on('click', () => {
              setSelectedRegion(feature as RegionFeature);
              const layer = lyr as L.Polygon;
              if (layer.getBounds && mapRef.current) {
                mapRef.current.fitBounds(layer.getBounds().pad(0.1), { maxZoom: 11 });
              }
            });
          },
        }).addTo(mapRef.current);
        regionsLayerRef.current = layer;
      })
      .catch(() => setUploadError('Viloyatlar xaritasi yuklanmadi'));
  }, []);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const geojson = JSON.parse(reader.result as string) as FeatureCollection;
        const features = (geojson.features || []) as UploadedFeature[];
        const withArea = features.map((f) => {
          if (!f.geometry || f.geometry.type === 'Point' || f.geometry.type === 'LineString') return null;
          const areaHa = calcAreaHa(f.geometry as Polygon | MultiPolygon);
          return { ...f, properties: { ...f.properties, area_ha: areaHa } };
        }).filter(Boolean) as UploadedFeature[];
        setUploadedFeatures(withArea);
        const total = withArea.reduce((s, f) => s + (f.properties?.area_ha ?? 0), 0);
        setTotalAreaHa(total);
        if (!mapRef.current) return;
        uploadLayerRef.current?.remove();
        const getStyle = (type?: string) => {
          const t = (type ?? 'forest').toLowerCase();
          if (t === 'lease' || t === 'ijara') return { color: '#ca8a04', weight: 2, fillColor: '#eab308', fillOpacity: 0.4 };
          if (t === 'risk' || t === 'xavf') return { color: '#b91c1c', weight: 2, fillColor: '#ef4444', fillOpacity: 0.4 };
          return { color: '#166534', weight: 2, fillColor: '#22c55e', fillOpacity: 0.35 };
        };
        const layer = L.geoJSON(
          { type: 'FeatureCollection', features: withArea },
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
      } catch {
        setUploadError('GeoJSON fayl formati noto‘g‘ri');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const clearUpload = () => {
    setUploadedFeatures([]);
    setTotalAreaHa(0);
    setSaveStatus('idle');
    uploadLayerRef.current?.remove();
    uploadLayerRef.current = null;
  };

  const handleSave = async () => {
    if (uploadedFeatures.length === 0) return;
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/v1/forest-areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geojson: { type: 'FeatureCollection', features: uploadedFeatures },
          regionName: selectedRegion ? getRegionName(selectedRegion) : undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSaveStatus('ok');
    } catch {
      setSaveStatus('error');
    }
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-var(--topbar-height)-8rem)]">
      <div className="w-72 shrink-0 flex flex-col gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <h2 className="font-semibold text-slate-800 mb-2">1. Viloyat tanlang</h2>
          {selectedRegion ? (
            <p className="text-sm text-forest-600 font-medium">{getRegionName(selectedRegion)}</p>
          ) : (
            <p className="text-sm text-slate-500">Xaritada viloyat ustiga bosing</p>
          )}
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <h2 className="font-semibold text-slate-800 mb-2">2. GeoJSON yuklash</h2>
          <label className="block">
            <span className="sr-only">GeoJSON tanlang</span>
            <input
              type="file"
              accept=".geojson,.json"
              onChange={handleFile}
              className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-forest-100 file:text-forest-700 file:font-medium hover:file:bg-forest-200"
            />
          </label>
          {uploadError && <p className="text-sm text-red-600 mt-2">{uploadError}</p>}
        </div>
        {uploadedFeatures.length > 0 && (
          <>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <h2 className="font-semibold text-slate-800 mb-2">Hudud maydoni</h2>
              <p className="text-2xl font-bold text-forest-600">{totalAreaHa.toLocaleString('uz')} ga</p>
              <p className="text-xs text-slate-500 mt-1">Avtomatik hisoblangan</p>
              <button
                type="button"
                onClick={handleSave}
                disabled={saveStatus === 'saving'}
                className="mt-3 w-full py-2 px-3 rounded-lg bg-forest-600 text-white text-sm font-medium hover:bg-forest-700 disabled:opacity-60"
              >
                {saveStatus === 'saving' ? 'Saqlanmoqda...' : saveStatus === 'ok' ? 'Saqlandi' : 'Saqlash'}
              </button>
              {saveStatus === 'error' && <p className="text-xs text-red-600 mt-1">Xatolik. Qayta urinib ko‘ring.</p>}
              <button
                type="button"
                onClick={clearUpload}
                className="mt-2 text-sm text-slate-600 hover:text-red-600"
              >
                Tozalash
              </button>
            </div>
          </>
        )}
      </div>
      <div ref={containerRef} className="flex-1 min-h-0 rounded-xl border border-slate-200 overflow-hidden bg-slate-100" />
    </div>
  );
}
