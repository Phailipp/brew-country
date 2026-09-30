import { contours } from 'd3-contour';
import type { Feature, FeatureCollection, MultiPolygon, Point, Position } from 'geojson';
import type { CellResult, GridSpec, Region } from './types';
import { cellStepDeg } from './geo';

export interface TerritoryProps {
  beerId: string;
}

export interface HotspotProps {
  intensity: number;
}

export interface RegionLabelProps {
  regionId: string;
  beerId: string;
  cellCount: number;
  rank: number;
}

export interface TerritoryGeometry {
  territories: FeatureCollection<MultiPolygon, TerritoryProps>;
  hotspots: FeatureCollection<MultiPolygon, HotspotProps>;
  labels: FeatureCollection<Point, RegionLabelProps>;
}

/** 3×3 box blur of a scalar field; rounds off the staircase of the raster. */
function boxBlur(src: Float32Array, rows: number, cols: number): Float32Array {
  const out = new Float32Array(src.length);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let sum = 0;
      let n = 0;
      for (let dr = -1; dr <= 1; dr++) {
        const nr = r + dr;
        if (nr < 0 || nr >= rows) continue;
        for (let dc = -1; dc <= 1; dc++) {
          const nc = c + dc;
          if (nc < 0 || nc >= cols) continue;
          sum += src[nr * cols + nc];
          n++;
        }
      }
      out[r * cols + c] = sum / n;
    }
  }
  return out;
}

/**
 * Contour a field at 0.5 and project the result from grid space
 * (x = col, y = row, pixel corners) to lon/lat.
 */
function contourToLonLat(
  field: Float32Array, rows: number, cols: number, spec: GridSpec,
): Position[][][] {
  // Pad by one cell so shapes touching the grid edge close cleanly
  const pr = rows + 2;
  const pc = cols + 2;
  const padded = new Float64Array(pr * pc);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) padded[(r + 1) * pc + (c + 1)] = field[r * cols + c];
  }

  const [geom] = contours().size([pc, pr]).thresholds([0.5])(Array.from(padded));
  const { dLat, dLon } = cellStepDeg(spec.cellSizeMeters);
  return geom.coordinates.map((poly) =>
    poly.map((ring) =>
      ring.map(([x, y]) => [
        spec.minLon + (x - 1) * dLon,
        spec.minLat + (y - 1) * dLat,
      ]),
    ),
  );
}

/**
 * Turn the per-cell winners into map-ready vector geometry:
 *  - one smoothed MultiPolygon per beer (territories)
 *  - "hotspots": areas where the lead is thin and a lot is at stake
 *  - one label point per sizeable region
 */
export function buildTerritoryGeometry(
  cells: CellResult[],
  rows: number,
  cols: number,
  spec: GridSpec,
  regions: Region[],
  closeMarginThreshold: number,
  closeMarginMinWeight: number,
): TerritoryGeometry {
  const n = rows * cols;
  const beerIds = new Set<string>();
  for (const cell of cells) if (cell.winnerBeerId) beerIds.add(cell.winnerBeerId);

  const territories: Feature<MultiPolygon, TerritoryProps>[] = [];
  const mask = new Float32Array(n);
  for (const beerId of beerIds) {
    for (let i = 0; i < n; i++) mask[i] = cells[i].winnerBeerId === beerId ? 1 : 0;
    const coordinates = contourToLonLat(boxBlur(mask, rows, cols), rows, cols, spec);
    if (coordinates.length === 0) continue;
    territories.push({
      type: 'Feature',
      properties: { beerId },
      geometry: { type: 'MultiPolygon', coordinates },
    });
  }

  // Hotspots: close margin with meaningful weight on the line
  const hot = new Float32Array(n);
  let anyHot = false;
  for (let i = 0; i < n; i++) {
    const cell = cells[i];
    if (cell.winnerBeerId && cell.runnerUpBeerId
      && cell.margin < closeMarginThreshold
      && cell.totalCount >= closeMarginMinWeight) {
      hot[i] = 1;
      anyHot = true;
    }
  }
  const hotspots: Feature<MultiPolygon, HotspotProps>[] = [];
  if (anyHot) {
    const coordinates = contourToLonLat(boxBlur(hot, rows, cols), rows, cols, spec);
    if (coordinates.length > 0) {
      hotspots.push({
        type: 'Feature',
        properties: { intensity: 1 },
        geometry: { type: 'MultiPolygon', coordinates },
      });
    }
  }

  const minLabelCells = Math.max(12, Math.round(n * 0.002));
  const labels: Feature<Point, RegionLabelProps>[] = regions
    .filter((r) => r.cellCount >= minLabelCells)
    .slice(0, 60)
    .map((r, rank) => ({
      type: 'Feature',
      properties: { regionId: r.id, beerId: r.beerId, cellCount: r.cellCount, rank },
      geometry: { type: 'Point', coordinates: [r.centroidLon, r.centroidLat] },
    }));

  return {
    territories: { type: 'FeatureCollection', features: territories },
    hotspots: { type: 'FeatureCollection', features: hotspots },
    labels: { type: 'FeatureCollection', features: labels },
  };
}
