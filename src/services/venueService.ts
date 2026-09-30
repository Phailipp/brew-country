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
const TIMEOUT_MS = 15_000;
/** A mirror that answered 429/5xx or timed out is skipped for a while. */
const MIRROR_COOLDOWN_MS = 2 * 60_000;
const mirrorDownUntil = new Map<string, number>();

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
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('offline');
  let lastError: unknown = null;
  // Healthy mirrors first; if all are cooling down, try them anyway
  const now = Date.now();
  const order = [...MIRRORS].sort((a, b) => Number((mirrorDownUntil.get(a) ?? 0) > now) - Number((mirrorDownUntil.get(b) ?? 0) > now));
  for (const url of order) {
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
      const json = await res.json();
      mirrorDownUntil.delete(url);
      return json;
    } catch (e) {
      if (signal?.aborted) throw e;
      mirrorDownUntil.set(url, Date.now() + MIRROR_COOLDOWN_MS);
      lastError = e;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }
  throw lastError ?? new Error('Overpass unreachable');
}

/** Load (bounding box of) the given tiles in one request and cache each tile. */
async function loadTiles(keys: string[]): Promise<void> {
  const bounds = keys.map(tileBounds);
  const bbox = {
    south: Math.min(...bounds.map((b) => b.south)),
    west: Math.min(...bounds.map((b) => b.west)),
    north: Math.max(...bounds.map((b) => b.north)),
    east: Math.max(...bounds.map((b) => b.east)),
  };
  const venues = parseOverpass((await fetchOverpass(overpassQuery(bbox))) as { elements?: [] });
  const fetchedAt = Date.now();
  const rows: TileRow[] = keys.map((key) => ({ key, fetchedAt, venues: venues.filter((v) => v.tile === key) }));
  for (const r of rows) memory.set(r.key, r);
  try {
    await db()?.tiles.bulkPut(rows);
  } catch {
    // cache is best effort
  }
}

/**
 * All venues of the given tiles (cached where possible). Rejects when a tile
 * could not be loaded, so callers never mistake an outage for "no pubs here".
 * Requests are shared between callers and never tied to one caller's abort
 * signal; `signal` only stops *this* caller from waiting.
 */
export async function loadVenues(keys: string[], signal?: AbortSignal): Promise<Venue[]> {
  const now = Date.now();
  const rows = await Promise.all(keys.map((k) => fromCache(k, now)));
  const missing = keys.filter((k, i) => !rows[i] && !inflight.has(k));
  if (missing.length > 0) {
    const p = loadTiles(missing).finally(() => { for (const k of missing) inflight.delete(k); });
    for (const k of missing) inflight.set(k, p);
    p.catch(() => undefined); // observed below; avoid unhandled rejections
  }
  const pending = [...new Set(keys.map((k) => inflight.get(k)).filter((p): p is Promise<void> => !!p))];
  const all = Promise.all(pending);
  await (signal
    ? Promise.race([all, new Promise<never>((_, reject) => {
      if (signal.aborted) reject(new DOMException('Aborted', 'AbortError'));
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    })])
    : all);
  if (keys.some((k) => !memory.has(k))) throw new Error('Venue tiles unavailable');
  return keys.flatMap((k) => memory.get(k)?.venues ?? []);
}

