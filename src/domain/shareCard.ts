import type { SharePayload } from './types';
import { BEER_MAP } from './beers';

/** Texts on the card, already in the UI language. */
export interface ShareCardText {
  subtitle: string;
  stats: string;
  rival: string | null;
}

/**
 * Generate a 1200x630 share card as a PNG data URL.
 */
export function generateShareCard(payload: SharePayload, text: ShareCardText): string {
  const W = 1200;
  const H = 630;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const beer = BEER_MAP.get(payload.beerId);
  const color = beer?.color ?? '#3b82f6';

  // Background
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, W, H);

  // Accent bar
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, 8);

  // Large circle accent
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(W - 200, H / 2, 300, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Title
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 56px system-ui, -apple-system, sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText('Brew Country', 60, 50);

  // Subtitle
  ctx.fillStyle = '#94a3b8';
  ctx.font = '24px system-ui, -apple-system, sans-serif';
  ctx.fillText(text.subtitle, 60, 120);

  // Beer name
  ctx.fillStyle = color;
  ctx.font = 'bold 72px system-ui, -apple-system, sans-serif';
  ctx.fillText(payload.beerName, 60, 200);

  // Stats
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '32px system-ui, -apple-system, sans-serif';
  ctx.fillText(text.stats, 60, 310);

  // Runner-up info
  if (text.rival) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '28px system-ui, -apple-system, sans-serif';
    ctx.fillText(text.rival, 60, 370);
  }

  // Coordinates
  ctx.fillStyle = '#64748b';
  ctx.font = '22px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    `${payload.centroidLat.toFixed(4)}\u00B0N, ${payload.centroidLon.toFixed(4)}\u00B0E`,
    60,
    H - 80
  );

  // Watermark
  ctx.fillStyle = '#475569';
  ctx.font = '18px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('brewcountry.app', W - 60, H - 40);

  return canvas.toDataURL('image/png');
}

/**
 * Download the share card as a file.
 */
export function downloadShareCard(payload: SharePayload, text: ShareCardText): void {
  const dataUrl = generateShareCard(payload, text);
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `brewcountry-${payload.beerId}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
