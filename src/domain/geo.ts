import type { GridSpec, GridCell, ViewportBounds } from './types';
import { GAME } from '../config/constants';

const DEG_TO_RAD = Math.PI / 180;
const EARTH_RADIUS_KM = 6371;
const METERS_PER_DEG_LAT = 111_320;

/**
 * Haversine distance in km between two lat/lon points.
 */
export function haversineDistanceKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLon = (lon2 - lon1) * DEG_TO_RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) *
    Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const MUNICH_CENTER = { lat: 48.137, lon: 11.575 };

/** Where the map opens when nothing better (home, last view) is known. */
export const DEFAULT_CENTER = MUNICH_CENTER;

/** Web-Mercator limit: tiles and grids stop here. */
export const WORLD_MAX_LAT = 85;

/**
 * Fallback grid covering the whole world. The lattice origin is (0°, 0°), so
 * every viewport grid anywhere on Earth snaps onto the same global lattice.
 */
export function getDefaultBoundingBox(): GridSpec {
  return {
    minLat: -WORLD_MAX_LAT,
    maxLat: WORLD_MAX_LAT,
    minLon: -180,
    maxLon: 180,
    cellSizeMeters: 200_000,
    refLat: 0,
  };
}

/** Lattice origin of the global grid. */
export const GRID_ORIGIN = { lat: 0, lon: 0 };

/** Reference latitude used when a spec carries none (legacy/tests). */
export const GRID_REF_LAT = 45;

/** Width of the latitude bands that share one longitude step. */
const REF_LAT_BAND = 15;

/**
 * Reference latitude for the longitude step. Cells stay roughly square
 * anywhere on Earth: the step is derived from the 15° band around the
 * viewport, so it only changes when you travel far north/south — never
 * while panning around a city.
 */
export function refLatFor(lat: number): number {
  const band = Math.round(Math.abs(lat) / REF_LAT_BAND) * REF_LAT_BAND;
  return Math.min(75, band);
}

/** Degree step of one grid cell (lat / lon) for a given cell size. */
export function cellStepDeg(cellSizeMeters: number, refLat: number = GRID_REF_LAT): { dLat: number; dLon: number } {
  return {
    dLat: cellSizeMeters / METERS_PER_DEG_LAT,
    dLon: cellSizeMeters / (METERS_PER_DEG_LAT * Math.cos(refLat * DEG_TO_RAD)),
  };
}

/** Degree step for a grid spec. */
export function specStepDeg(spec: GridSpec): { dLat: number; dLon: number } {
  return cellStepDeg(spec.cellSizeMeters, spec.refLat ?? GRID_REF_LAT);
}

/** Grid dimensions for a spec. */
export function gridDims(spec: GridSpec): { rows: number; cols: number; dLat: number; dLon: number } {
  const { dLat, dLon } = specStepDeg(spec);
  return {
    rows: Math.max(0, Math.round((spec.maxLat - spec.minLat) / dLat)),
    cols: Math.max(0, Math.round((spec.maxLon - spec.minLon) / dLon)),
    dLat,
    dLon,
  };
}

/** Row/col of the cell containing a point, or null if outside the grid. */
export function cellAt(
  spec: GridSpec, rows: number, cols: number, lat: number, lon: number,
): { row: number; col: number } | null {
  const { dLat, dLon } = specStepDeg(spec);
  const row = Math.floor((lat - spec.minLat) / dLat);
  const col = Math.floor((lon - spec.minLon) / dLon);
  if (row < 0 || row >= rows || col < 0 || col >= cols) return null;
  return { row, col };
}

/**
 * Precompute all grid cells for a given GridSpec (uniform lat/lon lattice).
 */
export function precomputeGrid(spec: GridSpec): { rows: number; cols: number; cells: GridCell[] } {
  const { rows, cols, dLat, dLon } = gridDims(spec);
  const cells: GridCell[] = new Array(rows * cols);

  for (let r = 0; r < rows; r++) {
    const cellLat = spec.minLat + (r + 0.5) * dLat;
    for (let c = 0; c < cols; c++) {
      cells[r * cols + c] = {
        row: r,
        col: c,
        centerLat: cellLat,
        centerLon: spec.minLon + (c + 0.5) * dLon,
      };
    }
  }

  return { rows, cols, cells };
}

/**
 * Convert meters to approximate degree offsets.
 */
export function metersToDegLat(meters: number): number {
  return meters / METERS_PER_DEG_LAT;
}

export function metersToDegLon(meters: number, lat: number): number {
  return meters / (METERS_PER_DEG_LAT * Math.cos(lat * DEG_TO_RAD));
}

// ── Zoom-adaptive grid helpers ────────────────────────────

/**
 * Interpolate cell size (meters) for a given zoom level.
 * Uses the ZOOM_CELL_SIZES mapping and linearly interpolates between anchors.
 * Clamps at the lowest / highest defined zoom.
 */
export function getCellSizeForZoom(zoom: number): number {
  const map = GAME.ZOOM_CELL_SIZES;
  const anchors = Object.keys(map).map(Number).sort((a, b) => a - b);

  if (anchors.length === 0) return GAME.CELL_SIZE_METERS;
  if (zoom <= anchors[0]) return map[anchors[0]];
  if (zoom >= anchors[anchors.length - 1]) return map[anchors[anchors.length - 1]];

  // Find the two bracketing anchors
  for (let i = 0; i < anchors.length - 1; i++) {
    const lo = anchors[i];
    const hi = anchors[i + 1];
    if (zoom >= lo && zoom <= hi) {
      const t = (zoom - lo) / (hi - lo);
      return Math.round(map[lo] + t * (map[hi] - map[lo]));
    }
  }

  return GAME.CELL_SIZE_METERS;
}

/**
 * Build a viewport-bounded GridSpec for the current map view + zoom.
 *
 * 1. Expands the viewport by `bufferKm` on each side so that
 *    nearby votes outside the visible area still influence cells.
 * 2. Picks cell size via `getCellSizeForZoom(zoom)`.
 * 3. Clamps to the world (±85° lat, ±180° lon).
 * 4. If estimated cell count exceeds MAX_GRID_CELLS, auto-coarsens.
 * 5. Snaps to the global lattice (origin 0°/0°, per-band lon step).
 */
export function getViewportGridSpec(
  viewport: ViewportBounds,
  zoom: number,
  bufferKm: number = GAME.VIEWPORT_BUFFER_KM,
): GridSpec {
  const centerLat = Math.max(-WORLD_MAX_LAT, Math.min(WORLD_MAX_LAT, (viewport.south + viewport.north) / 2));
  const refLat = refLatFor(centerLat);

  const bufferLat = metersToDegLat(bufferKm * 1000);
  const bufferLon = metersToDegLon(bufferKm * 1000, centerLat);

  const minLat = Math.max(viewport.south - bufferLat, -WORLD_MAX_LAT);
  const maxLat = Math.min(viewport.north + bufferLat, WORLD_MAX_LAT);
  // Wrapped views (globe / world copies) can report west < -180 or east > 180
  const minLon = Math.max(viewport.west - bufferLon, -180);
  const maxLon = Math.min(viewport.east + bufferLon, 180);

  let cellSizeMeters = getCellSizeForZoom(zoom);

  const estimate = (size: number) => {
    const { dLat, dLon } = cellStepDeg(size, refLat);
    return ((maxLat - minLat) / dLat) * ((maxLon - minLon) / dLon);
  };
  while (estimate(cellSizeMeters) > GAME.MAX_GRID_CELLS && cellSizeMeters < 1_000_000) {
    cellSizeMeters = Math.round(cellSizeMeters * 1.5);
  }

  const { dLat, dLon } = cellStepDeg(cellSizeMeters, refLat);
  const snap = (v: number, origin: number, step: number, fn: (x: number) => number) =>
    origin + fn((v - origin) / step) * step;

  return {
    minLat: snap(minLat, GRID_ORIGIN.lat, dLat, Math.floor),
    maxLat: snap(maxLat, GRID_ORIGIN.lat, dLat, Math.ceil),
    minLon: snap(minLon, GRID_ORIGIN.lon, dLon, Math.floor),
    maxLon: snap(maxLon, GRID_ORIGIN.lon, dLon, Math.ceil),
    cellSizeMeters,
    refLat,
  };
}
