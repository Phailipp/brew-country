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

/**
 * DACH center coordinates (roughly center of DE + AT + CH).
 */
export const DACH_CENTER = { lat: 48.5, lon: 11.5 };

/** @deprecated Use DACH_CENTER instead */
export const MUNICH_CENTER = DACH_CENTER;

/**
 * Default bounding box: entire DACH region
 * (Deutschland, Österreich, Schweiz).
 *
 * Lat  45.8 (southern Swiss Alps) → 55.1 (northern Germany)
 * Lon   5.8 (western Germany)     → 17.2 (eastern Austria)
 *
 * Cell size = 2 km to keep grid manageable (~470 × 425 ≈ 200 k cells).
 */
export function getDefaultBoundingBox(): GridSpec {
  return {
    minLat: 45.8,
    maxLat: 55.1,
    minLon: 5.8,
    maxLon: 17.2,
    cellSizeMeters: 2000,
  };
}

/**
 * Precompute all grid cells for a given GridSpec.
 */
export function precomputeGrid(spec: GridSpec): { rows: number; cols: number; cells: GridCell[] } {
  const dLat = spec.cellSizeMeters / METERS_PER_DEG_LAT;
  const rows = Math.floor((spec.maxLat - spec.minLat) / dLat);

  // Compute columns based on center latitude
  const centerLat = (spec.minLat + spec.maxLat) / 2;
  const dLon = spec.cellSizeMeters / (METERS_PER_DEG_LAT * Math.cos(centerLat * DEG_TO_RAD));
  const cols = Math.floor((spec.maxLon - spec.minLon) / dLon);

  const cells: GridCell[] = [];

  for (let r = 0; r < rows; r++) {
    const cellLat = spec.minLat + (r + 0.5) * dLat;
    const rowDLon = spec.cellSizeMeters / (METERS_PER_DEG_LAT * Math.cos(cellLat * DEG_TO_RAD));

    for (let c = 0; c < cols; c++) {
      cells.push({
        row: r,
        col: c,
        centerLat: cellLat,
        centerLon: spec.minLon + (c + 0.5) * rowDLon,
      });
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
 * 3. Clamps to DACH bounding box.
 * 4. If estimated cell count exceeds MAX_GRID_CELLS, auto-coarsens.
 */
export function getViewportGridSpec(
  viewport: ViewportBounds,
  zoom: number,
  bufferKm: number = GAME.VIEWPORT_BUFFER_KM,
): GridSpec {
  const dach = getDefaultBoundingBox();

  // Buffer in degrees
  const bufferLat = metersToDegLat(bufferKm * 1000);
  const centerLat = (viewport.south + viewport.north) / 2;
  const bufferLon = metersToDegLon(bufferKm * 1000, centerLat);

  // Expand viewport + clamp to DACH
  const minLat = Math.max(viewport.south - bufferLat, dach.minLat);
  const maxLat = Math.min(viewport.north + bufferLat, dach.maxLat);
  const minLon = Math.max(viewport.west - bufferLon, dach.minLon);
  const maxLon = Math.min(viewport.east + bufferLon, dach.maxLon);

  let cellSizeMeters = getCellSizeForZoom(zoom);

  // Estimate cell count and auto-coarsen if necessary
  const dLat = cellSizeMeters / METERS_PER_DEG_LAT;
  const dLon = cellSizeMeters / (METERS_PER_DEG_LAT * Math.cos(centerLat * DEG_TO_RAD));
  let rows = Math.floor((maxLat - minLat) / dLat);
  let cols = Math.floor((maxLon - minLon) / dLon);
  let estimated = rows * cols;

  // Auto-coarsen: double cell size until under the cap
  while (estimated > GAME.MAX_GRID_CELLS && cellSizeMeters < 10_000) {
    cellSizeMeters = Math.round(cellSizeMeters * 1.5);
    const newDLat = cellSizeMeters / METERS_PER_DEG_LAT;
    const newDLon = cellSizeMeters / (METERS_PER_DEG_LAT * Math.cos(centerLat * DEG_TO_RAD));
    rows = Math.floor((maxLat - minLat) / newDLat);
    cols = Math.floor((maxLon - minLon) / newDLon);
    estimated = rows * cols;
  }

  return { minLat, maxLat, minLon, maxLon, cellSizeMeters };
}
