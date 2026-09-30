import { useCallback, useEffect, useState } from 'react';
import type { Venue } from '../domain/venues';
import type { VenueStanding } from '../domain/influence';
import { BeerBadge } from './kit/BeerBadge';
import { beerName } from './kit/beer';
import { haptic } from './kit/haptics';
import { VENUE_KIND } from './kit/venueKind';
import { t, tr } from '../i18n';
import './PubFinder.css';

export interface NearbyVenue {
  venue: Venue;
  /** Distance in metres */
  distance: number;
}

export type LocateResult =
  | { ok: true; nearby: NearbyVenue[] }
  | { ok: false; reason: 'no-location' | 'network' };

interface Props {
  locate: () => Promise<LocateResult>;
  standings: Map<string, VenueStanding>;
  onOpen: (venue: Venue) => void;
}

type State = { phase: 'locating' } | { phase: 'done'; result: LocateResult };

/**
 * "Prost!" = I'm in a pub. Finds the pubs around the player and lets them pick
 * (GPS is often 20–50 m off between old-town houses, so we never auto-pick).
 */
export function PubFinder({ locate, standings, onOpen }: Props) {
  const [state, setState] = useState<State>({ phase: 'locating' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    locate()
      .then((result) => { if (alive) setState({ phase: 'done', result }); })
      .catch(() => { if (alive) setState({ phase: 'done', result: { ok: false, reason: 'network' } }); });
    return () => { alive = false; };
  }, [locate, attempt]);

  const run = useCallback(() => {
    setState({ phase: 'locating' });
    setAttempt((n) => n + 1);
  }, []);

  if (state.phase === 'locating') {
    return (
      <div className="finder">
        <div className="finder-radar" aria-hidden="true"><span /><span /><span /></div>
        <p className="finder-status" role="status">{t('finder.searching')}</p>
      </div>
    );
  }

  const { result } = state;
  if (!result.ok) {
    return (
      <div className="empty">
        <span className="empty-icon" aria-hidden="true">{result.reason === 'no-location' ? '📍' : '📡'}</span>
        <span className="empty-title">
          {result.reason === 'no-location' ? t('finder.noLocationTitle') : t('finder.networkTitle')}
        </span>
        <span>
          {result.reason === 'no-location' ? t('finder.noLocationText') : t('finder.networkText')}
        </span>
        <button className="btn btn-primary" onClick={run}>{t('finder.retry')}</button>
      </div>
    );
  }

  if (result.nearby.length === 0) {
    return (
      <div className="empty">
        <span className="empty-icon" aria-hidden="true">🍺</span>
        <span className="empty-title">{t('finder.noneTitle')}</span>
        <span>
          {tr('finder.noneText', { osm: <a href="https://www.openstreetmap.org" target="_blank" rel="noopener noreferrer">openstreetmap.org</a> })}
        </span>
        <button className="btn btn-secondary" onClick={run}>{t('finder.retry')}</button>
      </div>
    );
  }

  return (
    <div className="finder">
      <p className="finder-lede">{t('finder.lede')}</p>
      <ul className="finder-list" aria-label={t('finder.listLabel')}>
        {result.nearby.map(({ venue, distance }) => {
          const owner = standings.get(venue.id)?.ownerBeerId ?? null;
          return (
            <li key={venue.id}>
              <button className="card finder-row" onClick={() => { haptic('light'); onOpen(venue); }}>
                <span className="finder-kind" aria-hidden="true">{VENUE_KIND[venue.kind].icon}</span>
                <span className="finder-main">
                  <span className="finder-name">{venue.name}</span>
                  <span className="finder-sub">
                    {t('finder.distance', { distance: Math.round(distance) })} · {owner ? t('finder.rules', { beer: beerName(owner) }) : t('finder.free')}
                  </span>
                </span>
                {owner && <BeerBadge beerId={owner} size="sm" />}
                <span className="finder-go" aria-hidden="true">›</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="muted finder-hint">{t('finder.hint')}</p>
    </div>
  );
}
