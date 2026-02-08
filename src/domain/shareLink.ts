import type { SharePayload } from './types';
import { BEER_MAP } from './beers';

/**
 * Encode a share payload into URL query params.
 */
function getWebOrigin(): string {
  const origin = window.location.origin;
  // In Capacitor iOS, origin is capacitor://localhost — use a web fallback
  if (origin.startsWith('capacitor') || origin === 'null') {
    return 'https://brewcountry.app';
  }
  return origin;
}

export function encodeShareLink(payload: SharePayload): string {
  const params = new URLSearchParams();
  params.set('share', '1');
  params.set('rid', payload.regionId);
  params.set('beer', payload.beerId);
  params.set('lat', payload.centroidLat.toFixed(5));
  params.set('lon', payload.centroidLon.toFixed(5));
  params.set('z', payload.zoom.toString());
  return `${getWebOrigin()}${window.location.pathname}?${params.toString()}`;
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

  const beer = BEER_MAP.get(beerId);

  return {
    regionId: rid ?? '',
    beerId,
    beerName: beer?.name ?? beerId,
    centroidLat: parseFloat(latStr),
    centroidLon: parseFloat(lonStr),
    zoom: zStr ? parseInt(zStr, 10) : 12,
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
