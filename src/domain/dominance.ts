import type { Vote, GridCell, CellResult, WeightedVote } from './types';
import { haversineDistanceKm } from './geo';

/**
 * Compute dominance for a set of grid cells given votes and a radius.
 * Pure function, suitable for Web Worker execution.
 *
 * Supports both old-style flat votes (+1 each) and new weighted votes.
 */
export function computeDominance(
  cells: GridCell[],
  votes: Vote[],
  radiusKm: number,
  weightedVotes?: WeightedVote[]
): CellResult[] {
  const hasWeighted = weightedVotes && weightedVotes.length > 0;

  if (votes.length === 0 && !hasWeighted) {
    return cells.map((c) => ({
      row: c.row,
      col: c.col,
      winnerBeerId: null,
      winnerCount: 0,
      totalCount: 0,
      voteCounts: {},
      runnerUpBeerId: null,
      runnerUpCount: 0,
      margin: 0,
    }));
  }

  // Precompute a rough bounding-box filter range in degrees
  // For weighted votes, each may have its own radius, so use max
  let maxRadius = radiusKm;
  if (hasWeighted) {
    for (const wv of weightedVotes!) {
      if (wv.radiusKm > maxRadius) maxRadius = wv.radiusKm;
    }
  }
  const radiusDegLat = maxRadius / 111.32;
  const radiusDegLon = maxRadius / (111.32 * Math.cos(45 * Math.PI / 180));

  const results: CellResult[] = new Array(cells.length);

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const weights = new Map<string, number>();
    let totalWeight = 0;

    // Process flat votes (weight=1, default radius)
    for (let v = 0; v < votes.length; v++) {
      const vote = votes[v];

      if (
        Math.abs(vote.lat - cell.centerLat) > radiusDegLat ||
        Math.abs(vote.lon - cell.centerLon) > radiusDegLon
      ) {
        continue;
      }

      const dist = haversineDistanceKm(
        cell.centerLat, cell.centerLon,
        vote.lat, vote.lon
      );

      if (dist <= radiusKm) {
        const prev = weights.get(vote.beerId) ?? 0;
        weights.set(vote.beerId, prev + 1);
        totalWeight += 1;
      }
    }

    // Process weighted votes (custom weight + radius) — additive
    if (hasWeighted) {
      for (let v = 0; v < weightedVotes!.length; v++) {
        const wv = weightedVotes![v];

        if (
          Math.abs(wv.lat - cell.centerLat) > radiusDegLat ||
          Math.abs(wv.lon - cell.centerLon) > radiusDegLon
        ) {
          continue;
        }

        const dist = haversineDistanceKm(
          cell.centerLat, cell.centerLon,
          wv.lat, wv.lon
        );

        if (dist <= wv.radiusKm) {
          const prev = weights.get(wv.beerId) ?? 0;
          weights.set(wv.beerId, prev + wv.weight);
          totalWeight += wv.weight;
        }
      }
    }

    if (totalWeight === 0) {
      results[i] = {
        row: cell.row,
        col: cell.col,
        winnerBeerId: null,
        winnerCount: 0,
        totalCount: 0,
        voteCounts: {},
        runnerUpBeerId: null,
        runnerUpCount: 0,
        margin: 0,
      };
    } else {
      let winnerId: string | null = null;
      let winnerWeight = 0;
      let runnerUpId: string | null = null;
      let runnerUpWeight = 0;

      const voteCounts: Record<string, number> = {};
      for (const [beerId, w] of weights) {
        voteCounts[beerId] = w;
        if (w > winnerWeight) {
          runnerUpId = winnerId;
          runnerUpWeight = winnerWeight;
          winnerId = beerId;
          winnerWeight = w;
        } else if (w > runnerUpWeight) {
          runnerUpId = beerId;
          runnerUpWeight = w;
        }
      }

      const margin = totalWeight >= 0.001
        ? (winnerWeight - runnerUpWeight) / totalWeight
        : 1.0;

      results[i] = {
        row: cell.row,
        col: cell.col,
        winnerBeerId: winnerId,
        winnerCount: winnerWeight,
        totalCount: totalWeight,
        voteCounts,
        runnerUpBeerId: runnerUpId,
        runnerUpCount: runnerUpWeight,
        margin,
      };
    }
  }

  return results;
}

/**
 * Morphological smoothing: replace each cell's winner with the majority winner
 * among its 8-connected neighbors (including itself). Reduces jagged borders.
 */
export function smoothWinnerGrid(
  cells: CellResult[],
  rows: number,
  cols: number,
  iterations: number
): void {
  if (iterations <= 0) return;

  const grid: (string | null)[] = new Array(rows * cols).fill(null);
  for (const cell of cells) {
    grid[cell.row * cols + cell.col] = cell.winnerBeerId;
  }

  const buf: (string | null)[] = new Array(rows * cols).fill(null);

  for (let iter = 0; iter < iterations; iter++) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const current = grid[idx];
        if (current === null) {
          buf[idx] = null;
          continue;
        }

        const neighborCounts = new Map<string, number>();
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
            const nBeer = grid[nr * cols + nc];
            if (nBeer !== null) {
              neighborCounts.set(nBeer, (neighborCounts.get(nBeer) ?? 0) + 1);
            }
          }
        }

        let best = current;
        let bestCount = 0;
        for (const [beerId, count] of neighborCounts) {
          if (count > bestCount) {
            best = beerId;
            bestCount = count;
          }
        }
        buf[idx] = best;
      }
    }

    for (let i = 0; i < grid.length; i++) {
      grid[i] = buf[i];
    }
  }

  for (const cell of cells) {
    cell.winnerBeerId = grid[cell.row * cols + cell.col];
  }
}

/**
 * Merge small islands: regions with fewer than `minSize` cells
 * are absorbed into the most common neighboring region.
 */
export function mergeSmallIslands(
  cells: CellResult[],
  rows: number,
  cols: number,
  minSize: number
): void {
  if (minSize <= 1) return;

  const grid: (string | null)[] = new Array(rows * cols).fill(null);
  for (const cell of cells) {
    grid[cell.row * cols + cell.col] = cell.winnerBeerId;
  }

  const visited = new Uint8Array(rows * cols);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (visited[idx]) continue;
      const beerId = grid[idx];
      if (beerId === null) {
        visited[idx] = 1;
        continue;
      }

      const regionCells: number[] = [];
      const queue: number[] = [idx];
      visited[idx] = 1;

      while (queue.length > 0) {
        const ci = queue.pop()!;
        regionCells.push(ci);
        const cr = Math.floor(ci / cols);
        const cc = ci % cols;

        const neighbors = [
          cr > 0 ? (cr - 1) * cols + cc : -1,
          cr < rows - 1 ? (cr + 1) * cols + cc : -1,
          cc > 0 ? cr * cols + (cc - 1) : -1,
          cc < cols - 1 ? cr * cols + (cc + 1) : -1,
        ];

        for (const ni of neighbors) {
          if (ni < 0 || visited[ni]) continue;
          if (grid[ni] !== beerId) continue;
          visited[ni] = 1;
          queue.push(ni);
        }
      }

      if (regionCells.length >= minSize) continue;

      const neighborBeerCounts = new Map<string, number>();
      for (const ci of regionCells) {
        const cr = Math.floor(ci / cols);
        const cc = ci % cols;
        const neighbors = [
          cr > 0 ? (cr - 1) * cols + cc : -1,
          cr < rows - 1 ? (cr + 1) * cols + cc : -1,
          cc > 0 ? cr * cols + (cc - 1) : -1,
          cc < cols - 1 ? cr * cols + (cc + 1) : -1,
        ];
        for (const ni of neighbors) {
          if (ni < 0) continue;
          const nb = grid[ni];
          if (nb !== null && nb !== beerId) {
            neighborBeerCounts.set(nb, (neighborBeerCounts.get(nb) ?? 0) + 1);
          }
        }
      }

      let replacementBeer: string | null = null;
      let maxCount = 0;
      for (const [nb, count] of neighborBeerCounts) {
        if (count > maxCount) {
          replacementBeer = nb;
          maxCount = count;
        }
      }

      if (replacementBeer !== null) {
        for (const ci of regionCells) {
          grid[ci] = replacementBeer;
        }
      }
    }
  }

  for (const cell of cells) {
    cell.winnerBeerId = grid[cell.row * cols + cell.col];
  }
}
