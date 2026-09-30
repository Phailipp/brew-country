import type { DominanceResult, Region } from './types';
import { specStepDeg, GRID_ORIGIN } from './geo';

export interface RegionExtraction {
  regions: Region[];
  /** Per-cell index into `regions` (-1 = no region). */
  labels: Int32Array;
}

/**
 * Extract connected regions from a DominanceResult via BFS flood-fill.
 * Each region is a connected component of cells with the same winnerBeerId.
 */
export function extractRegions(data: DominanceResult): Region[] {
  return extractRegionsWithLabels(data).regions;
}

export function extractRegionsWithLabels(data: DominanceResult): RegionExtraction {
  const { rows, cols, cells, gridSpec: gs } = data;
  const { dLat: cellDLat, dLon: cellDLon } = specStepDeg(gs);
  // Absolute lattice offset, so region ids stay stable while panning
  const rowOffset = Math.round((gs.minLat - GRID_ORIGIN.lat) / cellDLat);
  const colOffset = Math.round((gs.minLon - GRID_ORIGIN.lon) / cellDLon);
  const labels = new Int32Array(rows * cols).fill(-1);
  const regionCells: number[][] = [];

  // Build flat grid
  const grid: (string | null)[] = new Array(rows * cols).fill(null);
  const cellMap = new Map<number, (typeof cells)[0]>();
  for (const cell of cells) {
    const idx = cell.row * cols + cell.col;
    grid[idx] = cell.winnerBeerId;
    cellMap.set(idx, cell);
  }

  const visited = new Uint8Array(rows * cols);
  const regions: Region[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (visited[idx]) continue;
      const beerId = grid[idx];
      if (beerId === null) { visited[idx] = 1; continue; }

      // BFS flood-fill
      let sumRow = 0, sumCol = 0, count = 0;
      let minRow = r, maxRow = r, minCol = c, maxCol = c;
      let marginSum = 0, votesSum = 0;
      const runnerUpCounts = new Map<string, number>();
      const queue: number[] = [idx];
      const members: number[] = [];
      visited[idx] = 1;

      while (queue.length > 0) {
        const ci = queue.pop()!;
        members.push(ci);
        const cr = (ci / cols) | 0;
        const cc = ci % cols;
        sumRow += cr;
        sumCol += cc;
        count++;
        if (cr < minRow) minRow = cr;
        if (cr > maxRow) maxRow = cr;
        if (cc < minCol) minCol = cc;
        if (cc > maxCol) maxCol = cc;

        const cellData = cellMap.get(ci);
        if (cellData) {
          marginSum += cellData.margin;
          votesSum += cellData.totalCount;
          if (cellData.runnerUpBeerId) {
            runnerUpCounts.set(
              cellData.runnerUpBeerId,
              (runnerUpCounts.get(cellData.runnerUpBeerId) ?? 0) + 1
            );
          }
        }

        // 4-connected neighbors
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

      // Find most common runner-up
      let topRunnerUp: string | null = null;
      let topRunnerUpCount = 0;
      for (const [bid, cnt] of runnerUpCounts) {
        if (cnt > topRunnerUpCount) {
          topRunnerUp = bid;
          topRunnerUpCount = cnt;
        }
      }

      // Label anchor: the member cell closest to the centroid, so the
      // anchor always lies inside the (possibly non-convex) region.
      const avgRow = sumRow / count;
      const avgCol = sumCol / count;
      let anchor = members[0];
      let bestD = Infinity;
      for (const ci of members) {
        const d = ((ci / cols) | 0) - avgRow;
        const e = (ci % cols) - avgCol;
        if (d * d + e * e < bestD) {
          bestD = d * d + e * e;
          anchor = ci;
        }
      }
      const lat = gs.minLat + (((anchor / cols) | 0) + 0.5) * cellDLat;
      const lon = gs.minLon + ((anchor % cols) + 0.5) * cellDLon;

      regionCells.push(members);
      regions.push({
        id: `${beerId}@${minRow + rowOffset},${minCol + colOffset}`,
        beerId,
        cellCount: count,
        centroidLat: lat,
        centroidLon: lon,
        boundingBox: { minRow, maxRow, minCol, maxCol },
        avgMargin: count > 0 ? marginSum / count : 1,
        totalVotes: votesSum,
        runnerUpBeerId: topRunnerUp,
      });
    }
  }

  // Sort by cell count descending, keeping labels consistent
  const order = regions.map((_, i) => i).sort((a, b) => regions[b].cellCount - regions[a].cellCount);
  const sorted = order.map((i) => regions[i]);
  order.forEach((oldIdx, newIdx) => {
    for (const ci of regionCells[oldIdx]) labels[ci] = newIdx;
  });
  return { regions: sorted, labels };
}

/**
 * Find which region a cell belongs to.
 */
export function findRegionForCell(
  row: number, col: number, extraction: RegionExtraction, data: DominanceResult,
): Region | null {
  if (row < 0 || row >= data.rows || col < 0 || col >= data.cols) return null;
  const label = extraction.labels[row * data.cols + col];
  return label >= 0 ? extraction.regions[label] ?? null : null;
}
