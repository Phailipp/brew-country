/**
 * Beer capitals of the world. Used to seed demo simulations and to guess the
 * country of a map position without a reverse-geocoding service.
 */
export interface WorldCity {
  name: string;
  lat: number;
  lon: number;
  /** ISO 3166-1 alpha-2 */
  country: string;
}

export const WORLD_CITIES: WorldCity[] = [
  // DACH
  { name: 'München', lat: 48.135, lon: 11.582, country: 'DE' },
  { name: 'Berlin', lat: 52.52, lon: 13.405, country: 'DE' },
  { name: 'Hamburg', lat: 53.551, lon: 9.994, country: 'DE' },
  { name: 'Köln', lat: 50.938, lon: 6.96, country: 'DE' },
  { name: 'Frankfurt', lat: 50.111, lon: 8.682, country: 'DE' },
  { name: 'Stuttgart', lat: 48.776, lon: 9.183, country: 'DE' },
  { name: 'Bamberg', lat: 49.891, lon: 10.887, country: 'DE' },
  { name: 'Leipzig', lat: 51.34, lon: 12.375, country: 'DE' },
  { name: 'Wien', lat: 48.208, lon: 16.374, country: 'AT' },
  { name: 'Salzburg', lat: 47.811, lon: 13.055, country: 'AT' },
  { name: 'Graz', lat: 47.076, lon: 15.421, country: 'AT' },
  { name: 'Zürich', lat: 47.377, lon: 8.542, country: 'CH' },
  { name: 'Bern', lat: 46.948, lon: 7.448, country: 'CH' },
  // Europe
  { name: 'Prag', lat: 50.075, lon: 14.438, country: 'CZ' },
  { name: 'Pilsen', lat: 49.747, lon: 13.378, country: 'CZ' },
  { name: 'Brüssel', lat: 50.85, lon: 4.352, country: 'BE' },
  { name: 'Amsterdam', lat: 52.37, lon: 4.895, country: 'NL' },
  { name: 'Kopenhagen', lat: 55.676, lon: 12.568, country: 'DK' },
  { name: 'Dublin', lat: 53.35, lon: -6.26, country: 'IE' },
  { name: 'London', lat: 51.507, lon: -0.128, country: 'GB' },
  { name: 'Edinburgh', lat: 55.953, lon: -3.188, country: 'GB' },
  { name: 'Paris', lat: 48.857, lon: 2.352, country: 'FR' },
  { name: 'Barcelona', lat: 41.385, lon: 2.173, country: 'ES' },
  { name: 'Madrid', lat: 40.417, lon: -3.704, country: 'ES' },
  { name: 'Lissabon', lat: 38.722, lon: -9.139, country: 'PT' },
  { name: 'Rom', lat: 41.903, lon: 12.496, country: 'IT' },
  { name: 'Mailand', lat: 45.464, lon: 9.19, country: 'IT' },
  { name: 'Warschau', lat: 52.23, lon: 21.012, country: 'PL' },
  { name: 'Krakau', lat: 50.065, lon: 19.945, country: 'PL' },
  { name: 'Stockholm', lat: 59.329, lon: 18.069, country: 'SE' },
  { name: 'Istanbul', lat: 41.008, lon: 28.978, country: 'TR' },
  // Americas
  { name: 'New York', lat: 40.713, lon: -74.006, country: 'US' },
  { name: 'Portland', lat: 45.515, lon: -122.679, country: 'US' },
  { name: 'San Diego', lat: 32.716, lon: -117.161, country: 'US' },
  { name: 'Denver', lat: 39.739, lon: -104.99, country: 'US' },
  { name: 'Chicago', lat: 41.878, lon: -87.63, country: 'US' },
  { name: 'Milwaukee', lat: 43.039, lon: -87.906, country: 'US' },
  { name: 'Toronto', lat: 43.653, lon: -79.383, country: 'CA' },
  { name: 'Montréal', lat: 45.502, lon: -73.567, country: 'CA' },
  { name: 'Mexiko-Stadt', lat: 19.433, lon: -99.133, country: 'MX' },
  { name: 'São Paulo', lat: -23.551, lon: -46.633, country: 'BR' },
  { name: 'Buenos Aires', lat: -34.604, lon: -58.382, country: 'AR' },
  { name: 'Bogotá', lat: 4.711, lon: -74.072, country: 'CO' },
  { name: 'Lima', lat: -12.046, lon: -77.043, country: 'PE' },
  // Asia / Pacific
  { name: 'Tokio', lat: 35.676, lon: 139.65, country: 'JP' },
  { name: 'Sapporo', lat: 43.062, lon: 141.354, country: 'JP' },
  { name: 'Seoul', lat: 37.567, lon: 126.978, country: 'KR' },
  { name: 'Peking', lat: 39.904, lon: 116.407, country: 'CN' },
  { name: 'Qingdao', lat: 36.067, lon: 120.383, country: 'CN' },
  { name: 'Shanghai', lat: 31.23, lon: 121.474, country: 'CN' },
  { name: 'Bangkok', lat: 13.756, lon: 100.502, country: 'TH' },
  { name: 'Singapur', lat: 1.352, lon: 103.82, country: 'SG' },
  { name: 'Manila', lat: 14.6, lon: 120.984, country: 'PH' },
  { name: 'Hanoi', lat: 21.028, lon: 105.854, country: 'VN' },
  { name: 'Bali', lat: -8.65, lon: 115.216, country: 'ID' },
  { name: 'Mumbai', lat: 19.076, lon: 72.878, country: 'IN' },
  { name: 'Sydney', lat: -33.869, lon: 151.209, country: 'AU' },
  { name: 'Melbourne', lat: -37.814, lon: 144.963, country: 'AU' },
  { name: 'Auckland', lat: -36.848, lon: 174.763, country: 'NZ' },
  // Africa
  { name: 'Kapstadt', lat: -33.925, lon: 18.424, country: 'ZA' },
  { name: 'Johannesburg', lat: -26.204, lon: 28.047, country: 'ZA' },
  { name: 'Nairobi', lat: -1.286, lon: 36.817, country: 'KE' },
  { name: 'Lagos', lat: 6.524, lon: 3.379, country: 'NG' },
];

const DEG = Math.PI / 180;

/** Nearest known beer city (equirectangular distance is plenty here). */
export function nearestCity(lat: number, lon: number): WorldCity {
  let best = WORLD_CITIES[0];
  let bestD = Infinity;
  for (const c of WORLD_CITIES) {
    let dLon = Math.abs(c.lon - lon);
    if (dLon > 180) dLon = 360 - dLon;
    const x = dLon * Math.cos(((c.lat + lat) / 2) * DEG);
    const y = c.lat - lat;
    const d = x * x + y * y;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

/** Best guess of the player's country: browser locale region, else null. */
export function localeCountry(): string | null {
  if (typeof navigator === 'undefined') return null;
  for (const tag of navigator.languages ?? [navigator.language]) {
    const m = /-([A-Z]{2})\b/.exec(tag ?? '');
    if (m) return m[1];
  }
  return null;
}
