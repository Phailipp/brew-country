import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page } from '@playwright/test';

interface OsmElement {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
}
const OSM = JSON.parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/overpass-munich.json'), 'utf8')) as { elements: OsmElement[] };

export const MARIENPLATZ = { lat: 48.1372, lon: 11.5756 };

/**
 * Deterministic, offline network:
 *  - the map style request fails fast → the app's built-in fallback style
 *  - Overpass answers from the Munich fixture (bbox-filtered), or with `overpass`
 *  - every other external request is aborted
 */
export async function stubNetwork(page: Page, opts: { overpass?: 'ok' | 'error' } = {}): Promise<{ overpassCalls: () => number }> {
  let calls = 0;
  await page.route(/^https?:\/\/(?!localhost)/, async (route) => {
    const url = route.request().url();
    if (/overpass|maps\.mail\.ru/.test(url)) {
      calls++;
      if (opts.overpass === 'error') return route.fulfill({ status: 504, body: 'Gateway Timeout' });
      const body = decodeURIComponent((route.request().postData() ?? '').replace(/\+/g, ' '));
      const m = /\(([-\d.]+),([-\d.]+),([-\d.]+),([-\d.]+)\)/.exec(body);
      const [s, w, n, e] = m ? m.slice(1).map(Number) : [-90, -180, 90, 180];
      const elements = OSM.elements.filter((el) => {
        const lat = el.lat ?? el.center?.lat ?? 0;
        const lon = el.lon ?? el.center?.lon ?? 0;
        return lat >= s && lat <= n && lon >= w && lon <= e;
      });
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ elements }) });
    }
    if (url.startsWith('https://tiles.openfreemap.org/styles/')) return route.fulfill({ status: 503, body: '' });
    return route.abort();
  });
  // No cinematic intro in tests
  await page.addInitScript(() => { try { sessionStorage.setItem('bc_intro_played', '1'); } catch { /* ignore */ } });
  return { overpassCalls: () => calls };
}

/** UI labels the demo onboarding clicks through, per app language. */
export const DEMO_LABELS = {
  de: {
    demo: /Demo ansehen/,
    birthdate: 'Geburtsdatum',
    next: 'Weiter',
    manual: /Koordinaten selbst eingeben/,
    lat: 'Breitengrad',
    lon: 'Längengrad',
    useLocation: /Diesen Standort nehmen/,
    searchBeer: 'Bier suchen',
    continueWith: /Weiter mit/,
    go: /Los geht/,
    flyHome: /Zu deinem Revier fliegen/,
  },
  en: {
    demo: /Try the demo/,
    birthdate: 'Date of birth',
    next: 'Next',
    manual: /Enter coordinates manually/,
    lat: 'Latitude',
    lon: 'Longitude',
    useLocation: /Use this location/,
    searchBeer: 'Search beers',
    continueWith: /Continue with/,
    go: /Let.s go/,
    flyHome: /Fly to your turf/,
  },
} as const;

/**
 * Walk through the demo onboarding (manual coordinates, default beer).
 * `lang` must match the language the app starts in (browser locale).
 */
export async function startDemo(page: Page, opts: { beer?: string; lang?: keyof typeof DEMO_LABELS } = {}): Promise<void> {
  const l = DEMO_LABELS[opts.lang ?? 'de'];
  await page.goto('./');
  await page.getByRole('button', { name: l.demo }).click();
  // The onboarding may re-mount once while auth settles: make sure the value sticks
  const birthdate = page.getByLabel(l.birthdate);
  await expect(async () => {
    await birthdate.fill('1990-05-17');
    await expect(birthdate).toHaveValue('1990-05-17', { timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await page.locator('.ob-check .ob-check-box').click();
  await page.getByRole('button', { name: l.next, exact: true }).click();
  await page.getByRole('button', { name: l.manual }).click();
  await page.getByLabel(l.lat).fill(String(MARIENPLATZ.lat));
  await page.getByLabel(l.lon).fill(String(MARIENPLATZ.lon));
  await page.getByRole('button', { name: l.useLocation }).click();
  if (opts.beer) {
    await page.getByLabel(l.searchBeer).fill(opts.beer);
    await page.getByRole('radio', { name: new RegExp(opts.beer) }).first().click();
  }
  await page.getByRole('button', { name: l.continueWith }).click();
  await page.getByRole('button', { name: l.go }).click();
  await expect(page.getByRole('button', { name: l.flyHome })).toBeVisible();
  await page.waitForFunction(() => !!(window as unknown as { __bcMap?: unknown }).__bcMap);
}

/** Move the map without animation (dev builds expose the MapLibre instance). */
export async function jumpTo(page: Page, lat: number, lon: number, zoom: number): Promise<void> {
  await page.evaluate(([la, lo, z]) => {
    const map = (window as unknown as { __bcMap: { jumpTo: (o: object) => void } }).__bcMap;
    map.jumpTo({ center: [lo, la], zoom: z });
  }, [lat, lon, zoom]);
}

/** Wait until venues are rendered and return the screen point of one with a ruler. */
export async function findRuledVenue(page: Page): Promise<{ x: number; y: number; name: string }> {
  const handle = await page.waitForFunction(() => {
    type F = { geometry: { coordinates: [number, number] }; properties: { beerId: string; name: string } };
    const map = (window as unknown as { __bcMap: {
      getLayer: (id: string) => unknown;
      queryRenderedFeatures: (o: object) => F[];
      getCenter: () => { lng: number; lat: number };
      project: (c: [number, number]) => { x: number; y: number };
      getCanvas: () => HTMLCanvasElement;
    } }).__bcMap;
    if (!map.getLayer('venue-dot')) return null;
    const c = map.getCenter();
    const rect = map.getCanvas().getBoundingClientRect();
    const fs = map.queryRenderedFeatures({ layers: ['venue-dot'] })
      .filter((f) => f.properties.beerId)
      .map((f) => ({ f, p: map.project(f.geometry.coordinates) }))
      // keep clear of the top bar and the tab bar
      .filter(({ p }) => p.y > 140 && p.y < rect.height - 220 && p.x > 30 && p.x < rect.width - 30)
      .sort((a, b) => ((a.f.geometry.coordinates[0] - c.lng) ** 2 + (a.f.geometry.coordinates[1] - c.lat) ** 2)
        - ((b.f.geometry.coordinates[0] - c.lng) ** 2 + (b.f.geometry.coordinates[1] - c.lat) ** 2));
    if (fs.length === 0) return null;
    return { x: fs[0].p.x + rect.left, y: fs[0].p.y + rect.top, name: fs[0].f.properties.name };
  }, null, { timeout: 30_000 });
  return (await handle.jsonValue()) as { x: number; y: number; name: string };
}

/** A tab of the bottom navigation. */
export function tab(page: Page, name: 'Entdecken' | 'Crew' | 'Quests' | 'Profil') {
  return page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button', { name: new RegExp(`^${name}`) });
}
