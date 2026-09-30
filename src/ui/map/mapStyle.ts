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

/** Keyless terrain (Mapzen Terrarium DEM on AWS Open Data). */
const TERRAIN_SOURCE = {
  type: 'raster-dem',
  tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
  encoding: 'terrarium',
  tileSize: 256,
  maxzoom: 14,
  attribution: 'Terrain: Mapzen / AWS Open Data',
} as const;

/** Night sky + warm horizon glow; the atmosphere fades out as you zoom into the city. */
const SKY = {
  'sky-color': '#07060a',
  'horizon-color': '#3a2410',
  'fog-color': '#0b0a08',
  'sky-horizon-blend': 0.6,
  'horizon-fog-blend': 0.5,
  'fog-ground-blend': 0.6,
  'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 8, 0],
};

function hillshade(): LayerSpecification {
  return {
    id: 'hillshade',
    type: 'hillshade',
    source: 'terrain-dem',
    paint: {
      'hillshade-exaggeration': ['interpolate', ['linear'], ['zoom'], 5, 0.55, 10, 0.35, 13, 0.15],
      'hillshade-shadow-color': 'rgba(0,0,0,0.55)',
      'hillshade-highlight-color': 'rgba(255,196,120,0.10)',
      'hillshade-accent-color': 'rgba(0,0,0,0.25)',
      'hillshade-illumination-anchor': 'map',
    },
  } as LayerSpecification;
}

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
      'fill-extrusion-color': '#2a241c',
      'fill-extrusion-vertical-gradient': true,
      'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 15.5, ['coalesce', ['get', 'render_height'], 8]],
      'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
      'fill-extrusion-opacity': 0.9,
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
    // Relief sits right above the land cover, below water and roads
    if (layer.id === 'water') layers.push(hillshade());
    // Flat buildings are replaced by the 3D extrusion below
    if (layer.id === 'building') {
      layers.push({ ...layer, maxzoom: 14 } as LayerSpecification);
      layers.push(buildings3d());
      continue;
    }
    layers.push(layer);
  }
  return {
    ...style,
    sources: {
      ...style.sources,
      // Separate sources for relief shading and 3D terrain (better rendering quality)
      'terrain-dem': TERRAIN_SOURCE as never,
      'terrain-3d': TERRAIN_SOURCE as never,
    },
    projection: { type: 'globe' },
    sky: SKY as never,
    layers,
  };
}

/** Minimal style used when the tile provider is unreachable: territories still render. */
export function fallbackStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {},
    projection: { type: 'globe' },
    sky: SKY as never,
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
