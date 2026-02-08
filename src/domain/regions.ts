import type { DominanceResult, Region } from './types';
import { metersToDegLat, metersToDegLon } from './geo';

/**
 * Extract connected regions from a DominanceResult via BFS flood-fill.
 * Each region is a connected component of cells with the same winnerBeerId.
 */
export function extractRegions(data: DominanceResult): Region[] {
  const { rows, cols, cells, gridSpec: gs } = data;
  const cellDLat = metersToDegLat(gs.cellSizeMeters);

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
      visited[idx] = 1;

      while (queue.length > 0) {
        const ci = queue.pop()!;
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

      const avgRow = sumRow / count;
      const avgCol = sumCol / count;
      const lat = gs.minLat + (avgRow + 0.5) * cellDLat;
      const dLon = metersToDegLon(gs.cellSizeMeters, lat);
      const lon = gs.minLon + (avgCol + 0.5) * dLon;

      regions.push({
        id: `${beerId}@${minRow},${minCol}`,
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

  // Sort by cell count descending
  regions.sort((a, b) => b.cellCount - a.cellCount);
  return regions;
}

/**
 * Find which region a cell belongs to.
 */
export function findRegionForCell(
  row: number, col: number, regions: Region[], data: DominanceResult
): Region | null {
  const idx = row * data.cols + col;
  const cell = data.cells[idx];
  if (!cell || !cell.winnerBeerId) return null;

  return regions.find(r =>
    r.beerId === cell.winnerBeerId &&
    row >= r.boundingBox.minRow && row <= r.boundingBox.maxRow &&
    col >= r.boundingBox.minCol && col <= r.boundingBox.maxCol
  ) ?? null;
}
