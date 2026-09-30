import type { MyVisit } from './venues';
import { dedupeVisits, weekIndex } from './influence';

export type WeeklyChallengeId = 'tour' | 'new' | 'taste' | 'regular' | 'af';

/** A challenge of the week. Title and description come from the UI by `id`. */
export interface WeeklyChallenge {
  id: WeeklyChallengeId;
  icon: string;
  target: number;
  progress: number;
  done: boolean;
}

const DAY_MS = 86_400_000;

/** Start of the current challenge week (Monday 00:00 UTC). */
export function weekStart(now: number): number {
  return (weekIndex(now) * 7 - 3) * DAY_MS;
}

/**
 * This week's challenges, derived from the private passport alone:
 * no extra storage, resets every Monday, identical on every device.
 */
export function weeklyChallenges(visits: MyVisit[], now: number): WeeklyChallenge[] {
  const all = dedupeVisits(visits.map((v) => ({ ...v, player: 'me' })));
  const start = weekStart(now);
  const week = all.filter((v) => v.createdAt >= start && v.createdAt <= now);
  const before = new Set(all.filter((v) => v.createdAt < start).map((v) => v.venueId));

  const venues = new Set(week.map((v) => v.venueId)).size;
  const beers = new Set(week.map((v) => v.beerId)).size;
  const fresh = new Set(week.filter((v) => !before.has(v.venueId)).map((v) => v.venueId)).size;
  const af = week.filter((v) => v.alcoholFree).length;
  const days = new Set(week.map((v) => Math.floor(v.createdAt / DAY_MS))).size;

  const make = (id: WeeklyChallengeId, icon: string, target: number, progress: number): WeeklyChallenge =>
    ({ id, icon, target, progress: Math.min(progress, target), done: progress >= target });

  return [
    make('tour', '🍻', 3, venues),
    make('new', '🧭', 1, fresh),
    make('taste', '🌍', 3, beers),
    make('regular', '📅', 3, days),
    make('af', '💧', 1, af),
  ];
}
