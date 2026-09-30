import type { MyVisit } from './venues';
import { dedupeVisits, weekIndex } from './influence';

export interface WeeklyChallenge {
  id: string;
  icon: string;
  title: string;
  description: string;
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

  const make = (id: string, icon: string, title: string, description: string, target: number, progress: number): WeeklyChallenge =>
    ({ id, icon, title, description, target, progress: Math.min(progress, target), done: progress >= target });

  return [
    make('tour', '🍻', 'Kneipentour', 'Check in 3 verschiedenen Kneipen ein.', 3, venues),
    make('new', '🧭', 'Neuland', 'Besuch eine Kneipe, in der du noch nie warst.', 1, fresh),
    make('taste', '🌍', 'Querbeet', 'Trink 3 verschiedene Biere.', 3, beers),
    make('regular', '📅', 'Treue Seele', 'Sei an 3 verschiedenen Tagen unterwegs.', 3, days),
    make('af', '💧', 'Klarer Kopf', 'Ein alkoholfreier Check-in zählt genauso.', 1, af),
  ];
}
