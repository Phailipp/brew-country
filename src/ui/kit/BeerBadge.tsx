import type { CSSProperties } from 'react';
import { BEER_MAP } from '../../domain/beers';

interface Props {
  beerId: string | null | undefined;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

/**
 * Round brewery crest. Brand logos sit on a cream plate with a ring in the
 * beer colour; without a logo the generated monogram crest is shown.
 * Decorative — pair it with the beer name in text.
 */
export function BeerBadge({ beerId, size = 'md', className = '' }: Props) {
  const beer = beerId ? BEER_MAP.get(beerId) : undefined;
  const hasLogo = !!beer?.logoUrl;
  const style = {
    backgroundImage: beer ? `url("${hasLogo ? beer.logoUrl : beer.svgLogo}")` : undefined,
    backgroundColor: beer ? undefined : 'var(--c-surface-3)',
    '--badge-color': beer?.color,
  } as CSSProperties;
  return (
    <span
      className={`beer-badge ${size === 'md' ? '' : size} ${hasLogo ? 'has-logo' : ''} ${className}`.replace(/\s+/g, ' ').trim()}
      style={style}
      aria-hidden="true"
    />
  );
}
