import { useMemo } from 'react';
import type { DominanceResult, Region, Vote, ViewportBounds, FeedItem } from '../domain/types';
import { computeFeedItems } from '../domain/feedEngine';

export function useFeed(
  dominanceData: DominanceResult | null,
  regions: Region[],
  votes: Vote[],
  viewportBounds: ViewportBounds | null
): FeedItem[] {
  return useMemo(
    () => computeFeedItems(dominanceData, regions, votes, viewportBounds),
    [dominanceData, regions, votes, viewportBounds]
  );
}
