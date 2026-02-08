import { describe, it, expect, afterEach } from 'vitest';
import { buildWeightedVotes } from '../domain/weights';
import { setMockTime, resetClock } from '../domain/clock';
import type { User, DrinkVote } from '../domain/types';

const NOW = 1700000000000;
const HOUR_MS = 60 * 60 * 1000;

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    phone: null,
    createdAt: NOW - 10 * 24 * HOUR_MS,
    lastActiveAt: NOW - 1 * HOUR_MS,
    homeLat: 48.137,
    homeLon: 11.575,
    beerId: 'beer1',
    standYourGroundEnabled: false,
    ageVerified: true,
    ...overrides,
  };
}

function makeDrinkVote(overrides: Partial<DrinkVote> = {}): DrinkVote {
  return {
    id: 'dv_1',
    userId: 'u1',
    beerId: 'beer2',
    lat: 48.200,
    lon: 11.600,
    placeKey: '48.2000_11.6000',
    createdAt: NOW - 2 * HOUR_MS,
    expiresAt: NOW + 22 * HOUR_MS,
    gpsAccuracyM: 20,
    proofType: 'gps',
    ...overrides,
  };
}

afterEach(() => resetClock());

describe('buildWeightedVotes with drink votes', () => {
  it('includes active drink votes with correct weight and source', () => {
    setMockTime(NOW);
    const user = makeUser();
    const dv = makeDrinkVote();

    const result = buildWeightedVotes([user], [], [], new Map(), [dv]);

    const drinkWV = result.find(v => v.source === 'drink');
    expect(drinkWV).toBeDefined();
    expect(drinkWV!.weight).toBe(0.75);
    expect(drinkWV!.radiusKm).toBe(5);
    expect(drinkWV!.beerId).toBe('beer2');
    expect(drinkWV!.lat).toBe(48.200);
  });

  it('filters out expired drink votes', () => {
    setMockTime(NOW);
    const user = makeUser();
    const expired = makeDrinkVote({ expiresAt: NOW - 1000 });

    const result = buildWeightedVotes([user], [], [], new Map(), [expired]);

    const drinkWV = result.find(v => v.source === 'drink');
    expect(drinkWV).toBeUndefined();
  });

  it('still includes home votes alongside drink votes', () => {
    setMockTime(NOW);
    const user = makeUser();
    const dv = makeDrinkVote();

    const result = buildWeightedVotes([user], [], [], new Map(), [dv]);

    const homeWV = result.find(v => v.source === 'home');
    expect(homeWV).toBeDefined();
    expect(homeWV!.beerId).toBe('beer1');
  });

  it('works with empty drink votes array', () => {
    setMockTime(NOW);
    const user = makeUser();

    const result = buildWeightedVotes([user], [], [], new Map(), []);
    expect(result.length).toBe(1); // just home vote
    expect(result[0].source).toBe('home');
  });
});
