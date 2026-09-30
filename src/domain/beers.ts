import type { Beer } from './types';
// Brand logos shipped in /public/logos (see public/logos/SOURCES.md)
import { LOGO_FILES } from './beerLogos';

/** Two-letter monogram, e.g. "Hacker-Pschorr" → "HP", "Augustiner" → "AU". */
function monogram(name: string): string {
  const parts = name.split(/[\s-]+/).filter(Boolean);
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/**
 * Crest-style badge: radial gradient in the beer colour, foam ring and a
 * bold monogram. Used whenever no brand logo is available.
 */
export function generateSvgLogo(name: string, color: string): string {
  const mono = monogram(name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
    <defs>
      <radialGradient id="g" cx="35%" cy="30%" r="75%">
        <stop offset="0" stop-color="#fff" stop-opacity=".55"/>
        <stop offset=".35" stop-color="${color}"/>
        <stop offset="1" stop-color="${color}" stop-opacity=".85"/>
      </radialGradient>
    </defs>
    <circle cx="48" cy="48" r="46" fill="#0b0a08"/>
    <circle cx="48" cy="48" r="42" fill="url(#g)"/>
    <circle cx="48" cy="48" r="35" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.5" stroke-dasharray="2 3"/>
    <text x="48" y="58" text-anchor="middle" font-family="'Bricolage Grotesque','Arial Black',Arial,sans-serif" font-size="30" font-weight="800" fill="#fff" letter-spacing="-1">${mono}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

type BeerSeed = Omit<Beer, 'svgLogo' | 'logoUrl'>;

/**
 * Built-in catalogue: the most important beers in the DACH region.
 * Ids are stable (they are stored in votes) — never rename one.
 * Colours are tuned for a dark map: similar lightness, varied hue,
 * loosely inspired by each brand.
 */
const SEED: BeerSeed[] = [
  { id: "augustiner", name: "Augustiner", brewery: "Augustiner-Bräu", city: "München", country: 'DE', color: '#3fbf6a', featured: true },
  { id: "paulaner", name: "Paulaner", brewery: "Paulaner Brauerei", city: "München", country: 'DE', color: '#3d8bff', featured: true },
  { id: "hofbraeu", name: "Hofbräu", brewery: "Staatliches Hofbräuhaus", city: "München", country: 'DE', color: '#8f7dff', featured: true },
  { id: "loewenbraeu", name: "Löwenbräu", brewery: "Löwenbräu", city: "München", country: 'DE', color: '#ff8a3d', featured: true },
  { id: "spaten", name: "Spaten", brewery: "Spaten-Franziskaner-Bräu", city: "München", country: 'DE', color: '#ff4f5e', featured: true },
  { id: "hacker-pschorr", name: "Hacker-Pschorr", brewery: "Hacker-Pschorr Bräu", city: "München", country: 'DE', color: '#ff5fb0', featured: true },
  { id: "franziskaner", name: "Franziskaner", brewery: "Spaten-Franziskaner-Bräu", city: "München", country: 'DE', color: '#e8b54c', featured: true },
  { id: "giesinger", name: "Giesinger", brewery: "Giesinger Bräu", city: "München", country: 'DE', color: '#9fb8d6', featured: true },
  { id: "weihenstephaner", name: "Weihenstephaner", brewery: "Bayerische Staatsbrauerei Weihenstephan", city: "Freising", country: 'DE', color: '#22c7c0', featured: true },
  { id: "erdinger", name: "Erdinger", brewery: "Erdinger Weißbräu", city: "Erding", country: 'DE', color: '#ffd23f', featured: true },
  { id: "tegernseer", name: "Tegernseer", brewery: "Herzogliches Brauhaus Tegernsee", city: "Tegernsee", country: 'DE', color: '#a6e22e', featured: true },
  { id: "schweiger", name: "Schweiger", brewery: "Privatbrauerei Schweiger", city: "Markt Schwaben", country: 'DE', color: '#d49a6a', featured: true },
  { id: "ayinger", name: "Ayinger", brewery: "Brauerei Aying", city: "Aying", country: 'DE', color: '#5fd3f3', featured: true },
  { id: "andechser", name: "Andechser", brewery: "Klosterbrauerei Andechs", city: "Andechs", country: 'DE', color: '#b98cff', featured: true },
  { id: "schneider-weisse", name: "Schneider Weisse", brewery: "Weisses Bräuhaus G. Schneider & Sohn", city: "Kelheim", country: 'DE', color: '#f39c3d', featured: true },
  { id: "koenig-ludwig", name: "König Ludwig", brewery: "Schlossbrauerei Kaltenberg", city: "Kaltenberg", country: 'DE', color: '#e0604f' },
  { id: "aldersbacher", name: "Aldersbacher", brewery: "Brauerei Aldersbach", city: "Aldersbach", country: 'DE', color: '#7ed3a8' },
  { id: "riegele", name: "Riegele", brewery: "Brauhaus Riegele", city: "Augsburg", country: 'DE', color: '#ff8080' },
  { id: "tucher", name: "Tucher", brewery: "Tucher Bräu", city: "Nürnberg", country: 'DE', color: '#dcc66e' },
  { id: "kulmbacher", name: "Kulmbacher", brewery: "Kulmbacher Brauerei", city: "Kulmbach", country: 'DE', color: '#6cb7b9' },
  { id: "krombacher", name: "Krombacher", brewery: "Krombacher Brauerei", city: "Kreuztal", country: 'DE', color: '#4cc38a' },
  { id: "bitburger", name: "Bitburger", brewery: "Bitburger Brauerei", city: "Bitburg", country: 'DE', color: '#e5c86a' },
  { id: "warsteiner", name: "Warsteiner", brewery: "Warsteiner Brauerei", city: "Warstein", country: 'DE', color: '#ff6b6b' },
  { id: "veltins", name: "Veltins", brewery: "Brauerei C. & A. Veltins", city: "Meschede", country: 'DE', color: '#56b4e9' },
  { id: "becks", name: "Beck's", brewery: "Brauerei Beck", city: "Bremen", country: 'DE', color: '#35d07f' },
  { id: "radeberger", name: "Radeberger", brewery: "Radeberger Exportbierbrauerei", city: "Radeberg", country: 'DE', color: '#cbb682' },
  { id: "jever", name: "Jever", brewery: "Friesisches Brauhaus zu Jever", city: "Jever", country: 'DE', color: '#7cc35a' },
  { id: "rothaus", name: "Rothaus", brewery: "Badische Staatsbrauerei Rothaus", city: "Grafenhausen", country: 'DE', color: '#ff9270' },
  { id: "oettinger", name: "Oettinger", brewery: "Oettinger Brauerei", city: "Oettingen", country: 'DE', color: '#f5d76e' },
  { id: "koestritzer", name: "Köstritzer", brewery: "Köstritzer Schwarzbierbrauerei", city: "Bad Köstritz", country: 'DE', color: '#b8a2e0' },
  { id: "flensburger", name: "Flensburger", brewery: "Flensburger Brauerei", city: "Flensburg", country: 'DE', color: '#4fc3f7' },
  { id: "holsten", name: "Holsten", brewery: "Holsten-Brauerei", city: "Hamburg", country: 'DE', color: '#5b8fd6' },
  { id: "astra", name: "Astra", brewery: "Holsten-Brauerei", city: "Hamburg", country: 'DE', color: '#ff4d8d' },
  { id: "berliner-kindl", name: "Berliner Kindl", brewery: "Berliner-Kindl-Schultheiss-Brauerei", city: "Berlin", country: 'DE', color: '#ffa552' },
  { id: "frueh", name: "Früh Kölsch", brewery: "Cölner Hofbräu Früh", city: "Köln", country: 'DE', color: '#f8e287' },
  { id: "gaffel", name: "Gaffel Kölsch", brewery: "Privatbrauerei Gaffel", city: "Köln", country: 'DE', color: '#f0883a' },
  { id: "reissdorf", name: "Reissdorf Kölsch", brewery: "Privatbrauerei Heinrich Reissdorf", city: "Köln", country: 'DE', color: '#2cc2a0' },
  { id: "diebels", name: "Diebels Alt", brewery: "Privatbrauerei Diebels", city: "Issum", country: 'DE', color: '#d9705f' },
  { id: "stiegl", name: "Stiegl", brewery: "Stieglbrauerei zu Salzburg", city: "Salzburg", country: 'AT', color: '#f25c5c' },
  { id: "goesser", name: "Gösser", brewery: "Brauerei Göss", city: "Leoben", country: 'AT', color: '#72c56f' },
  { id: "ottakringer", name: "Ottakringer", brewery: "Ottakringer Brauerei", city: "Wien", country: 'AT', color: '#ffcf40' },
  { id: "zipfer", name: "Zipfer", brewery: "Brauerei Zipf", city: "Zipf", country: 'AT', color: '#35b3a6' },
  { id: "puntigamer", name: "Puntigamer", brewery: "Brauerei Puntigam", city: "Graz", country: 'AT', color: '#c06bd1' },
  { id: "murauer", name: "Murauer", brewery: "Brauerei Murau", city: "Murau", country: 'AT', color: '#a88372' },
  { id: "wieselburger", name: "Wieselburger", brewery: "Brauerei Wieselburg", city: "Wieselburg", country: 'AT', color: '#3cc0f5' },
  { id: "feldschloesschen", name: "Feldschlösschen", brewery: "Brauerei Feldschlösschen", city: "Rheinfelden", country: 'CH', color: '#ff7a52' },
  { id: "appenzeller", name: "Appenzeller", brewery: "Brauerei Locher", city: "Appenzell", country: 'CH', color: '#ffbe5c' },
  { id: "calanda", name: "Calanda", brewery: "Calanda Bräu", city: "Chur", country: 'CH', color: '#56d6e6' },
  { id: "eichhof", name: "Eichhof", brewery: "Brauerei Eichhof", city: "Luzern", country: 'CH', color: '#a5d46e' },
];

function hydrate(seed: BeerSeed & { logoUrl?: string }): Beer {
  const file = LOGO_FILES[seed.id];
  return {
    ...seed,
    svgLogo: generateSvgLogo(seed.name, seed.color),
    logoUrl: seed.logoUrl ?? (file ? `${import.meta.env.BASE_URL}logos/${file}` : undefined),
  };
}

// ── Live catalogue (built-ins + approved community beers) ────────────
// Arrays are mutated in place so that existing imports stay valid.
export const BEERS: Beer[] = SEED.map(hydrate);
export const BEER_MAP = new Map(BEERS.map((b) => [b.id, b]));

let version = 0;
const listeners = new Set<() => void>();

/** Add or update beers (e.g. approved submissions from the server). */
export function registerBeers(beers: (BeerSeed & { logoUrl?: string })[]): void {
  let changed = false;
  for (const seed of beers) {
    if (BEER_MAP.has(seed.id) && BEER_MAP.get(seed.id)?.source !== 'community') continue; // built-ins win
    const beer = hydrate({ ...seed, source: 'community' });
    const idx = BEERS.findIndex((b) => b.id === beer.id);
    if (idx >= 0) BEERS[idx] = beer;
    else BEERS.push(beer);
    BEER_MAP.set(beer.id, beer);
    changed = true;
  }
  if (changed) {
    version++;
    listeners.forEach((l) => l());
  }
}

export function subscribeBeerCatalog(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function beerCatalogVersion(): number {
  return version;
}

const COUNTRY_ORDER: Record<string, number> = { DE: 0, AT: 1, CH: 2 };

/** Case/diacritics-insensitive search over name, brewery and city; featured first. */
export function searchBeers(query: string): Beer[] {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss');
  const q = norm(query.trim());
  const list = q
    ? BEERS.filter((b) => norm(`${b.name} ${b.brewery ?? ''} ${b.city ?? ''}`).includes(q))
    : [...BEERS];
  return list.sort((a, b) =>
    Number(!!b.featured) - Number(!!a.featured)
    || (COUNTRY_ORDER[a.country ?? 'DE'] ?? 3) - (COUNTRY_ORDER[b.country ?? 'DE'] ?? 3)
    || a.name.localeCompare(b.name, 'de'));
}
