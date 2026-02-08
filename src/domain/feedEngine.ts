import type { DominanceResult, Region, Vote, ViewportBounds, FeedItem } from './types';
import { BEER_MAP } from './beers';

/**
 * Compute feed items from current state.
 * Returns at most 8 items sorted by priority.
 */
export function computeFeedItems(
  dominanceData: DominanceResult | null,
  regions: Region[],
  votes: Vote[],
  viewport: ViewportBounds | null
): FeedItem[] {
  if (!dominanceData || regions.length === 0) return [];

  const items: FeedItem[] = [];

  // ── Battlefront: top 3 lowest-margin regions in viewport ──
  const viewportRegions = viewport
    ? regions.filter((r) =>
        r.centroidLat >= viewport.south &&
        r.centroidLat <= viewport.north &&
        r.centroidLon >= viewport.west &&
        r.centroidLon <= viewport.east
      )
    : regions;

  const contested = viewportRegions
    .filter((r) => r.runnerUpBeerId && r.avgMargin < 0.5)
    .sort((a, b) => a.avgMargin - b.avgMargin)
    .slice(0, 3);

  for (const region of contested) {
    const beer = BEER_MAP.get(region.beerId);
    const runner = region.runnerUpBeerId ? BEER_MAP.get(region.runnerUpBeerId) : null;
    if (!beer) continue;
    const marginPct = Math.round(region.avgMargin * 100);

    items.push({
      id: `battle-${region.id}`,
      type: 'battlefront',
      title: `${beer.name} vs ${runner?.name ?? '?'}`,
      subtitle: `Nur ${marginPct}% Vorsprung`,
      beerId: region.beerId,
      secondaryBeerId: region.runnerUpBeerId,
      lat: region.centroidLat,
      lon: region.centroidLon,
      zoom: 12,
      priority: 100 - marginPct,
      icon: '\u2694\uFE0F',
    });
  }

  // ── Flip Watch: regions where recent votes differ from overall winner ──
  const now = Date.now();
  const recentCutoff = now - 24 * 60 * 60 * 1000; // 24h
  const recentVotes = votes.filter((v) => v.timestamp > recentCutoff);

  if (recentVotes.length > 0) {
    // Count recent votes per region (rough: find which region centroid is closest)
    const recentByBeer = new Map<string, number>();
    for (const v of recentVotes) {
      recentByBeer.set(v.beerId, (recentByBeer.get(v.beerId) ?? 0) + 1);
    }

    // Check regions where runner-up has been getting recent votes
    for (const region of viewportRegions.slice(0, 20)) {
      if (!region.runnerUpBeerId) continue;
      const runnerRecent = recentByBeer.get(region.runnerUpBeerId) ?? 0;
      const winnerRecent = recentByBeer.get(region.beerId) ?? 0;
      if (runnerRecent > winnerRecent && runnerRecent >= 2) {
        const runner = BEER_MAP.get(region.runnerUpBeerId);
        if (!runner) continue;
        items.push({
          id: `flip-${region.id}`,
          type: 'flip-watch',
          title: `${runner.name} holt auf!`,
          subtitle: `${runnerRecent} neue Votes vs ${winnerRecent}`,
          beerId: region.runnerUpBeerId,
          secondaryBeerId: region.beerId,
          lat: region.centroidLat,
          lon: region.centroidLon,
          zoom: 12,
          priority: 80 + runnerRecent,
          icon: '\uD83D\uDD04',
        });
        if (items.filter((i) => i.type === 'flip-watch').length >= 2) break;
      }
    }
  }

  // ── Trending: top beers by vote count (last 7 days) ──
  const trendCutoff = now - 7 * 24 * 60 * 60 * 1000;
  const trendVotes = votes.filter((v) => v.timestamp > trendCutoff);
  const trendCounts = new Map<string, number>();
  for (const v of trendVotes) {
    trendCounts.set(v.beerId, (trendCounts.get(v.beerId) ?? 0) + 1);
  }
  const topTrending = [...trendCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  for (const [beerId, count] of topTrending) {
    const beer = BEER_MAP.get(beerId);
    if (!beer) continue;
    // Find the largest region for this beer to navigate to
    const beerRegion = regions.find((r) => r.beerId === beerId);
    items.push({
      id: `trend-${beerId}`,
      type: 'trending',
      title: `${beer.name} im Trend`,
      subtitle: `${count} Votes (7 Tage)`,
      beerId,
      secondaryBeerId: null,
      lat: beerRegion?.centroidLat ?? 48.14,
      lon: beerRegion?.centroidLon ?? 11.58,
      zoom: 11,
      priority: 50 + count,
      icon: '\uD83D\uDD25',
    });
  }

  // Sort by priority descending, cap at 8
  items.sort((a, b) => b.priority - a.priority);
  return items.slice(0, 8);
}
