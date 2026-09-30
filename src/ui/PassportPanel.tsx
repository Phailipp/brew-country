import { useMemo, useState, type CSSProperties } from 'react';
import NumberFlow from '@number-flow/react';
import type { MyVisit } from '../domain/venues';
import { playerPassport, regularTier } from '../domain/influence';
import { BeerBadge } from './kit/BeerBadge';
import { beerColor, beerName } from './kit/beer';
import './PassportPanel.css';

interface Props {
  visits: MyVisit[];
  onLocate: (venueId: string) => void;
}

/** The player's beer passport: one coaster per venue, streaks and stats. */
export function PassportPanel({ visits, onLocate }: Props) {
  const [now] = useState(() => Date.now());
  const passport = useMemo(() => playerPassport(visits, now), [visits, now]);
  const names = useMemo(() => new Map(visits.map((v) => [v.venueId, v.venueName])), [visits]);

  return (
    <section className="section passport">
      <h2 className="section-title">Dein Bierpass</h2>

      <div className="passport-stats">
        <div className="card passport-stat">
          <span className="num passport-stat-value"><NumberFlow value={passport.coasters.length} /></span>
          <span className="muted">Bierdeckel</span>
        </div>
        <div className="card passport-stat">
          <span className="num passport-stat-value"><NumberFlow value={passport.beers} /></span>
          <span className="muted">Biere</span>
        </div>
        <div className={`card passport-stat${passport.weeklyStreak > 0 ? ' is-hot' : ''}`}>
          <span className="num passport-stat-value">
            {passport.weeklyStreak > 0 && <span aria-hidden="true">🔥</span>}
            <NumberFlow value={passport.weeklyStreak} />
          </span>
          <span className="muted">Wochen-Serie</span>
        </div>
      </div>

      {passport.coasters.length === 0 ? (
        <div className="empty">
          <span className="empty-icon" aria-hidden="true">🍺</span>
          <span className="empty-title">Noch keine Bierdeckel</span>
          <span>Tipp auf eine Kneipe auf der Karte und check vor Ort ein. Jede neue Kneipe bringt einen Bierdeckel.</span>
        </div>
      ) : (
        <ul className="coasters" aria-label="Bierdeckel-Sammlung">
          {passport.coasters.map((c) => {
            const tier = regularTier(c.days).name;
            return (
              <li key={c.venueId}>
                <button
                  className="coaster"
                  style={{ '--coaster': beerColor(c.beerId) } as CSSProperties}
                  onClick={() => onLocate(c.venueId)}
                  aria-label={`${names.get(c.venueId) ?? 'Kneipe'}, ${beerName(c.beerId)}, ${c.days} Besuche`}
                >
                  <span className="coaster-disc">
                    <BeerBadge beerId={c.beerId} size="sm" />
                  </span>
                  <span className="coaster-name">{names.get(c.venueId) ?? 'Kneipe'}</span>
                  <span className="coaster-meta">{tier}{c.days > 1 ? ` · ${c.days}×` : ''}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {passport.alcoholFreeVisits > 0 && (
        <p className="muted passport-af">
          Davon {passport.alcoholFreeVisits} × alkoholfrei. Zählt genauso.
        </p>
      )}
    </section>
  );
}
