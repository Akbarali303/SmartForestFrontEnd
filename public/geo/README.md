# Geo data

Place `uzbekistan_regions.geojson` here for local serving.

If missing, the map falls back to:
https://raw.githubusercontent.com/akbartus/GeoJSON-Uzbekistan/main/geojson/uzbekistan_regional.geojson

## Forest zones (demo)

`forest_zones_demo.json` — temporary demo forest zones for Uzbekistan by region.
Replace with official GIS forest data when available:
- Keep the GeoJSON FeatureCollection format
- Each feature: `{ type: "Feature", properties: { region, name }, geometry: { type: "Polygon", coordinates: [...] } }`
- Update `FOREST_ZONES_URL` in map/index.html to point to the new file
