import type { Beer } from './types';

function generateSvgLogo(name: string, color: string): string {
  const short = name.length > 8 ? name.substring(0, 7) + '.' : name;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
    <circle cx="40" cy="40" r="36" fill="${color}" opacity="0.85"/>
    <circle cx="40" cy="40" r="36" fill="none" stroke="#fff" stroke-width="2"/>
    <text x="40" y="36" text-anchor="middle" font-family="Arial,sans-serif" font-size="${short.length > 6 ? 8 : 10}" font-weight="bold" fill="#fff">${short}</text>
    <text x="40" y="50" text-anchor="middle" font-family="Arial,sans-serif" font-size="7" fill="#fff" opacity="0.8">Bier</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const BEERS: Beer[] = [
  { id: 'augustiner',      name: 'Augustiner',       color: '#1B5E20' },
  { id: 'paulaner',         name: 'Paulaner',         color: '#0D47A1' },
  { id: 'hofbraeu',         name: 'Hofbr\u00E4u',     color: '#4A148C' },
  { id: 'loewenbraeu',      name: 'L\u00F6wenbr\u00E4u', color: '#E65100' },
  { id: 'spaten',           name: 'Spaten',           color: '#B71C1C' },
  { id: 'hacker-pschorr',   name: 'Hacker-Pschorr',   color: '#880E4F' },
  { id: 'weihenstephaner',  name: 'Weihenstephaner',  color: '#006064' },
  { id: 'erdinger',         name: 'Erdinger',         color: '#F57F17' },
  { id: 'tegernseer',       name: 'Tegernseer',       color: '#33691E' },
  { id: 'schweiger',        name: 'Schweiger',        color: '#3E2723' },
].map((b) => ({
  ...b,
  svgLogo: generateSvgLogo(b.name, b.color),
}));

export const BEER_MAP = new Map(BEERS.map((b) => [b.id, b]));
