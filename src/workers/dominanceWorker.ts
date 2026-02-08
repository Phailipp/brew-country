import type { WorkerInput, WorkerOutput } from '../domain/types';
import { precomputeGrid } from '../domain/geo';
import { computeDominance, smoothWinnerGrid, mergeSmallIslands } from '../domain/dominance';

self.onmessage = (e: MessageEvent<WorkerInput>) => {
  const { votes, weightedVotes, gridSpec, radiusKm, smoothingIterations, mergeIslandSize } = e.data;

  const { rows, cols, cells } = precomputeGrid(gridSpec);
  const cellResults = computeDominance(cells, votes, radiusKm, weightedVotes);

  // Post-process: smooth jagged borders and merge small islands
  smoothWinnerGrid(cellResults, rows, cols, smoothingIterations ?? 2);
  mergeSmallIslands(cellResults, rows, cols, mergeIslandSize ?? 8);

  const output: WorkerOutput = {
    type: 'result',
    data: {
      rows,
      cols,
      cells: cellResults,
      gridSpec,
    },
  };

  self.postMessage(output);
};
