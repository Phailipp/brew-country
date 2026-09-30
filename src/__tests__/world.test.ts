import { describe, expect, it } from 'vitest';
import { getViewportGridSpec, gridDims, specStepDeg, refLatFor, cellAt } from '../domain/geo';
import { computeDominance } from '../domain/dominance';
import { matchBeerIds, searchBeers, BEERS } from '../domain/beers';
import { nearestCity } from '../domain/worldCities';
import { countryFlag } from '../domain/countries';
import { GAME } from '../config/constants';
import type { WeightedVote } from '../domain/types';

const onLattice = (v: number, step: number) => Math.abs(v / step - Math.round(v / step)) < 1e-6;

describe('worldwide grid', () => {
  it.each([
    ['Tokio', 35.68, 139.69],
    ['Sydney', -33.87, 151.21],
    ['Buenos Aires', -34.6, -58.38],
    ['Reykjavík', 64.15, -21.94],
  ])('builds a grid around %s on the global lattice', (_name, lat, lon) => {
    const spec = getViewportGridSpec({ south: lat - 0.1, north: lat + 0.1, west: lon - 0.15, east: lon + 0.15 }, 12);
    const { rows, cols } = gridDims(spec);
    expect(rows).toBeGreaterThan(0);
    expect(cols).toBeGreaterThan(0);
    expect(rows * cols).toBeLessThanOrEqual(GAME.MAX_GRID_CELLS * 1.2);
    const { dLat, dLon } = specStepDeg(spec);
    expect(onLattice(spec.minLat, dLat)).toBe(true);
    expect(onLattice(spec.minLon, dLon)).toBe(true);
    expect(cellAt(spec, rows, cols, lat, lon)).not.toBeNull();
  });

  it('keeps cells roughly square far from Europe', () => {
    const spec = getViewportGridSpec({ south: 64, north: 64.3, west: -22.2, east: -21.7 }, 12);
    const { dLat, dLon } = specStepDeg(spec);
    const widthKm = dLon * 111.32 * Math.cos((64.15 * Math.PI) / 180);
    const heightKm = dLat * 111.32;
    expect(widthKm / heightKm).toBeGreaterThan(0.8);
    expect(widthKm / heightKm).toBeLessThan(1.25);
  });

  it('only changes the lon step between 15° bands', () => {
    expect(refLatFor(48.1)).toBe(refLatFor(47.2));
    expect(refLatFor(-33.9)).toBe(30);
    expect(refLatFor(89)).toBe(75);
  });

  it('clamps wrapped globe viewports to the world', () => {
    const spec = getViewportGridSpec({ south: -120, north: 120, west: -400, east: 400 }, 1);
    expect(spec.minLat).toBeGreaterThanOrEqual(-85 - specStepDeg(spec).dLat);
    expect(spec.maxLat).toBeLessThanOrEqual(85 + specStepDeg(spec).dLat);
    expect(spec.minLon).toBeGreaterThanOrEqual(-180 - specStepDeg(spec).dLon);
    expect(spec.maxLon).toBeLessThanOrEqual(180 + specStepDeg(spec).dLon);
    const { rows, cols } = gridDims(spec);
    expect(rows * cols).toBeLessThanOrEqual(GAME.MAX_GRID_CELLS * 1.2);
  });

  it('still counts small-radius votes on a coarse world grid', () => {
    const spec = getViewportGridSpec({ south: -60, north: 70, west: -170, east: 170 }, 2);
    const { rows, cols } = gridDims(spec);
    const votes: WeightedVote[] = [
      { id: 'a', lat: 35.68, lon: 139.69, beerId: 'asahi', weight: 1, radiusKm: 0.5, source: 'drink' },
    ];
    const res = computeDominance(spec, rows, cols, [], 1, votes);
    expect(res.some((c) => c.winnerBeerId === 'asahi')).toBe(true);
  });
});

describe('global catalogue', () => {
  it('has unique ids', () => {
    expect(new Set(BEERS.map((b) => b.id)).size).toBe(BEERS.length);
  });
  it('covers every continent', () => {
    const countries = new Set(BEERS.map((b) => b.country));
    for (const c of ['DE', 'US', 'MX', 'BR', 'JP', 'AU', 'ZA']) expect(countries.has(c)).toBe(true);
  });
  it('puts local beers first', () => {
    expect(searchBeers('', 'JP')[0].country).toBe('JP');
    expect(searchBeers('', 'DE')[0].country).toBe('DE');
  });
  it('finds beers by alias', () => {
    expect(searchBeers('nastro').map((b) => b.id)).toContain('peroni');
  });
});

describe('OSM brewery matching', () => {
  it('maps multi-value tags to catalogue ids', () => {
    expect(matchBeerIds('Augustiner;Paulaner')).toEqual(['augustiner', 'paulaner']);
  });
  it('matches brewery names and spelling variants', () => {
    expect(matchBeerIds('Augustiner Bräu')).toEqual(['augustiner']);
    expect(matchBeerIds('Hofbräu München')).toEqual(['hofbraeu']);
    expect(matchBeerIds('Löwenbräu')).toEqual(['loewenbraeu']);
    expect(matchBeerIds('Pilsner Urquell')).toEqual(['pilsner-urquell']);
  });
  it('prefers exact brands over prefixes', () => {
    expect(matchBeerIds('Budweiser')).toEqual(['budweiser']);
    expect(matchBeerIds('Budvar')).toEqual(['budvar']);
    expect(matchBeerIds('Castlemaine XXXX')).toEqual(['xxxx']);
  });
  it('ignores unknown brands and empty tags', () => {
    expect(matchBeerIds('Hausbrauerei Zum Schwarzen Kater')).toEqual([]);
    expect(matchBeerIds(undefined)).toEqual([]);
  });
});

describe('world helpers', () => {
  it('finds the nearest beer city across the antimeridian', () => {
    expect(nearestCity(-36.9, 179.9).country).toBe('NZ');
    expect(nearestCity(48.2, 11.6).name).toBe('München');
  });
  it('builds flag emoji', () => {
    expect(countryFlag('DE')).toBe('🇩🇪');
    expect(countryFlag(undefined)).toBe('🌍');
  });
});
