import type { Vote, CellResult, WeightedVote, GridSpec } from './types';
import { specStepDeg } from './geo';

const KM_PER_DEG_LAT = 111.32;
const DEG_TO_RAD = Math.PI / 180;

interface InfluenceVote {
  lat: number;
  lon: number;
  beerId: string;
  weight: number;
  radiusKm: number;
}

function emptyCell(row: number, col: number): CellResult {
  return {
    row,
    col,
    winnerBeerId: null,
    winnerCount: 0,
    totalCount: 0,
    voteCounts: {},
    runnerUpBeerId: null,
    runnerUpCount: 0,
    margin: 0,
  };
}

/**
 * Compute dominance for every cell of a grid.
 *
 * Vote-centric rasterisation: each vote only visits the cells inside its own
 * radius (O(votes × r²/cell²)) instead of every cell scanning every vote.
 * Flat legacy votes count +1 with `radiusKm`; weighted votes carry their own
 * weight and radius. Pure function, suitable for Web Worker execution.
 */
export function computeDominance(
  spec: GridSpec,
  rows: number,
  cols: number,
  votes: Vote[],
  radiusKm: number,
  weightedVotes: WeightedVote[] = [],
): CellResult[] {
  const all: InfluenceVote[] = [];
  for (const v of votes) all.push({ lat: v.lat, lon: v.lon, beerId: v.beerId, weight: 1, radiusKm });
  for (const wv of weightedVotes) all.push(wv);

  const n = rows * cols;
  if (all.length === 0 || n === 0) {
    const out: CellResult[] = new Array(n);
    for (let i = 0; i < n; i++) out[i] = emptyCell((i / cols) | 0, i % cols);
    return out;
  }

  // Beer index for dense accumulation
  const beerIds: string[] = [];
  const beerIndex = new Map<string, number>();
  for (const v of all) {
    if (!beerIndex.has(v.beerId)) {
      beerIndex.set(v.beerId, beerIds.length);
      beerIds.push(v.beerId);
    }
  }
  const nBeers = beerIds.length;
  const acc = new Float64Array(n * nBeers);

  const { dLat, dLon } = specStepDeg(spec);
  // On coarse (world) grids a small radius would miss every cell centre;
  // every vote reaches at least its own cell.
  const minRadiusKm = (spec.cellSizeMeters / 1000) * 0.75;

  for (const v of all) {
    const b = beerIndex.get(v.beerId)!;
    const radiusKm = Math.max(v.radiusKm, minRadiusKm);
    const rDegLat = radiusKm / KM_PER_DEG_LAT;
    const r2 = radiusKm * radiusKm;
    const rowMin = Math.max(0, Math.floor((v.lat - rDegLat - spec.minLat) / dLat));
    const rowMax = Math.min(rows - 1, Math.floor((v.lat + rDegLat - spec.minLat) / dLat));

    for (let r = rowMin; r <= rowMax; r++) {
      const cLat = spec.minLat + (r + 0.5) * dLat;
      const dy = (cLat - v.lat) * KM_PER_DEG_LAT;
      const rem = r2 - dy * dy;
      if (rem < 0) continue;
      const kmPerDegLon = KM_PER_DEG_LAT * Math.cos(((cLat + v.lat) / 2) * DEG_TO_RAD);
      const halfDegLon = Math.sqrt(rem) / kmPerDegLon;
      const colMin = Math.max(0, Math.ceil((v.lon - halfDegLon - spec.minLon) / dLon - 0.5));
      const colMax = Math.min(cols - 1, Math.floor((v.lon + halfDegLon - spec.minLon) / dLon - 0.5));
      const base = r * cols;
      for (let c = colMin; c <= colMax; c++) {
        acc[(base + c) * nBeers + b] += v.weight;
      }
    }
  }

  const results: CellResult[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const row = (i / cols) | 0;
    const col = i % cols;
    let total = 0;
    let winner = -1;
    let winnerW = 0;
    let runner = -1;
    let runnerW = 0;
    let voteCounts: Record<string, number> | null = null;

    for (let b = 0; b < nBeers; b++) {
      const w = acc[i * nBeers + b];
      if (w <= 0) continue;
      total += w;
      (voteCounts ??= {})[beerIds[b]] = w;
      if (w > winnerW) {
        runner = winner;
        runnerW = winnerW;
        winner = b;
        winnerW = w;
      } else if (w > runnerW) {
        runner = b;
        runnerW = w;
      }
    }

    if (total === 0) {
      results[i] = emptyCell(row, col);
      continue;
    }

    results[i] = {
      row,
      col,
      winnerBeerId: beerIds[winner],
      winnerCount: winnerW,
      totalCount: total,
      voteCounts: voteCounts!,
      runnerUpBeerId: runner >= 0 ? beerIds[runner] : null,
      runnerUpCount: runnerW,
      margin: (winnerW - runnerW) / total,
    };
  }

  return results;
}

/**
 * After smoothing changed a cell's winner, bring the derived fields
 * (winner weight, runner-up, margin) back in line with its vote counts.
 */
function reconcileCell(cell: CellResult): void {
  const winner = cell.winnerBeerId;
  if (winner === null) return;
  let runnerId: string | null = null;
  let runnerW = 0;
  for (const [id, w] of Object.entries(cell.voteCounts)) {
    if (id === winner) continue;
    if (w > runnerW) {
      runnerId = id;
      runnerW = w;
    }
  }
  const winnerW = cell.voteCounts[winner] ?? 0;
  cell.winnerCount = winnerW;
  cell.runnerUpBeerId = runnerId;
  cell.runnerUpCount = runnerW;
  cell.margin = cell.totalCount > 0 ? Math.max(0, winnerW - runnerW) / cell.totalCount : 0;
}

/**
 * Morphological smoothing: replace each cell's winner with the majority winner
 * among its 8-connected neighbourhood. The current winner keeps the cell on
 * ties, which avoids direction-dependent artefacts.
 */
export function smoothWinnerGrid(
  cells: CellResult[],
  rows: number,
  cols: number,
  iterations: number,
): void {
  if (iterations <= 0) return;

  let grid: (string | null)[] = cells.map((c) => c.winnerBeerId);
  let buf: (string | null)[] = new Array(rows * cols).fill(null);
  const counts = new Map<string, number>();

  for (let iter = 0; iter < iterations; iter++) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const current = grid[idx];
        if (current === null) {
          buf[idx] = null;
          continue;
        }

        counts.clear();
        for (let dr = -1; dr <= 1; dr++) {
          const nr = r + dr;
          if (nr < 0 || nr >= rows) continue;
          for (let dc = -1; dc <= 1; dc++) {
            const nc = c + dc;
            if (nc < 0 || nc >= cols) continue;
            const nBeer = grid[nr * cols + nc];
            if (nBeer !== null) counts.set(nBeer, (counts.get(nBeer) ?? 0) + 1);
          }
        }

        let best = current;
        let bestCount = counts.get(current) ?? 0;
        for (const [beerId, count] of counts) {
          if (count > bestCount) {
            best = beerId;
            bestCount = count;
          }
        }
        buf[idx] = best;
      }
    }
    [grid, buf] = [buf, grid];
  }

  for (let i = 0; i < cells.length; i++) {
    if (cells[i].winnerBeerId !== grid[i]) {
      cells[i].winnerBeerId = grid[i];
      reconcileCell(cells[i]);
    }
  }
}

/**
 * Merge small islands: regions with fewer than `minSize` cells
 * are absorbed into the most common neighbouring region.
 */
export function mergeSmallIslands(
  cells: CellResult[],
  rows: number,
  cols: number,
  minSize: number,
): void {
  if (minSize <= 1) return;

  const grid: (string | null)[] = cells.map((c) => c.winnerBeerId);
  const visited = new Uint8Array(rows * cols);
  const neighbours = (ci: number): number[] => {
    const cr = (ci / cols) | 0;
    const cc = ci % cols;
    const out: number[] = [];
    if (cr > 0) out.push(ci - cols);
    if (cr < rows - 1) out.push(ci + cols);
    if (cc > 0) out.push(ci - 1);
    if (cc < cols - 1) out.push(ci + 1);
    return out;
  };

  for (let idx = 0; idx < rows * cols; idx++) {
    if (visited[idx]) continue;
    const beerId = grid[idx];
    visited[idx] = 1;
    if (beerId === null) continue;

    const regionCells: number[] = [];
    const queue: number[] = [idx];
    while (queue.length > 0) {
      const ci = queue.pop()!;
      regionCells.push(ci);
      for (const ni of neighbours(ci)) {
        if (visited[ni] || grid[ni] !== beerId) continue;
        visited[ni] = 1;
        queue.push(ni);
      }
    }

    if (regionCells.length >= minSize) continue;

    const neighbourCounts = new Map<string, number>();
    for (const ci of regionCells) {
      for (const ni of neighbours(ci)) {
        const nb = grid[ni];
        if (nb !== null && nb !== beerId) neighbourCounts.set(nb, (neighbourCounts.get(nb) ?? 0) + 1);
      }
    }

    let replacement: string | null = null;
    let maxCount = 0;
    for (const [nb, count] of neighbourCounts) {
      if (count > maxCount) {
        replacement = nb;
        maxCount = count;
      }
    }

    if (replacement !== null) {
      for (const ci of regionCells) grid[ci] = replacement;
    }
  }

  for (let i = 0; i < cells.length; i++) {
    if (cells[i].winnerBeerId !== grid[i]) {
      cells[i].winnerBeerId = grid[i];
      reconcileCell(cells[i]);
    }
  }
}
