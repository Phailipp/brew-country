import type { SharePayload } from './types';
import { BEER_MAP } from './beers';

/**
 * Encode a share payload into URL query params.
 */
/** Public web address of the app (the iOS app has no web origin of its own). */
function getWebBase(): string {
  const origin = window.location.origin;
  if (origin.startsWith('capacitor') || origin === 'null') {
    return (import.meta.env.VITE_PUBLIC_URL ?? 'https://phailipp.github.io/brew-country').replace(/\/$/, '') + '/';
  }
  return `${origin}${window.location.pathname}`;
}

export function encodeShareLink(payload: SharePayload): string {
  const params = new URLSearchParams();
  params.set('share', '1');
  params.set('rid', payload.regionId);
  params.set('beer', payload.beerId);
  params.set('lat', payload.centroidLat.toFixed(5));
  params.set('lon', payload.centroidLon.toFixed(5));
  params.set('z', payload.zoom.toString());
  return `${getWebBase()}?${params.toString()}`;
}

/**
 * Decode share params from current URL. Returns null if not a share link.
 */
export function decodeShareLink(): SharePayload | null {
  const params = new URLSearchParams(window.location.search);
  if (params.get('share') !== '1') return null;

  const beerId = params.get('beer');
  const latStr = params.get('lat');
  const lonStr = params.get('lon');
  const zStr = params.get('z');
  const rid = params.get('rid');

  if (!beerId || !latStr || !lonStr) return null;
  const lat = Number(latStr);
  const lon = Number(lonStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 85 || Math.abs(lon) > 180) return null;
  const z = zStr ? Number(zStr) : 12;

  const beer = BEER_MAP.get(beerId);

  return {
    regionId: rid ?? '',
    beerId,
    beerName: beer?.name ?? beerId,
    centroidLat: lat,
    centroidLon: lon,
    zoom: Number.isFinite(z) ? Math.min(18, Math.max(2, z)) : 12,
    cellCount: 0,
    totalVotes: 0,
    avgMargin: 0,
    runnerUpName: null,
  };
}

/**
 * Clear share params from URL without reload.
 */
export function clearShareParams(): void {
  const url = new URL(window.location.href);
  url.search = '';
  window.history.replaceState({}, '', url.toString());
}
