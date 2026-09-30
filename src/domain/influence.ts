import type { MyVisit, Venue, VenueCheckin } from './venues';

/**
 * Who rules a venue?
 *
 * - The beer a venue pours according to OSM starts with a head start
 *   (the "Ausschank"). That fills the map before the first player arrives.
 * - Every visit adds points for the beer the player drank. Points fade
 *   by 10 % a day, so a venue has to be defended.
 * - One player alone cannot flip a venue: their share per beer is capped.
 *   Taking over a pub is a crew effort.
 * - A challenger needs 20 % more than the ruler (hysteresis), so venues
 *   do not flicker between two beers.
 */
export const INFLUENCE = {
  /** Head start of a beer poured here according to OSM */
  TAP_BASE: 10,
  /** Head start at a brewery's own tap */
  BREWERY_BASE: 15,
  /** Points per visit */
  VISIT: 3,
  /** Daily decay factor of visit points */
  DECAY_PER_DAY: 0.9,
  /** Visits older than this are ignored (0.9^30 ≈ 4 %) */
  WINDOW_DAYS: 30,
  /** Max points a single player can add to one beer at one venue */
  PER_PLAYER_CAP: 9,
  /** A challenger must beat the ruler by this factor */
  HYSTERESIS: 1.2,
} as const;

const DAY_MS = 86_400_000;

export interface VenueStanding {
  venueId: string;
  /** Ruling beer, or null for an unclaimed venue */
  ownerBeerId: string | null;
  /** Points per beer, highest first */
  scores: { beerId: string; points: number }[];
  /** Points the strongest challenger still needs to take over (0 = no ruler) */
  toFlip: number;
  /** Strongest challenger */
  challengerBeerId: string | null;
  /** Visits counted (after one-per-player-per-day dedupe) */
  visits: number;
  /** Distinct players who visited in the window */
  regulars: number;
}

/** Keep at most one visit per player and UTC day; the earliest counts. */
export function dedupeVisits(checkins: VenueCheckin[]): VenueCheckin[] {
  const seen = new Set<string>();
  return [...checkins]
    .sort((a, b) => a.createdAt - b.createdAt)
    .filter((c) => {
      const key = `${c.player}|${c.venueId}|${Math.floor(c.createdAt / DAY_MS)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function computeStanding(venue: Venue, checkins: VenueCheckin[], now: number): VenueStanding {
  const base = venue.kind === 'brewery' ? INFLUENCE.BREWERY_BASE : INFLUENCE.TAP_BASE;
  const tapped = new Set(venue.beerIds);
  const points = new Map<string, number>();
  for (const id of venue.beerIds) points.set(id, base);

  const windowStart = now - INFLUENCE.WINDOW_DAYS * DAY_MS;
  const visits = dedupeVisits(checkins.filter((c) => c.venueId === venue.id && c.createdAt >= windowStart && c.createdAt <= now + 60_000));

  // Per player and beer: decayed visit points, capped
  const perPlayer = new Map<string, number>();
  for (const v of visits) {
    const ageDays = Math.max(0, (now - v.createdAt) / DAY_MS);
    const key = `${v.player}|${v.beerId}`;
    perPlayer.set(key, (perPlayer.get(key) ?? 0) + INFLUENCE.VISIT * INFLUENCE.DECAY_PER_DAY ** ageDays);
  }
  for (const [key, p] of perPlayer) {
    const beerId = key.slice(key.indexOf('|') + 1);
    points.set(beerId, (points.get(beerId) ?? 0) + Math.min(INFLUENCE.PER_PLAYER_CAP, p));
  }

  const scores = [...points.entries()]
    .map(([beerId, pts]) => ({ beerId, points: Math.round(pts * 10) / 10 }))
    .sort((a, b) => b.points - a.points || Number(tapped.has(b.beerId)) - Number(tapped.has(a.beerId)));

  // The incumbent is the tapped beer with the most points, else the leader
  const incumbent = scores.find((s) => tapped.has(s.beerId)) ?? scores[0] ?? null;
  let owner: { beerId: string; points: number } | null = incumbent;
  const top = scores[0] ?? null;
  if (incumbent && top && top.beerId !== incumbent.beerId && top.points > incumbent.points * INFLUENCE.HYSTERESIS) {
    owner = top;
  }
  if (owner && !tapped.has(owner.beerId)) {
    // Untapped venues need a clear leader too
    const second = scores.find((s) => s.beerId !== owner!.beerId);
    if (second && owner.points <= second.points) owner = null;
  }

  const challenger = scores.find((s) => s.beerId !== owner?.beerId) ?? null;
  const toFlip = owner && challenger
    ? Math.max(0, Math.round((owner.points * INFLUENCE.HYSTERESIS - challenger.points + 0.1) * 10) / 10)
    : 0;

  return {
    venueId: venue.id,
    ownerBeerId: owner?.beerId ?? null,
    scores,
    toFlip,
    challengerBeerId: challenger?.beerId ?? null,
    visits: visits.length,
    regulars: new Set(visits.map((v) => v.player)).size,
  };
}

// ── Player progress ─────────────────────────────────────────────────
export const REGULAR_TIERS = [
  { min: 1, name: 'Gast' },
  { min: 3, name: 'Stammgast' },
  { min: 7, name: 'Stammtisch' },
  { min: 15, name: 'Inventar' },
] as const;

/** Distinct visit days of a player at one venue → tier name + next goal. */
export function regularTier(days: number): { name: string | null; next: { min: number; name: string } | null } {
  let name: string | null = null;
  let next: { min: number; name: string } | null = REGULAR_TIERS[0];
  for (let i = 0; i < REGULAR_TIERS.length; i++) {
    if (days >= REGULAR_TIERS[i].min) {
      name = REGULAR_TIERS[i].name;
      next = REGULAR_TIERS[i + 1] ?? null;
    }
  }
  return { name, next };
}

/** ISO-like week index (Monday start, UTC) — used for weekly streaks. */
export function weekIndex(ms: number): number {
  // 1970-01-01 was a Thursday; shift so weeks start on Monday
  return Math.floor((ms / DAY_MS + 3) / 7);
}

/** Consecutive weeks (ending this or last week) with at least one visit. */
export function weeklyStreak(visitTimes: number[], now: number): number {
  const weeks = new Set(visitTimes.map(weekIndex));
  let w = weekIndex(now);
  if (!weeks.has(w)) w -= 1; // this week not played yet: the streak is still alive
  let streak = 0;
  while (weeks.has(w)) { streak++; w--; }
  return streak;
}

export interface PlayerPassport {
  /** One coaster per distinct venue visited */
  coasters: { venueId: string; beerId: string; firstAt: number; days: number }[];
  /** Distinct beers drunk */
  beers: number;
  weeklyStreak: number;
  alcoholFreeVisits: number;
}

export function playerPassport(mine: MyVisit[], now: number): PlayerPassport {
  const visits = dedupeVisits(mine.map((v) => ({ ...v, player: 'me' })));
  const byVenue = new Map<string, { venueId: string; beerId: string; firstAt: number; days: number }>();
  for (const v of visits) {
    const c = byVenue.get(v.venueId);
    if (c) c.days++;
    else byVenue.set(v.venueId, { venueId: v.venueId, beerId: v.beerId, firstAt: v.createdAt, days: 1 });
  }
  return {
    coasters: [...byVenue.values()].sort((a, b) => b.firstAt - a.firstAt),
    beers: new Set(visits.map((v) => v.beerId)).size,
    weeklyStreak: weeklyStreak(visits.map((v) => v.createdAt), now),
    alcoholFreeVisits: visits.filter((v) => v.alcoholFree).length,
  };
}
