import { describe, expect, it } from 'vitest';
import { computeStanding, dedupeVisits, INFLUENCE, playerPassport, regularTier, weeklyStreak, weekIndex } from '../domain/influence';
import { breweryReport } from '../domain/breweryInsights';
import { weeklyChallenges, weekStart } from '../domain/weeklyChallenges';
import { parseOverpass, overpassQuery, tilesForViewport, venueTileKey, tileBounds, visitBlocker, nextVisitSlot, type MyVisit, type Venue, type VenueCheckin } from '../domain/venues';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 8, 30, 18);

const venue = (over: Partial<Venue> = {}): Venue => ({
  id: 'n1', name: 'Zum Augustiner', lat: 48.14, lon: 11.57, kind: 'pub', beerIds: ['augustiner'], tile: '0_0', ...over,
});
let seq = 0;
const visit = (player: string, beerId: string, daysAgo = 0, over: Partial<VenueCheckin> = {}): VenueCheckin => ({
  id: `c${seq++}`, player, venueId: 'n1', tile: '0_0', beerId, alcoholFree: false, createdAt: NOW - daysAgo * DAY, ...over,
});

describe('venue standing', () => {
  it('gives the OSM tap a head start before anyone plays', () => {
    const s = computeStanding(venue(), [], NOW);
    expect(s.ownerBeerId).toBe('augustiner');
    expect(s.scores[0]).toEqual({ beerId: 'augustiner', points: INFLUENCE.TAP_BASE });
  });

  it('leaves venues without a known tap unclaimed', () => {
    expect(computeStanding(venue({ beerIds: [] }), [], NOW).ownerBeerId).toBeNull();
  });

  it('lets the first visitor claim an untapped venue', () => {
    const s = computeStanding(venue({ beerIds: [] }), [visit('a', 'guinness')], NOW);
    expect(s.ownerBeerId).toBe('guinness');
  });

  it('caps a single player so one person cannot flip a pub alone', () => {
    const solo = Array.from({ length: 10 }, (_, i) => visit('a', 'paulaner', i));
    const s = computeStanding(venue(), solo, NOW);
    expect(s.ownerBeerId).toBe('augustiner');
    expect(s.scores.find((x) => x.beerId === 'paulaner')!.points).toBeLessThanOrEqual(INFLUENCE.PER_PLAYER_CAP);
  });

  it('flips a venue when a crew beats the ruler by 20 %', () => {
    const crew = ['a', 'b'].flatMap((u) => [visit(u, 'paulaner', 0), visit(u, 'paulaner', 1), visit(u, 'paulaner', 2)]);
    const s = computeStanding(venue(), crew, NOW);
    expect(s.ownerBeerId).toBe('paulaner');
  });

  it('keeps the ruler inside the hysteresis band', () => {
    // 2 players × 2 visits ≈ 11.7 points < 10 × 1.2
    const crew = ['a', 'b'].flatMap((u) => [visit(u, 'paulaner', 0), visit(u, 'paulaner', 1)]);
    const s = computeStanding(venue(), crew, NOW);
    expect(s.ownerBeerId).toBe('augustiner');
    expect(s.challengerBeerId).toBe('paulaner');
    expect(s.toFlip).toBeGreaterThan(0);
  });

  it('fades old visits and ignores those outside the window', () => {
    const fresh = computeStanding(venue({ beerIds: [] }), [visit('a', 'tiger', 0)], NOW).scores[0].points;
    const old = computeStanding(venue({ beerIds: [] }), [visit('a', 'tiger', 7)], NOW).scores[0].points;
    expect(old).toBeLessThan(fresh);
    expect(computeStanding(venue({ beerIds: [] }), [visit('a', 'tiger', 40)], NOW).scores).toEqual([]);
  });

  it('counts one visit per player and day', () => {
    const twice = [visit('a', 'tiger', 0), visit('a', 'tiger', 0, { createdAt: NOW - 1000 })];
    expect(dedupeVisits(twice)).toHaveLength(1);
    expect(computeStanding(venue({ beerIds: [] }), twice, NOW).visits).toBe(1);
  });

  it('counts alcohol-free visits exactly like any other', () => {
    const a = computeStanding(venue({ beerIds: [] }), [visit('a', 'erdinger', 0, { alcoholFree: true })], NOW);
    const b = computeStanding(venue({ beerIds: [] }), [visit('a', 'erdinger', 0)], NOW);
    expect(a.scores).toEqual(b.scores);
  });

  it('gives breweries a stronger home advantage', () => {
    expect(computeStanding(venue({ kind: 'brewery' }), [], NOW).scores[0].points).toBe(INFLUENCE.BREWERY_BASE);
  });
});

describe('player progress', () => {
  it('names regular tiers', () => {
    expect(regularTier(0)).toEqual({ tier: null, next: { min: 1, tier: 'guest' } });
    expect(regularTier(3).tier).toBe('regular');
    expect(regularTier(7)).toEqual({ tier: 'table', next: { min: 15, tier: 'fixture' } });
    expect(regularTier(20)).toEqual({ tier: 'fixture', next: null });
  });

  it('counts weekly streaks and forgives a not-yet-played current week', () => {
    const lastWeek = NOW - 7 * DAY;
    expect(weeklyStreak([lastWeek, lastWeek - 7 * DAY, lastWeek - 14 * DAY], NOW)).toBe(3);
    expect(weeklyStreak([NOW, lastWeek - 14 * DAY], NOW)).toBe(1);
    expect(weeklyStreak([], NOW)).toBe(0);
    expect(weekIndex(Date.UTC(2026, 8, 28))).toBe(weekIndex(Date.UTC(2026, 9, 4, 23)));
  });

  it('collects one coaster per venue', () => {
    const mine = (beerId: string, daysAgo: number, over: Partial<MyVisit> = {}): MyVisit => ({
      id: `m${seq++}`, venueId: 'n1', venueName: 'Zum Augustiner', tile: '0_0', beerId, alcoholFree: false, createdAt: NOW - daysAgo * DAY, ...over,
    });
    const p = playerPassport([
      mine('augustiner', 0),
      mine('augustiner', 1),
      mine('erdinger', 2, { venueId: 'n2', alcoholFree: true }),
    ], NOW);
    expect(p.coasters).toHaveLength(2);
    expect(p.coasters.find((c) => c.venueId === 'n1')!.days).toBe(2);
    expect(p.beers).toBe(2);
    expect(p.alcoholFreeVisits).toBe(1);
  });
});

describe('OSM venues', () => {
  it('parses nodes and ways, matches the tap and skips unnamed or disused places', () => {
    const venues = parseOverpass({ elements: [
      { type: 'node', id: 1, lat: 48.1, lon: 11.5, tags: { amenity: 'pub', name: 'Wirtshaus', brewery: 'Augustiner;Paulaner' } },
      { type: 'way', id: 2, center: { lat: 35.6, lon: 139.7 }, tags: { amenity: 'bar', name: 'Tokyo Taps' } },
      { type: 'node', id: 3, lat: 1, lon: 1, tags: { amenity: 'pub' } },
      { type: 'node', id: 4, lat: 1, lon: 1, tags: { amenity: 'pub', name: 'Zu', disused: 'yes' } },
      { type: 'node', id: 5, lat: 50.07, lon: 14.43, tags: { craft: 'brewery', name: 'Pivovar Staropramen' } },
      { type: 'node', id: 6, lat: 48.2, lon: 11.6, tags: { amenity: 'biergarten', name: 'Seehaus' } },
      { type: 'node', id: 7, lat: 48.2, lon: 11.6, tags: { amenity: 'cafe', name: 'Café Kosmos' } },
      { type: 'node', id: 8, lat: 48.2, lon: 11.6, tags: { amenity: 'restaurant', name: 'Pizzeria' } },
      { type: 'node', id: 9, lat: 48.2, lon: 11.6, tags: { amenity: 'restaurant', name: 'Wirtshaus Ayingers', brewery: 'Ayinger' } },
    ] });
    expect(venues.map((v) => v.id)).toEqual(['n1', 'w2', 'n5', 'n6', 'n9']);
    expect(venues[4]).toMatchObject({ kind: 'restaurant', beerIds: ['ayinger'] });
    expect(venues[0].beerIds).toEqual(['augustiner', 'paulaner']);
    expect(venues[1]).toMatchObject({ kind: 'bar', beerIds: [], lat: 35.6 });
    expect(venues[2]).toMatchObject({ kind: 'brewery', beerIds: ['staropramen'] });
    expect(venues[3].kind).toBe('biergarten');
  });

  it('builds a bbox query', () => {
    const q = overpassQuery({ south: 48, west: 11, north: 48.05, east: 11.05 });
    expect(q).toContain('48.00000,11.00000,48.05000,11.05000');
    expect(q).toContain('out center tags');
  });

  it('tiles viewports and refuses huge ones', () => {
    const t = venueTileKey(48.137, 11.575);
    const b = tileBounds(t);
    expect(48.137).toBeGreaterThanOrEqual(b.south);
    expect(48.137).toBeLessThan(b.north);
    expect(tilesForViewport({ south: 48.1, north: 48.17, west: 11.5, east: 11.65 }).length).toBeGreaterThan(0);
    expect(tilesForViewport({ south: 40, north: 55, west: 0, east: 20 })).toEqual([]);
    expect(tilesForViewport({ south: -33.9, north: -33.85, west: 151.18, east: 151.23 }).length).toBeGreaterThan(0);
  });
});

describe('visit limits', () => {
  const mine = (venueId: string, hoursAgo: number): MyVisit => ({
    id: venueId + hoursAgo, venueId, venueName: venueId, tile: '0_0', beerId: 'augustiner', alcoholFree: false, createdAt: NOW - hoursAgo * 3_600_000,
  });
  it('allows one visit per venue and day and two per day', () => {
    expect(visitBlocker([], 'n1', NOW)).toBeNull();
    expect(visitBlocker([mine('n1', 1)], 'n1', NOW)).toBe('already-today');
    expect(visitBlocker([mine('n1', 1), mine('n2', 2)], 'n3', NOW)).toBe('daily-limit');
    expect(visitBlocker([mine('n1', 1), mine('n2', 2)], 'n1', NOW)).toBe('already-today');
    expect(visitBlocker([mine('n1', 30)], 'n1', NOW)).toBeNull();
  });
  it('picks the next free slot', () => {
    expect(nextVisitSlot([], NOW)).toBe(0);
    expect(nextVisitSlot([mine('n1', 1)], NOW)).toBe(1);
    expect(nextVisitSlot([], NOW, (s) => s === 0)).toBe(1);
    expect(nextVisitSlot([mine('n1', 1), mine('n2', 2)], NOW)).toBe(-1);
  });
});

describe('brewery report', () => {
  const v = (id: string, beerIds: string[]): Venue => ({ id, name: id, lat: 48.1, lon: 11.5, kind: 'pub', beerIds, tile: '0_0' });
  it('finds pubs at risk, opportunities and sleeping taps', () => {
    const venues = [v('n1', ['augustiner']), v('n2', ['augustiner']), v('n3', ['paulaner']), v('n4', [])];
    const checkins: VenueCheckin[] = [
      // n1: Paulaner crew closing in on Augustiner
      visit('a', 'paulaner', 0, { venueId: 'n1' }), visit('b', 'paulaner', 0, { venueId: 'n1' }), visit('c', 'paulaner', 0, { venueId: 'n1' }),
      // n3: Augustiner fans pushing into a Paulaner pub
      visit('d', 'augustiner', 0, { venueId: 'n3' }), visit('e', 'augustiner', 0, { venueId: 'n3' }), visit('f', 'augustiner', 1, { venueId: 'n3' }),
    ];
    const standings = new Map(venues.map((x) => [x.id, computeStanding(x, checkins.filter((c) => c.venueId === x.id), NOW)]));
    const r = breweryReport('augustiner', venues, standings);
    expect(r.ruled).toBe(2);
    expect(r.tapped).toBe(2);
    expect(r.shareOfVoice).toBeCloseTo(2 / 3);
    expect(r.atRisk.map((x) => x.venue.id)).toEqual(['n1']);
    expect(r.opportunities.map((x) => x.venue.id)).toEqual(['n3']);
    expect(r.sleeping.map((x) => x.venue.id)).toEqual(['n2']);
    expect(r.rivals[0]).toEqual({ beerId: 'augustiner', venues: 2 });
    expect(r.visitPoints).toBeGreaterThan(0);
  });
});

describe('weekly challenges', () => {
  const mine = (venueId: string, beerId: string, at: number, af = false): MyVisit => ({
    id: `${venueId}${at}`, venueId, venueName: venueId, tile: '0_0', beerId, alcoholFree: af, createdAt: at,
  });
  it('counts only this week and resets on Monday', () => {
    const monday = weekStart(NOW);
    expect(new Date(monday).getUTCDay()).toBe(1);
    const visits = [
      mine('n1', 'augustiner', monday - DAY), // last week
      mine('n1', 'augustiner', monday + 3600_000),
      mine('n2', 'paulaner', monday + DAY),
      mine('n3', 'erdinger', monday + DAY + 3600_000, true),
    ];
    const byId = Object.fromEntries(weeklyChallenges(visits, NOW).map((c) => [c.id, c]));
    expect(byId.tour).toMatchObject({ progress: 3, done: true });
    expect(byId.new).toMatchObject({ progress: 1, done: true }); // n2 and n3 are new
    expect(byId.taste.progress).toBe(3);
    expect(byId.regular.progress).toBe(2);
    expect(byId.af.done).toBe(true);
  });
});
