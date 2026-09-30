import type { Beer } from './types';
// Brand logos dropped into src/assets/logos (see beerLogos.ts)
import { LOGO_URLS } from './beerLogos';

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
 * Built-in catalogue: the most important beers of the DACH region plus the
 * big names of every major beer country.
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
  // ── Europe ─────────────────────────────────────────────────────────
  { id: "pilsner-urquell", name: "Pilsner Urquell", brewery: "Plzeňský Prazdroj", city: "Plzeň", country: 'CZ', color: '#e3c35a', aliases: ["Plzeňský Prazdroj", "Prazdroj"] },
  { id: "budvar", name: "Budweiser Budvar", brewery: "Budějovický Budvar", city: "České Budějovice", country: 'CZ', color: '#d94f4f', aliases: ["Budvar"] },
  { id: "kozel", name: "Kozel", brewery: "Pivovar Velké Popovice", city: "Velké Popovice", country: 'CZ', color: '#c9a27e', aliases: ["Velkopopovický Kozel"] },
  { id: "staropramen", name: "Staropramen", brewery: "Pivovar Staropramen", city: "Praha", country: 'CZ', color: '#4a90e2' },
  { id: "stella-artois", name: "Stella Artois", brewery: "Brouwerij Artois", city: "Leuven", country: 'BE', color: '#c8a94a', aliases: ["Stella"] },
  { id: "leffe", name: "Leffe", brewery: "Abbaye de Leffe", city: "Dinant", country: 'BE', color: '#b5652e' },
  { id: "duvel", name: "Duvel", brewery: "Duvel Moortgat", city: "Puurs", country: 'BE', color: '#f2e6a0' },
  { id: "chimay", name: "Chimay", brewery: "Bières de Chimay", city: "Baileux", country: 'BE', color: '#8e5bd6' },
  { id: "hoegaarden", name: "Hoegaarden", brewery: "Brouwerij van Hoegaarden", city: "Hoegaarden", country: 'BE', color: '#9ad0f5' },
  { id: "jupiler", name: "Jupiler", brewery: "Brasserie Piedbœuf", city: "Jupille-sur-Meuse", country: 'BE', color: '#e85d3a' },
  { id: "heineken", name: "Heineken", brewery: "Heineken", city: "Amsterdam", country: 'NL', color: '#1fae5b' },
  { id: "amstel", name: "Amstel", brewery: "Amstel Brouwerij", city: "Amsterdam", country: 'NL', color: '#d63a3a' },
  { id: "grolsch", name: "Grolsch", brewery: "Grolsche Bierbrouwerij", city: "Enschede", country: 'NL', color: '#3f9e6e' },
  { id: "carlsberg", name: "Carlsberg", brewery: "Carlsberg", city: "København", country: 'DK', color: '#5cc98a' },
  { id: "tuborg", name: "Tuborg", brewery: "Carlsberg", city: "København", country: 'DK', color: '#e0a93b' },
  { id: "guinness", name: "Guinness", brewery: "St. James's Gate", city: "Dublin", country: 'IE', color: '#f4efe4' },
  { id: "brewdog", name: "BrewDog", brewery: "BrewDog", city: "Ellon", country: 'GB', color: '#2bb3d9' },
  { id: "fullers", name: "Fuller's", brewery: "Fuller's Griffin Brewery", city: "London", country: 'GB', color: '#b04a5a', aliases: ["Fullers"] },
  { id: "kronenbourg", name: "Kronenbourg 1664", brewery: "Brasseries Kronenbourg", city: "Obernai", country: 'FR', color: '#3d6fd6', aliases: ["Kronenbourg", "1664"] },
  { id: "peroni", name: "Peroni", brewery: "Birra Peroni", city: "Roma", country: 'IT', color: '#2f5fbf', aliases: ["Nastro Azzurro"] },
  { id: "moretti", name: "Birra Moretti", brewery: "Birra Moretti", city: "Udine", country: 'IT', color: '#c98d4a', aliases: ["Moretti"] },
  { id: "estrella-damm", name: "Estrella Damm", brewery: "Damm", city: "Barcelona", country: 'ES', color: '#e03c3c', aliases: ["Damm"] },
  { id: "mahou", name: "Mahou", brewery: "Mahou San Miguel", city: "Madrid", country: 'ES', color: '#f06a4a' },
  { id: "estrella-galicia", name: "Estrella Galicia", brewery: "Hijos de Rivera", city: "A Coruña", country: 'ES', color: '#e8c547' },
  { id: "super-bock", name: "Super Bock", brewery: "Super Bock Group", city: "Leça do Balio", country: 'PT', color: '#c7372f' },
  { id: "sagres", name: "Sagres", brewery: "Sociedade Central de Cervejas", city: "Vialonga", country: 'PT', color: '#6ec1e4' },
  { id: "tyskie", name: "Tyskie", brewery: "Tyskie Browary Książęce", city: "Tychy", country: 'PL', color: '#d9a441' },
  { id: "zywiec", name: "Żywiec", brewery: "Grupa Żywiec", city: "Żywiec", country: 'PL', color: '#c4524a' },
  { id: "efes", name: "Efes", brewery: "Anadolu Efes", city: "İstanbul", country: 'TR', color: '#2f7de1' },
  // ── Americas ───────────────────────────────────────────────────────
  { id: "budweiser", name: "Budweiser", brewery: "Anheuser-Busch", city: "St. Louis", country: 'US', color: '#e5484d', aliases: ["Anheuser Busch", "Bud Light"] },
  { id: "coors", name: "Coors", brewery: "Molson Coors", city: "Golden", country: 'US', color: '#9fc5e8', aliases: ["Coors Light"] },
  { id: "miller", name: "Miller Lite", brewery: "Miller Brewing", city: "Milwaukee", country: 'US', color: '#4f7cd6', aliases: ["Miller"] },
  { id: "sierra-nevada", name: "Sierra Nevada", brewery: "Sierra Nevada Brewing Co.", city: "Chico", country: 'US', color: '#3fa46a' },
  { id: "samuel-adams", name: "Samuel Adams", brewery: "Boston Beer Company", city: "Boston", country: 'US', color: '#2d4f9e', aliases: ["Sam Adams"] },
  { id: "brooklyn", name: "Brooklyn Lager", brewery: "Brooklyn Brewery", city: "New York", country: 'US', color: '#8fbf3f' },
  { id: "lagunitas", name: "Lagunitas", brewery: "Lagunitas Brewing Company", city: "Petaluma", country: 'US', color: '#f2c14e' },
  { id: "stone", name: "Stone", brewery: "Stone Brewing", city: "Escondido", country: 'US', color: '#9aa4b1' },
  { id: "blue-moon", name: "Blue Moon", brewery: "Blue Moon Brewing Company", city: "Denver", country: 'US', color: '#5b8def' },
  { id: "molson", name: "Molson Canadian", brewery: "Molson Brewery", city: "Montréal", country: 'CA', color: '#d64545', aliases: ["Molson"] },
  { id: "labatt", name: "Labatt", brewery: "Labatt Brewing Company", city: "London (Ontario)", country: 'CA', color: '#3e6bd1' },
  { id: "corona", name: "Corona", brewery: "Grupo Modelo", city: "Mexiko-Stadt", country: 'MX', color: '#f7d774', aliases: ["Corona Extra"] },
  { id: "modelo", name: "Modelo Especial", brewery: "Grupo Modelo", city: "Mexiko-Stadt", country: 'MX', color: '#c9a64a', aliases: ["Modelo"] },
  { id: "dos-equis", name: "Dos Equis", brewery: "Cervecería Cuauhtémoc Moctezuma", city: "Monterrey", country: 'MX', color: '#b52f2f', aliases: ["XX"] },
  { id: "pacifico", name: "Pacifico", brewery: "Cervecería del Pacífico", city: "Mazatlán", country: 'MX', color: '#f0d25a' },
  { id: "brahma", name: "Brahma", brewery: "Ambev", city: "Rio de Janeiro", country: 'BR', color: '#d63031' },
  { id: "skol", name: "Skol", brewery: "Ambev", city: "São Paulo", country: 'BR', color: '#f5c518' },
  { id: "aguila", name: "Águila", brewery: "Bavaria", city: "Barranquilla", country: 'CO', color: '#ffd400' },
  { id: "quilmes", name: "Quilmes", brewery: "Cervecería Quilmes", city: "Quilmes", country: 'AR', color: '#4ea3e6' },
  { id: "cusquena", name: "Cusqueña", brewery: "Backus", city: "Cusco", country: 'PE', color: '#d4a017' },
  { id: "red-stripe", name: "Red Stripe", brewery: "Desnoes & Geddes", city: "Kingston", country: 'JM', color: '#e03c3c' },
  // ── Asia & Pacific ─────────────────────────────────────────────────
  { id: "asahi", name: "Asahi Super Dry", brewery: "Asahi Breweries", city: "Tokio", country: 'JP', color: '#c0c7d1', aliases: ["Asahi"] },
  { id: "kirin", name: "Kirin Ichiban", brewery: "Kirin Brewery", city: "Tokio", country: 'JP', color: '#e2b04a', aliases: ["Kirin"] },
  { id: "sapporo", name: "Sapporo", brewery: "Sapporo Breweries", city: "Sapporo", country: 'JP', color: '#f1c232' },
  { id: "tsingtao", name: "Tsingtao", brewery: "Tsingtao Brewery", city: "Qingdao", country: 'CN', color: '#3fae6a' },
  { id: "harbin", name: "Harbin", brewery: "Harbin Brewery", city: "Harbin", country: 'CN', color: '#5aa0e0' },
  { id: "cass", name: "Cass", brewery: "Oriental Brewery", city: "Seoul", country: 'KR', color: '#4a7fd8' },
  { id: "hite", name: "Hite", brewery: "HiteJinro", city: "Seoul", country: 'KR', color: '#62b0e8' },
  { id: "singha", name: "Singha", brewery: "Boon Rawd Brewery", city: "Bangkok", country: 'TH', color: '#d4af37' },
  { id: "chang", name: "Chang", brewery: "ThaiBev", city: "Bangkok", country: 'TH', color: '#3fae5a' },
  { id: "tiger", name: "Tiger", brewery: "Asia Pacific Breweries", city: "Singapur", country: 'SG', color: '#f08a24' },
  { id: "san-miguel", name: "San Miguel", brewery: "San Miguel Brewery", city: "Manila", country: 'PH', color: '#d9b24c' },
  { id: "bia-saigon", name: "Bia Saigon", brewery: "Sabeco", city: "Ho-Chi-Minh-Stadt", country: 'VN', color: '#e05050', aliases: ["Saigon"] },
  { id: "bintang", name: "Bintang", brewery: "Multi Bintang", city: "Jakarta", country: 'ID', color: '#e53935' },
  { id: "kingfisher", name: "Kingfisher", brewery: "United Breweries", city: "Bengaluru", country: 'IN', color: '#e84a3c' },
  { id: "victoria-bitter", name: "Victoria Bitter", brewery: "Carlton & United Breweries", city: "Melbourne", country: 'AU', color: '#2b8a3e', aliases: ["VB"] },
  { id: "coopers", name: "Coopers", brewery: "Coopers Brewery", city: "Adelaide", country: 'AU', color: '#e6b422' },
  { id: "xxxx", name: "XXXX", brewery: "Castlemaine Perkins", city: "Brisbane", country: 'AU', color: '#e03131', aliases: ["Castlemaine XXXX"] },
  { id: "steinlager", name: "Steinlager", brewery: "Lion", city: "Auckland", country: 'NZ', color: '#35a26b' },
  // ── Africa ─────────────────────────────────────────────────────────
  { id: "castle", name: "Castle Lager", brewery: "South African Breweries", city: "Johannesburg", country: 'ZA', color: '#e3b341', aliases: ["Castle"] },
  { id: "tusker", name: "Tusker", brewery: "East African Breweries", city: "Nairobi", country: 'KE', color: '#f2c230' },
  { id: "star", name: "Star Lager", brewery: "Nigerian Breweries", city: "Lagos", country: 'NG', color: '#e84545' },
];

function hydrate(seed: BeerSeed & { logoUrl?: string }): Beer {
  return {
    ...seed,
    svgLogo: generateSvgLogo(seed.name, seed.color),
    logoUrl: seed.logoUrl ?? LOGO_URLS[seed.id],
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

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss');

/**
 * Case/diacritics-insensitive search over name, brewery, city and aliases.
 * Beers from `preferCountry` come first, then the featured ones.
 */
export function searchBeers(query: string, preferCountry?: string | null): Beer[] {
  const q = norm(query.trim());
  const list = q
    ? BEERS.filter((b) => norm(`${b.name} ${b.brewery ?? ''} ${b.city ?? ''} ${(b.aliases ?? []).join(' ')}`).includes(q))
    : [...BEERS];
  const home = preferCountry ?? 'DE';
  return list.sort((a, b) =>
    Number(b.country === home) - Number(a.country === home)
    || Number(!!b.featured) - Number(!!a.featured)
    || a.name.localeCompare(b.name, 'de'));
}

const compact = (s: string) => norm(s).replace(/[^a-z0-9]+/g, '');

/**
 * Match a free-text brewery/brand (e.g. OSM `brewery=Augustiner;Paulaner`)
 * to catalogue ids. Unknown brands are skipped.
 */
export function matchBeerIds(value: string | undefined | null): string[] {
  if (!value) return [];
  const catalogue = BEERS.map((b) => ({
    id: b.id,
    keys: [b.name, b.brewery ?? '', ...(b.aliases ?? [])].map(compact).filter((k) => k.length >= 3),
  }));
  // Strictest rule first, so "Budweiser" never lands on "Budweiser Budvar"
  const rules: ((p: string, k: string) => boolean)[] = [
    (p, k) => p === k,
    (p, k) => k.length >= 5 && p.includes(k),
    (p, k) => p.length >= 5 && k.startsWith(p),
  ];
  const ids = new Set<string>();
  for (const part of value.split(/[;,/]/)) {
    const p = compact(part);
    if (p.length < 2) continue;
    for (const rule of rules) {
      const hit = catalogue.find((b) => b.keys.some((k) => rule(p, k)));
      if (hit) { ids.add(hit.id); break; }
    }
  }
  return [...ids];
}
