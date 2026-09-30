import { useCallback, useEffect, useState } from 'react';
import type { Venue } from '../domain/venues';
import type { VenueStanding } from '../domain/influence';
import { BeerBadge } from './kit/BeerBadge';
import { beerName } from './kit/beer';
import { haptic } from './kit/haptics';
import { VENUE_KIND } from './kit/venueKind';
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
        <p className="finder-status" role="status">Wir suchen Kneipen um dich herum…</p>
      </div>
    );
  }

  const { result } = state;
  if (!result.ok) {
    return (
      <div className="empty">
        <span className="empty-icon" aria-hidden="true">{result.reason === 'no-location' ? '📍' : '📡'}</span>
        <span className="empty-title">
          {result.reason === 'no-location' ? 'Standort nicht verfügbar' : 'Kneipen gerade nicht erreichbar'}
        </span>
        <span>
          {result.reason === 'no-location'
            ? 'Erlaube den Standortzugriff in den Einstellungen. Einchecken geht nur vor Ort.'
            : 'Die Kneipendaten kommen von OpenStreetMap. Versuch es gleich noch einmal.'}
        </span>
        <button className="btn btn-primary" onClick={run}>Nochmal suchen</button>
      </div>
    );
  }

  if (result.nearby.length === 0) {
    return (
      <div className="empty">
        <span className="empty-icon" aria-hidden="true">🍺</span>
        <span className="empty-title">Keine Kneipe in Reichweite</span>
        <span>
          Einchecken geht nur direkt vor Ort. Fehlt deine Kneipe? Trag sie auf{' '}
          <a href="https://www.openstreetmap.org" target="_blank" rel="noopener noreferrer">openstreetmap.org</a> ein,
          dann taucht sie hier auf.
        </span>
        <button className="btn btn-secondary" onClick={run}>Nochmal suchen</button>
      </div>
    );
  }

  return (
    <div className="finder">
      <p className="finder-lede">In welcher Kneipe bist du?</p>
      <ul className="finder-list" aria-label="Kneipen in deiner Nähe">
        {result.nearby.map(({ venue, distance }) => {
          const owner = standings.get(venue.id)?.ownerBeerId ?? null;
          return (
            <li key={venue.id}>
              <button className="card finder-row" onClick={() => { haptic('light'); onOpen(venue); }}>
                <span className="finder-kind" aria-hidden="true">{VENUE_KIND[venue.kind].icon}</span>
                <span className="finder-main">
                  <span className="finder-name">{venue.name}</span>
                  <span className="finder-sub">
                    {Math.round(distance)} m · {owner ? `${beerName(owner)} regiert` : 'noch frei'}
                  </span>
                </span>
                {owner && <BeerBadge beerId={owner} size="sm" />}
                <span className="finder-go" aria-hidden="true">›</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="muted finder-hint">Trink verantwortungsvoll. Alkoholfrei zählt genauso.</p>
    </div>
  );
}
