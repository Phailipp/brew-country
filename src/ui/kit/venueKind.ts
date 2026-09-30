import type { Venue } from '../../domain/venues';
import { t } from '../../i18n';

export const VENUE_KIND: Record<Venue['kind'], { icon: string }> = {
  pub: { icon: '🍺' },
  bar: { icon: '🍸' },
  biergarten: { icon: '🌳' },
  brewery: { icon: '🏭' },
  restaurant: { icon: '🍽️' },
};

/** "Kneipe", "Biergarten", … in the UI language. */
export function venueKindLabel(kind: Venue['kind']): string {
  return t(`venue.kind.${kind}`);
}
