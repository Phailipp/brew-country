import type { StyleSpecification, LayerSpecification } from 'maplibre-gl';

/** Keyless vector tiles (OpenStreetMap data via OpenFreeMap). */
const BASE_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';

/** Warm "Nachtbiergarten" palette applied on top of the base dark style. */
const PAINT_OVERRIDES: Record<string, Record<string, unknown>> = {
  background: { 'background-color': '#0b0a08' },
  water: { 'fill-color': '#0b1117' },
  waterway: { 'line-color': '#0b1117' },
  landuse_residential: { 'fill-color': '#100e0b' },
  landcover_wood: { 'fill-color': '#12150f' },
  landuse_park: { 'fill-color': '#131710' },
  highway_path: { 'line-color': '#1a1712' },
  highway_minor: { 'line-color': '#1e1a15' },
  highway_major_casing: { 'line-color': 'rgba(70,60,45,0.6)' },
  highway_major_inner: { 'line-color': '#1a1712' },
  highway_major_subtle: { 'line-color': '#2b251d' },
  highway_motorway_casing: { 'line-color': 'rgba(80,68,50,0.6)' },
  highway_motorway_inner: { 'line-color': '#221d17' },
  highway_motorway_subtle: { 'line-color': '#2b251d' },
  railway_transit: { 'line-color': '#241f19' },
  railway_minor: { 'line-color': '#241f19' },
  railway: { 'line-color': '#241f19' },
  boundary_state: { 'line-color': '#3a3228' },
  'boundary_country_z0-4': { 'line-color': '#4a4034' },
  'boundary_country_z5-': { 'line-color': '#4a4034' },
  highway_name_other: { 'text-color': '#6f6556', 'text-halo-color': '#0b0a08' },
  highway_name_motorway: { 'text-color': '#7d7262' },
  water_name: { 'text-color': '#4d6a80', 'text-halo-color': '#0b0a08' },
};

const PLACE_TEXT = { 'text-color': '#a89a84', 'text-halo-color': 'rgba(11,10,8,0.85)', 'text-halo-width': 1.4 };
const SUBURB_TEXT = { 'text-color': '#d9c9ae', 'text-halo-color': 'rgba(11,10,8,0.9)', 'text-halo-width': 1.6 };

/** First layer id that territories should be inserted *below* (roads + labels stay on top). */
export const TERRITORY_BEFORE_ID = 'highway_path';

function buildings3d(): LayerSpecification {
  return {
    id: 'building-3d',
    type: 'fill-extrusion',
    source: 'openmaptiles',
    'source-layer': 'building',
    minzoom: 14,
    paint: {
      'fill-extrusion-color': '#1d1913',
      'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 15.5, ['coalesce', ['get', 'render_height'], 8]],
      'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
      'fill-extrusion-opacity': 0.85,
    },
  };
}

/** German place and street names first, local name as fallback. */
const GERMAN_NAME = ['coalesce', ['get', 'name:de'], ['get', 'name']];

function customize(style: StyleSpecification): StyleSpecification {
  const layers: LayerSpecification[] = [];
  for (const layer of style.layers) {
    if (layer.type === 'symbol' && layer.layout && JSON.stringify(layer.layout['text-field'] ?? '').includes('name_en')) {
      (layer.layout as Record<string, unknown>)['text-field'] = GERMAN_NAME;
    }
    const override = PAINT_OVERRIDES[layer.id];
    if (override) Object.assign((layer.paint ??= {} as never), override);
    if (layer.id === 'place_suburb' || layer.id === 'place_other') {
      Object.assign((layer.paint ??= {} as never), SUBURB_TEXT);
    } else if (layer.id.startsWith('place_')) {
      Object.assign((layer.paint ??= {} as never), PLACE_TEXT);
    }
    // Flat buildings are replaced by the 3D extrusion below
    if (layer.id === 'building') {
      layers.push({ ...layer, maxzoom: 14 } as LayerSpecification);
      layers.push(buildings3d());
      continue;
    }
    layers.push(layer);
  }
  return { ...style, layers };
}

/** Minimal style used when the tile provider is unreachable: territories still render. */
export function fallbackStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {},
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#0b0a08' } },
      { id: TERRITORY_BEFORE_ID, type: 'background', paint: { 'background-opacity': 0 } },
    ],
  };
}

export async function loadMapStyle(): Promise<StyleSpecification> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(BASE_STYLE_URL, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`style ${res.status}`);
    return customize((await res.json()) as StyleSpecification);
  } catch {
    return fallbackStyle();
  }
}
