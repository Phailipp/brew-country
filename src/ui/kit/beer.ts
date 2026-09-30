import { BEER_MAP } from '../../domain/beers';
import { t } from '../../i18n';

export function beerName(beerId: string | null | undefined): string {
  return (beerId && BEER_MAP.get(beerId)?.name) || t('common.unknown');
}

export function beerColor(beerId: string | null | undefined): string {
  return (beerId && BEER_MAP.get(beerId)?.color) || '#a39580';
}

/** "1 Punkt" / "2,5 Punkte" · "1 point" / "2.5 points" */
export function pointsLabel(n: number): string {
  return t('common.points', { count: n });
}
