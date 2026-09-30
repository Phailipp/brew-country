import { useSyncExternalStore } from 'react';
import { beerCatalogVersion, subscribeBeerCatalog } from '../../domain/beers';

/** Re-render when approved community beers are added to the catalogue. */
export function useBeerCatalog(): number {
  return useSyncExternalStore(subscribeBeerCatalog, beerCatalogVersion, beerCatalogVersion);
}
