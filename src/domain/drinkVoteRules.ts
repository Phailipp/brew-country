import type { DrinkVote } from './types';
import { getNow } from './clock';
import { GAME } from '../config/constants';

const HOUR_MS = 60 * 60 * 1000;
const MIN_MS = 60 * 1000;

export interface ValidationResult {
  ok: boolean;
  error?: string;
  errorCode?: 'cooldown' | 'same_place_beer' | 'daily_cap' | 'gps_accuracy';
}

/**
 * Validate whether a new Drink Vote can be created.
 * Checks 4 rate limits:
 * 1. Cooldown: minimum 15 min between any two drink votes
 * 2. Same Place+Beer: same placeKey + beerId blocked for 6h
 * 3. Daily Cap: max 12 drink votes per 24h rolling window
 * 4. GPS Accuracy: must be ≤ 75m
 */
export function validateDrinkVote(
  existingVotes: DrinkVote[],
  placeKey: string,
  beerId: string,
  gpsAccuracyM: number
): ValidationResult {
  const now = getNow();

  // 1. GPS accuracy check
  if (gpsAccuracyM > GAME.DRINK_GPS_MAX_ACCURACY_M) {
    return {
      ok: false,
      error: `GPS zu ungenau (${Math.round(gpsAccuracyM)}m). Maximal ${GAME.DRINK_GPS_MAX_ACCURACY_M}m erlaubt.`,
      errorCode: 'gps_accuracy',
    };
  }

  // Filter to non-expired votes only
  const active = existingVotes.filter(v => v.expiresAt > now);

  // 2. Cooldown: 15 min since last vote
  const cooldownThreshold = now - GAME.DRINK_COOLDOWN_MIN * MIN_MS;
  const tooRecent = active.find(v => v.createdAt > cooldownThreshold);
  if (tooRecent) {
    const waitMin = Math.ceil((tooRecent.createdAt + GAME.DRINK_COOLDOWN_MIN * MIN_MS - now) / MIN_MS);
    return {
      ok: false,
      error: `Cooldown: Warte noch ${waitMin} Min.`,
      errorCode: 'cooldown',
    };
  }

  // 3. Same place + beer: blocked for 6h
  const samePlaceBeerThreshold = now - GAME.DRINK_SAME_PLACE_BEER_WINDOW_H * HOUR_MS;
  const duplicate = active.find(
    v => v.placeKey === placeKey && v.beerId === beerId && v.createdAt > samePlaceBeerThreshold
  );
  if (duplicate) {
    const waitH = Math.ceil((duplicate.createdAt + GAME.DRINK_SAME_PLACE_BEER_WINDOW_H * HOUR_MS - now) / HOUR_MS);
    return {
      ok: false,
      error: `Gleiches Bier am gleichen Ort: Warte noch ${waitH}h.`,
      errorCode: 'same_place_beer',
    };
  }

  // 4. Daily cap: max 12 in rolling 24h
  const dailyCount = getDailyDrinkCount(existingVotes);
  if (dailyCount >= GAME.DRINK_DAILY_CAP) {
    return {
      ok: false,
      error: `Tageslimit erreicht (${GAME.DRINK_DAILY_CAP}/${GAME.DRINK_DAILY_CAP}).`,
      errorCode: 'daily_cap',
    };
  }

  return { ok: true };
}

/**
 * Count drink votes created in the last 24 hours (rolling window).
 */
export function getDailyDrinkCount(votes: DrinkVote[]): number {
  const now = getNow();
  const dayAgo = now - 24 * HOUR_MS;
  return votes.filter(v => v.createdAt > dayAgo).length;
}
