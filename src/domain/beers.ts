import type { Beer } from './types';

/** Two-letter monogram, e.g. "Hacker-Pschorr" → "HP", "Augustiner" → "AU". */
function monogram(name: string): string {
  const parts = name.split(/[\s-]+/).filter(Boolean);
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/**
 * Crest-style badge: radial gradient in the beer colour, foam ring and a
 * bold monogram. Placeholder until licensed brewery logos are available.
 */
function generateSvgLogo(name: string, color: string): string {
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

/**
 * Colours are tuned for a dark map: similar lightness, clearly separated hue,
 * loosely inspired by each brewery's brand colour.
 */
export const BEERS: Beer[] = [
  { id: 'augustiner',      name: 'Augustiner',       color: '#3fbf6a' },
  { id: 'paulaner',        name: 'Paulaner',         color: '#3d8bff' },
  { id: 'hofbraeu',        name: 'Hofbr\u00E4u',     color: '#8f7dff' },
  { id: 'loewenbraeu',     name: 'L\u00F6wenbr\u00E4u', color: '#ff8a3d' },
  { id: 'spaten',          name: 'Spaten',           color: '#ff4f5e' },
  { id: 'hacker-pschorr',  name: 'Hacker-Pschorr',   color: '#ff5fb0' },
  { id: 'weihenstephaner', name: 'Weihenstephaner',  color: '#22c7c0' },
  { id: 'erdinger',        name: 'Erdinger',         color: '#ffd23f' },
  { id: 'tegernseer',      name: 'Tegernseer',       color: '#a6e22e' },
  { id: 'schweiger',       name: 'Schweiger',        color: '#d49a6a' },
].map((b) => ({
  ...b,
  svgLogo: generateSvgLogo(b.name, b.color),
}));

export const BEER_MAP = new Map(BEERS.map((b) => [b.id, b]));
