import type { Venue } from '../../domain/venues';

export const VENUE_KIND: Record<Venue['kind'], { icon: string; label: string }> = {
  pub: { icon: '🍺', label: 'Kneipe' },
  bar: { icon: '🍸', label: 'Bar' },
  biergarten: { icon: '🌳', label: 'Biergarten' },
  brewery: { icon: '🏭', label: 'Brauerei' },
  restaurant: { icon: '🍽️', label: 'Wirtshaus' },
};
