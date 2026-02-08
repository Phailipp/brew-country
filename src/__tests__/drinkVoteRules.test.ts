import { describe, it, expect, afterEach } from 'vitest';
import { validateDrinkVote, getDailyDrinkCount } from '../domain/drinkVoteRules';
import { setMockTime, resetClock } from '../domain/clock';
import type { DrinkVote } from '../domain/types';

const HOUR_MS = 60 * 60 * 1000;
const MIN_MS = 60 * 1000;
const NOW = 1700000000000;

function makeDrinkVote(overrides: Partial<DrinkVote> = {}): DrinkVote {
  return {
    id: 'dv_1',
    userId: 'u1',
    beerId: 'beer1',
    lat: 48.137,
    lon: 11.575,
    placeKey: '48.1368_11.5751',
    createdAt: NOW - 2 * HOUR_MS,
    expiresAt: NOW + 22 * HOUR_MS,
    gpsAccuracyM: 20,
    proofType: 'gps',
    ...overrides,
  };
}

afterEach(() => resetClock());

describe('validateDrinkVote', () => {
  it('allows vote when no restrictions', () => {
    setMockTime(NOW);
    const result = validateDrinkVote([], '48.1368_11.5751', 'beer1', 30);
    expect(result.ok).toBe(true);
  });

  it('rejects when GPS accuracy too low', () => {
    setMockTime(NOW);
    const result = validateDrinkVote([], '48.1368_11.5751', 'beer1', 100);
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('gps_accuracy');
  });

  it('rejects when GPS accuracy exactly at limit', () => {
    setMockTime(NOW);
    // 75m is the max — should pass
    const pass = validateDrinkVote([], '48.1368_11.5751', 'beer1', 75);
    expect(pass.ok).toBe(true);

    // 76m should fail
    const fail = validateDrinkVote([], '48.1368_11.5751', 'beer1', 76);
    expect(fail.ok).toBe(false);
    expect(fail.errorCode).toBe('gps_accuracy');
  });

  it('rejects within cooldown period (15 min)', () => {
    setMockTime(NOW);
    const recent = makeDrinkVote({ createdAt: NOW - 5 * MIN_MS, expiresAt: NOW + 24 * HOUR_MS });
    const result = validateDrinkVote([recent], '99.0000_99.0000', 'beer2', 20);
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('cooldown');
  });

  it('allows after cooldown period', () => {
    setMockTime(NOW);
    const old = makeDrinkVote({ createdAt: NOW - 20 * MIN_MS, expiresAt: NOW + 24 * HOUR_MS });
    const result = validateDrinkVote([old], '99.0000_99.0000', 'beer2', 20);
    expect(result.ok).toBe(true);
  });

  it('rejects same place+beer within 6h window', () => {
    setMockTime(NOW);
    const existing = makeDrinkVote({
      placeKey: '48.1368_11.5751',
      beerId: 'beer1',
      createdAt: NOW - 3 * HOUR_MS,
      expiresAt: NOW + 21 * HOUR_MS,
    });
    const result = validateDrinkVote([existing], '48.1368_11.5751', 'beer1', 20);
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('same_place_beer');
  });

  it('allows same place different beer', () => {
    setMockTime(NOW);
    const existing = makeDrinkVote({
      placeKey: '48.1368_11.5751',
      beerId: 'beer1',
      createdAt: NOW - 20 * MIN_MS,
      expiresAt: NOW + 24 * HOUR_MS,
    });
    const result = validateDrinkVote([existing], '48.1368_11.5751', 'beer2', 20);
    expect(result.ok).toBe(true);
  });

  it('rejects when daily cap reached (12)', () => {
    setMockTime(NOW);
    const votes = Array.from({ length: 12 }, (_, i) =>
      makeDrinkVote({
        id: `dv_${i}`,
        createdAt: NOW - (i + 1) * 30 * MIN_MS,
        expiresAt: NOW + 24 * HOUR_MS,
        placeKey: `${i}.0000_${i}.0000`,
        beerId: `beer${i}`,
      })
    );
    const result = validateDrinkVote(votes, '99.0000_99.0000', 'beerX', 20);
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('daily_cap');
  });

  it('allows when daily cap not reached', () => {
    setMockTime(NOW);
    const votes = Array.from({ length: 11 }, (_, i) =>
      makeDrinkVote({
        id: `dv_${i}`,
        createdAt: NOW - (i + 1) * 30 * MIN_MS,
        expiresAt: NOW + 24 * HOUR_MS,
        placeKey: `${i}.0000_${i}.0000`,
        beerId: `beer${i}`,
      })
    );
    const result = validateDrinkVote(votes, '99.0000_99.0000', 'beerX', 20);
    expect(result.ok).toBe(true);
  });
});

describe('getDailyDrinkCount', () => {
  it('counts votes in last 24h', () => {
    setMockTime(NOW);
    const votes = [
      makeDrinkVote({ createdAt: NOW - 1 * HOUR_MS }),
      makeDrinkVote({ id: 'dv_2', createdAt: NOW - 23 * HOUR_MS }),
      makeDrinkVote({ id: 'dv_3', createdAt: NOW - 25 * HOUR_MS }), // outside 24h
    ];
    expect(getDailyDrinkCount(votes)).toBe(2);
  });

  it('returns 0 for empty array', () => {
    setMockTime(NOW);
    expect(getDailyDrinkCount([])).toBe(0);
  });
});
