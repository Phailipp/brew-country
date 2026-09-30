import { afterEach, describe, expect, it } from 'vitest';
import { snapToLattice, CHECKIN_STEPS, PUBLIC_HOME_STEPS } from '../domain/privacy';
import { encodeShareLink, decodeShareLink } from '../domain/shareLink';
import { visitDocId, venuePlayerId, newVisitSalt, hourFloor } from '../domain/visitIds';
import type { SharePayload } from '../domain/types';

const onLattice = (v: number, steps: number) => Math.abs(v * steps - Math.round(v * steps)) < 0.0001;

describe('privacy lattice (mirrors firestore.rules onLattice)', () => {
  it.each([48.13721, -33.86881, 0.0049, -0.0051, 179.999, -85])('snaps %s onto both lattices', (v) => {
    expect(onLattice(snapToLattice(v, CHECKIN_STEPS), CHECKIN_STEPS)).toBe(true);
    expect(onLattice(snapToLattice(v, PUBLIC_HOME_STEPS), PUBLIC_HOME_STEPS)).toBe(true);
  });
  it('is idempotent and moves at most half a step', () => {
    const v = 11.57563;
    const s = snapToLattice(v, PUBLIC_HOME_STEPS);
    expect(snapToLattice(s, PUBLIC_HOME_STEPS)).toBe(s);
    expect(Math.abs(s - v)).toBeLessThanOrEqual(0.5 / PUBLIC_HOME_STEPS + 1e-9);
  });
});

describe('visit ids', () => {
  it('are deterministic, salt-dependent and uppercase hex (like rules toHexString)', async () => {
    const salt = 'a'.repeat(64);
    const a = await visitDocId(salt, 20361, 0);
    expect(a).toMatch(/^[0-9A-F]{64}$/);
    expect(await visitDocId(salt, 20361, 0)).toBe(a);
    expect(await visitDocId('b'.repeat(64), 20361, 0)).not.toBe(a);
    expect(await venuePlayerId(salt, 'n1', 2908)).not.toBe(await venuePlayerId(salt, 'n2', 2908));
    expect(await venuePlayerId(salt, 'n1', 2908)).not.toBe(await venuePlayerId(salt, 'n1', 2909));
  });
  it('generates 64-char lowercase hex salts that differ', () => {
    const a = newVisitSalt();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(newVisitSalt()).not.toBe(a);
  });
  it('floors public times to the hour', () => {
    expect(hourFloor(Date.UTC(2026, 8, 30, 18, 59, 59))).toBe(Date.UTC(2026, 8, 30, 18));
  });
});

describe('share links', () => {
  const payload: SharePayload = {
    regionId: 'r1', beerId: 'augustiner', beerName: 'Augustiner', centroidLat: 48.13721, centroidLon: 11.57563,
    zoom: 13, cellCount: 1, totalVotes: 1, avgMargin: 0.5, runnerUpName: null,
  };
  afterEach(() => { window.history.replaceState({}, '', '/'); });

  const open = (url: string) => {
    const u = new URL(url, window.location.origin);
    window.history.replaceState({}, '', u.pathname + u.search);
  };

  it('round-trips a region', () => {
    open(encodeShareLink(payload));
    const d = decodeShareLink();
    expect(d).toMatchObject({ beerId: 'augustiner', beerName: 'Augustiner', zoom: 13 });
    expect(d!.centroidLat).toBeCloseTo(48.13721, 4);
  });
  it('ignores non-share URLs and broken coordinates', () => {
    open('/?foo=1');
    expect(decodeShareLink()).toBeNull();
    open('/?share=1&beer=augustiner&lat=abc&lon=11.5');
    expect(decodeShareLink()).toBeNull();
    open('/?share=1&beer=augustiner&lat=99&lon=11.5');
    expect(decodeShareLink()).toBeNull();
  });
  it('clamps silly zoom levels and keeps unknown beers by id', () => {
    open('/?share=1&beer=hausbraeu&lat=48.1&lon=11.5&z=99');
    expect(decodeShareLink()).toMatchObject({ beerName: 'hausbraeu', zoom: 18 });
  });
});
