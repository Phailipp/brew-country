import { BEER_MAP } from '../../domain/beers';

export function beerName(beerId: string | null | undefined): string {
  return (beerId && BEER_MAP.get(beerId)?.name) || 'Unbekannt';
}

export function beerColor(beerId: string | null | undefined): string {
  return (beerId && BEER_MAP.get(beerId)?.color) || '#a39580';
}
