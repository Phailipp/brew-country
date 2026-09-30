import { describe, it, expect } from 'vitest';
import { computeDominance, smoothWinnerGrid, mergeSmallIslands } from '../domain/dominance';
import { cellAt, gridDims, getViewportGridSpec, haversineDistanceKm, cellStepDeg } from '../domain/geo';
import { extractRegionsWithLabels, findRegionForCell } from '../domain/regions';
import { buildTerritoryGeometry } from '../domain/territoryGeometry';
import type { GridSpec, Vote, WeightedVote } from '../domain/types';

const MUNICH = { lat: 48.137, lon: 11.575 };

function spec(cellSizeMeters = 1000, halfDeg = 0.4): GridSpec {
  return {
    minLat: MUNICH.lat - halfDeg,
    maxLat: MUNICH.lat + halfDeg,
    minLon: MUNICH.lon - halfDeg,
    maxLon: MUNICH.lon + halfDeg,
    cellSizeMeters,
  };
}

function vote(id: string, lat: number, lon: number, beerId: string): Vote {
  return { id, lat, lon, beerId, timestamp: 0 };
}

describe('computeDominance', () => {
  it('returns empty cells without votes', () => {
    const s = spec();
    const { rows, cols } = gridDims(s);
    const cells = computeDominance(s, rows, cols, [], 5);
    expect(cells).toHaveLength(rows * cols);
    expect(cells.every((c) => c.winnerBeerId === null)).toBe(true);
  });

  it('covers exactly the cells whose centre lies inside the radius (incl. east/west edge)', () => {
    const s = spec(1000);
    const { rows, cols, dLat, dLon } = gridDims(s);
    const radiusKm = 10;
    const cells = computeDominance(s, rows, cols, [vote('a', MUNICH.lat, MUNICH.lon, 'augustiner')], radiusKm);

    let mismatches = 0;
    for (const c of cells) {
      const lat = s.minLat + (c.row + 0.5) * dLat;
      const lon = s.minLon + (c.col + 0.5) * dLon;
      const d = haversineDistanceKm(lat, lon, MUNICH.lat, MUNICH.lon);
      // Allow the tiny equirectangular-vs-haversine band right at the rim
      if (Math.abs(d - radiusKm) < 0.05) continue;
      const inside = d <= radiusKm;
      if (inside !== (c.winnerBeerId === 'augustiner')) mismatches++;
    }
    expect(mismatches).toBe(0);

    // Regression: the old cos(45°) prefilter dropped cells at the east/west rim
    const east = cellAt(s, rows, cols, MUNICH.lat, MUNICH.lon + 9.5 / (111.32 * Math.cos(MUNICH.lat * Math.PI / 180)));
    expect(east).not.toBeNull();
    expect(cells[east!.row * cols + east!.col].winnerBeerId).toBe('augustiner');
  });

  it('sums weights and reports winner, runner-up and margin', () => {
    const s = spec();
    const { rows, cols } = gridDims(s);
    const weighted: WeightedVote[] = [
      { id: 'w1', lat: MUNICH.lat, lon: MUNICH.lon, beerId: 'paulaner', weight: 3, radiusKm: 5, source: 'home' },
      { id: 'w2', lat: MUNICH.lat, lon: MUNICH.lon, beerId: 'spaten', weight: 1, radiusKm: 5, source: 'drink' },
    ];
    const cells = computeDominance(s, rows, cols, [], 5, weighted);
    const pos = cellAt(s, rows, cols, MUNICH.lat, MUNICH.lon)!;
    const cell = cells[pos.row * cols + pos.col];
    expect(cell.winnerBeerId).toBe('paulaner');
    expect(cell.runnerUpBeerId).toBe('spaten');
    expect(cell.totalCount).toBeCloseTo(4);
    expect(cell.margin).toBeCloseTo(0.5);
  });
});

describe('post-processing keeps cells consistent', () => {
  it('smoothing a lone cell away updates winner weight and margin', () => {
    const s = spec(1000, 0.1);
    const { rows, cols } = gridDims(s);
    // Big paulaner area with one tiny augustiner speck in the middle
    const votes = [
      vote('p', MUNICH.lat, MUNICH.lon, 'paulaner'),
      ...Array.from({ length: 3 }, (_, i) => vote(`a${i}`, MUNICH.lat, MUNICH.lon, 'augustiner')),
    ];
    const cells = computeDominance(s, rows, cols, votes, 0.4);
    const bg = computeDominance(s, rows, cols, [vote('bg', MUNICH.lat, MUNICH.lon, 'paulaner')], 20);
    // merge: every cell gets paulaner background weight
    for (let i = 0; i < cells.length; i++) {
      if (cells[i].winnerBeerId === null) cells[i] = bg[i];
    }
    smoothWinnerGrid(cells, rows, cols, 2);
    mergeSmallIslands(cells, rows, cols, 4);
    for (const c of cells) {
      if (!c.winnerBeerId) continue;
      expect(c.winnerCount).toBeCloseTo(c.voteCounts[c.winnerBeerId] ?? 0);
      expect(c.margin).toBeGreaterThanOrEqual(0);
      expect(c.margin).toBeLessThanOrEqual(1);
    }
  });
});

describe('global grid', () => {
  it('snaps viewport grids to one lattice so panning does not shift cells', () => {
    const a = getViewportGridSpec({ south: 48.0, north: 48.3, west: 11.3, east: 11.8 }, 12);
    const b = getViewportGridSpec({ south: 48.013, north: 48.313, west: 11.337, east: 11.837 }, 12);
    expect(a.cellSizeMeters).toBe(b.cellSizeMeters);
    const { dLat, dLon } = cellStepDeg(a.cellSizeMeters);
    const offLat = (b.minLat - a.minLat) / dLat;
    const offLon = (b.minLon - a.minLon) / dLon;
    expect(Math.abs(offLat - Math.round(offLat))).toBeLessThan(1e-6);
    expect(Math.abs(offLon - Math.round(offLon))).toBeLessThan(1e-6);
  });
});

describe('regions + geometry', () => {
  it('labels every claimed cell with its region and builds polygons per beer', () => {
    const s = spec(1000, 0.3);
    const { rows, cols } = gridDims(s);
    const votes = [
      vote('w', MUNICH.lat, MUNICH.lon - 0.12, 'augustiner'),
      vote('e', MUNICH.lat, MUNICH.lon + 0.12, 'paulaner'),
    ];
    const cells = computeDominance(s, rows, cols, votes, 6);
    const data = { rows, cols, cells, gridSpec: s };
    const extraction = extractRegionsWithLabels(data);

    expect(extraction.regions.map((r) => r.beerId).sort()).toEqual(['augustiner', 'paulaner']);
    const west = cellAt(s, rows, cols, MUNICH.lat, MUNICH.lon - 0.12)!;
    expect(findRegionForCell(west.row, west.col, extraction, data)?.beerId).toBe('augustiner');

    const geo = buildTerritoryGeometry(cells, rows, cols, s, extraction.regions, 0.08, 1);
    expect(geo.territories.features.map((f) => f.properties.beerId).sort()).toEqual(['augustiner', 'paulaner']);
    for (const f of geo.territories.features) {
      for (const poly of f.geometry.coordinates) {
        for (const [lon, lat] of poly[0]) {
          expect(lon).toBeGreaterThanOrEqual(s.minLon - 0.05);
          expect(lon).toBeLessThanOrEqual(s.maxLon + 0.05);
          expect(lat).toBeGreaterThanOrEqual(s.minLat - 0.05);
          expect(lat).toBeLessThanOrEqual(s.maxLat + 0.05);
        }
      }
    }
    expect(geo.labels.features.length).toBeGreaterThan(0);
  });
});
