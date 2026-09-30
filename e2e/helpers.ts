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

/** Walk through the demo onboarding (manual coordinates, default beer). */
export async function startDemo(page: Page, opts: { beer?: string } = {}): Promise<void> {
  await page.goto('./');
  await page.getByRole('button', { name: /Demo ansehen/ }).click();
  await page.getByText('Ich bin mindestens 18 Jahre alt').click();
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await page.getByRole('button', { name: /Koordinaten selbst eingeben/ }).click();
  await page.getByLabel('Breitengrad').fill(String(MARIENPLATZ.lat));
  await page.getByLabel('Längengrad').fill(String(MARIENPLATZ.lon));
  await page.getByRole('button', { name: /Diesen Standort nehmen/ }).click();
  if (opts.beer) {
    await page.getByLabel('Bier suchen').fill(opts.beer);
    await page.getByRole('radio', { name: new RegExp(opts.beer) }).first().click();
  }
  await page.getByRole('button', { name: /Weiter mit/ }).click();
  await page.getByRole('button', { name: /Los geht/ }).click();
  await expect(page.getByRole('button', { name: /Zu deinem Revier fliegen/ })).toBeVisible();
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
