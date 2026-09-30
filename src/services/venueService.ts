import Dexie from 'dexie';
import { overpassQuery, parseOverpass, tileBounds, type Venue } from '../domain/venues';

/**
 * Venues come straight from OpenStreetMap (Overpass API), so the game works
 * in any city on Earth without our own venue database. Tiles are cached in
 * IndexedDB for a week; one request covers all missing tiles of a viewport.
 */
const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const TTL_MS = 7 * 24 * 3600 * 1000;
const TIMEOUT_MS = 30_000;

interface TileRow {
  key: string;
  fetchedAt: number;
  venues: Venue[];
}

class VenueCache extends Dexie {
  tiles!: Dexie.Table<TileRow, string>;
  constructor() {
    super('BrewCountryVenues');
    this.version(1).stores({ tiles: 'key' });
  }
}

let cache: VenueCache | null = null;
function db(): VenueCache | null {
  try {
    cache ??= new VenueCache();
    return cache;
  } catch {
    return null;
  }
}

const memory = new Map<string, TileRow>();
const inflight = new Map<string, Promise<void>>();

async function fromCache(key: string, now: number): Promise<TileRow | null> {
  const m = memory.get(key);
  if (m && now - m.fetchedAt < TTL_MS) return m;
  try {
    const row = await db()?.tiles.get(key);
    if (row && now - row.fetchedAt < TTL_MS) {
      memory.set(key, row);
      return row;
    }
  } catch {
    // private mode / blocked storage: memory only
  }
  return null;
}

async function fetchOverpass(query: string, signal?: AbortSignal): Promise<unknown> {
  let lastError: unknown = null;
  for (const url of MIRRORS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const onAbort = () => ctrl.abort();
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      const res = await fetch(url, {
        method: 'POST',
        body: new URLSearchParams({ data: query }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`Overpass ${res.status}`);
      return await res.json();
    } catch (e) {
      if (signal?.aborted) throw e;
      lastError = e;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }
  throw lastError ?? new Error('Overpass unreachable');
}

/** Load (bounding box of) the given tiles in one request and cache each tile. */
async function loadTiles(keys: string[], signal?: AbortSignal): Promise<void> {
  const bounds = keys.map(tileBounds);
  const bbox = {
    south: Math.min(...bounds.map((b) => b.south)),
    west: Math.min(...bounds.map((b) => b.west)),
    north: Math.max(...bounds.map((b) => b.north)),
    east: Math.max(...bounds.map((b) => b.east)),
  };
  const venues = parseOverpass((await fetchOverpass(overpassQuery(bbox), signal)) as { elements?: [] });
  const fetchedAt = Date.now();
  const rows: TileRow[] = keys.map((key) => ({ key, fetchedAt, venues: venues.filter((v) => v.tile === key) }));
  for (const r of rows) memory.set(r.key, r);
  try {
    await db()?.tiles.bulkPut(rows);
  } catch {
    // cache is best effort
  }
}

/** All venues of the given tiles (cached where possible). */
export async function loadVenues(keys: string[], signal?: AbortSignal): Promise<Venue[]> {
  const now = Date.now();
  const rows = await Promise.all(keys.map((k) => fromCache(k, now)));
  const missing = keys.filter((k, i) => !rows[i] && !inflight.has(k));
  if (missing.length > 0) {
    const p = loadTiles(missing, signal);
    for (const k of missing) inflight.set(k, p);
    try {
      await p;
    } finally {
      for (const k of missing) inflight.delete(k);
    }
  }
  await Promise.all(keys.map((k) => inflight.get(k)?.catch(() => undefined)));
  return keys.flatMap((k) => memory.get(k)?.venues ?? []);
}

/** Venues we already know, without touching the network. */
export function cachedVenue(id: string): Venue | null {
  for (const row of memory.values()) {
    const v = row.venues.find((x) => x.id === id);
    if (v) return v;
  }
  return null;
}
