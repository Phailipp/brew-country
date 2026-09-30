import type { WorkerInput, WorkerOutput } from '../domain/types';
import { gridDims } from '../domain/geo';
import { computeDominance, smoothWinnerGrid, mergeSmallIslands } from '../domain/dominance';
import { extractRegionsWithLabels } from '../domain/regions';
import { buildTerritoryGeometry } from '../domain/territoryGeometry';

self.onmessage = (e: MessageEvent<WorkerInput>) => {
  const {
    requestId, votes, weightedVotes, gridSpec, radiusKm,
    smoothingIterations, mergeIslandSize, closeMarginThreshold, closeMarginMinWeight,
  } = e.data;

  const { rows, cols } = gridDims(gridSpec);
  const cells = computeDominance(gridSpec, rows, cols, votes, radiusKm, weightedVotes);

  // Post-process: smooth jagged borders and merge small islands
  smoothWinnerGrid(cells, rows, cols, smoothingIterations ?? 2);
  mergeSmallIslands(cells, rows, cols, mergeIslandSize ?? 8);

  const data = { rows, cols, cells, gridSpec };
  const { regions, labels } = extractRegionsWithLabels(data);
  const geometry = buildTerritoryGeometry(
    cells, rows, cols, gridSpec, regions, closeMarginThreshold, closeMarginMinWeight,
  );

  const output: WorkerOutput = {
    type: 'result',
    requestId,
    data,
    regions,
    labels,
    geometry,
  };

  self.postMessage(output, { transfer: [labels.buffer] });
};
