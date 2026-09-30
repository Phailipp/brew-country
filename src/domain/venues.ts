import { matchBeerIds } from './beers';

/**
 * A real place that pours beer: pub, bar, beer garden or brewery tap.
 * Comes from OpenStreetMap, so it exists anywhere on Earth.
 */
export type VenueKind = 'pub' | 'bar' | 'biergarten' | 'brewery' | 'restaurant';

export interface Venue {
  /** OSM element id, e.g. "n123" (node) or "w456" (way) */
  id: string;
  name: string;
  lat: number;
  lon: number;
  kind: VenueKind;
  /** Catalogue beers poured here according to OSM `brewery=*` */
  beerIds: string[];
  /** Tile the venue belongs to (see venueTileKey) */
  tile: string;
}

/**
 * A visit to a venue as everyone sees it. One per player, venue and day counts.
 * `player` is a per-venue pseudonym (sha256 of uid|venueId), so visits of one
 * player cannot be linked across venues.
 */
export interface VenueCheckin {
  id: string;
  player: string;
  venueId: string;
  /** Tile of the venue, so nearby check-ins can be queried together */
  tile: string;
  beerId: string;
  /** Alcohol-free counts exactly the same: the visit is what matters */
  alcoholFree: boolean;
  createdAt: number;
}

// ── Tiles ────────────────────────────────────────────────────────────
/** Venue tiles are 0.05° squares (≈ 5.5 km N–S): one Overpass request each. */
export const VENUE_TILE_DEG = 0.05;

export function venueTileKey(lat: number, lon: number): string {
  return `${Math.floor(lat / VENUE_TILE_DEG)}_${Math.floor(lon / VENUE_TILE_DEG)}`;
}

export function tileBounds(key: string): { south: number; west: number; north: number; east: number } {
  const [r, c] = key.split('_').map(Number);
  const south = r * VENUE_TILE_DEG;
  const west = c * VENUE_TILE_DEG;
  return { south, west, north: south + VENUE_TILE_DEG, east: west + VENUE_TILE_DEG };
}

/** Tiles covering a viewport; empty when the view is too large to load. */
export function tilesForViewport(
  v: { south: number; north: number; west: number; east: number },
  maxTiles = 16,
): string[] {
  const r0 = Math.floor(v.south / VENUE_TILE_DEG);
  const r1 = Math.floor(v.north / VENUE_TILE_DEG);
  const c0 = Math.floor(Math.max(-180, v.west) / VENUE_TILE_DEG);
  const c1 = Math.floor(Math.min(179.9999, v.east) / VENUE_TILE_DEG);
  if ((r1 - r0 + 1) * (c1 - c0 + 1) > maxTiles) return [];
  const keys: string[] = [];
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) keys.push(`${r}_${c}`);
  return keys;
}

// ── Overpass ─────────────────────────────────────────────────────────
/** Overpass QL for every beer place inside a bbox. */
export function overpassQuery(b: { south: number; west: number; north: number; east: number }): string {
  const bbox = `${b.south.toFixed(5)},${b.west.toFixed(5)},${b.north.toFixed(5)},${b.east.toFixed(5)}`;
  return `[out:json][timeout:25];(`
    + `nwr["amenity"~"^(pub|bar|biergarten)$"]["name"](${bbox});`
    + `nwr["craft"="brewery"]["name"](${bbox});`
    + `nwr["microbrewery"="yes"]["name"](${bbox});`
    + `nwr["amenity"="restaurant"]["brewery"]["name"](${bbox});`
    + `);out center tags qt;`;
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function kindOf(tags: Record<string, string>): VenueKind {
  if (tags.craft === 'brewery' || tags.microbrewery === 'yes') return 'brewery';
  if (tags.amenity === 'biergarten' || tags.beer_garden === 'yes') return 'biergarten';
  if (tags.amenity === 'pub') return 'pub';
  if (tags.amenity === 'bar') return 'bar';
  return 'restaurant';
}

const BEER_AMENITIES = new Set(['pub', 'bar', 'biergarten']);

/** Places that pour beer: pubs, bars, beer gardens, breweries, restaurants with a known tap. */
function isBeerPlace(tags: Record<string, string>): boolean {
  return BEER_AMENITIES.has(tags.amenity)
    || tags.craft === 'brewery'
    || tags.microbrewery === 'yes'
    || (tags.amenity === 'restaurant' && !!tags.brewery);
}

/** Turn an Overpass JSON response into venues (deduplicated, named only). */
export function parseOverpass(json: { elements?: OverpassElement[] }): Venue[] {
  const out = new Map<string, Venue>();
  for (const el of json.elements ?? []) {
    const tags = el.tags ?? {};
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    const name = tags.name?.trim();
    if (lat === undefined || lon === undefined || !name) continue;
    if (tags.disused === 'yes' || tags['disused:amenity']) continue;
    if (!isBeerPlace(tags)) continue;
    const id = `${el.type[0]}${el.id}`;
    out.set(id, {
      id,
      name: name.slice(0, 80),
      lat,
      lon,
      kind: kindOf(tags),
      // A brewery pours its own beer; its name is the best hint
      beerIds: matchBeerIds(tags.brewery ?? (tags.craft === 'brewery' ? (tags.operator ?? name) : undefined)),
      tile: venueTileKey(lat, lon),
    });
  }
  return [...out.values()];
}

/** The player's own visit, kept in their private passport. */
export interface MyVisit {
  id: string;
  venueId: string;
  venueName: string;
  tile: string;
  beerId: string;
  alcoholFree: boolean;
  createdAt: number;
}

/** Max visits per UTC day (enforced by the rules through 2 id slots). Quality over quantity. */
export const MAX_VISITS_PER_DAY = 2;
/** You have to be this close to a venue to check in. */
export const CHECKIN_RADIUS_M = 60;

export const utcDay = (ms: number) => Math.floor(ms / 86_400_000);

/** Why a visit is refused: already here today, or the daily pub limit is used up. */
export type VisitBlocker = 'already-today' | 'daily-limit';

/**
 * Why a visit is not possible right now, or null when it is.
 * Mirrors the server rules so the player gets a friendly message first
 * (the UI translates the code).
 */
export function visitBlocker(mine: MyVisit[], venueId: string, now: number): VisitBlocker | null {
  const today = mine.filter((v) => utcDay(v.createdAt) === utcDay(now));
  if (today.some((v) => v.venueId === venueId)) return 'already-today';
  if (today.length >= MAX_VISITS_PER_DAY) return 'daily-limit';
  return null;
}

/** Error thrown by the stores when a visit is refused; `code` says why. */
export function visitBlockedError(code: VisitBlocker): Error & { code: VisitBlocker } {
  return Object.assign(new Error(code), { code });
}

/** Free id slot for today's next visit (0–2), or -1. */
export function nextVisitSlot(mine: MyVisit[], now: number, taken: (slot: number) => boolean = () => false): number {
  const used = mine.filter((v) => utcDay(v.createdAt) === utcDay(now)).length;
  for (let s = used; s < MAX_VISITS_PER_DAY; s++) if (!taken(s)) return s;
  return -1;
}
