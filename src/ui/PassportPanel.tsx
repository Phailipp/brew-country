import { useMemo, useState, type CSSProperties } from 'react';
import NumberFlow from '@number-flow/react';
import type { MyVisit } from '../domain/venues';
import { playerPassport, regularTier } from '../domain/influence';
import { BeerBadge } from './kit/BeerBadge';
import { beerColor, beerName } from './kit/beer';
import { intlLocale, t } from '../i18n';
import { HOWTO_HASH } from '../legal/docs';
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
      <h2 className="section-title">{t('passport.title')}</h2>

      <div className="passport-stats">
        <div className="card passport-stat">
          <span className="num passport-stat-value"><NumberFlow value={passport.coasters.length} locales={intlLocale()} /></span>
          <span className="muted">{t('passport.coasters')}</span>
        </div>
        <div className="card passport-stat">
          <span className="num passport-stat-value"><NumberFlow value={passport.beers} locales={intlLocale()} /></span>
          <span className="muted">{t('passport.beers')}</span>
        </div>
        <div className={`card passport-stat${passport.weeklyStreak > 0 ? ' is-hot' : ''}`}>
          <span className="num passport-stat-value">
            {passport.weeklyStreak > 0 && <span aria-hidden="true">🔥</span>}
            <NumberFlow value={passport.weeklyStreak} locales={intlLocale()} />
          </span>
          <span className="muted">{t('passport.streak')}</span>
        </div>
      </div>

      {passport.coasters.length === 0 ? (
        <div className="empty">
          <span className="empty-icon" aria-hidden="true">🍺</span>
          <span className="empty-title">{t('passport.emptyTitle')}</span>
          <span>{t('passport.emptyText')}</span>
          <a className="passport-howto" href={HOWTO_HASH}>{t('howto.link')}</a>
        </div>
      ) : (
        <ul className="coasters" aria-label={t('passport.listLabel')}>
          {passport.coasters.map((c) => {
            const tierId = regularTier(c.days).tier;
            const tier = tierId ? t(`venue.tier.${tierId}`) : '';
            const venueName = names.get(c.venueId) ?? t('passport.venueFallback');
            return (
              <li key={c.venueId}>
                <button
                  className="coaster"
                  style={{ '--coaster': beerColor(c.beerId) } as CSSProperties}
                  onClick={() => onLocate(c.venueId)}
                  aria-label={t('passport.coasterLabel', { venue: venueName, beer: beerName(c.beerId), count: c.days })}
                >
                  <span className="coaster-disc">
                    <BeerBadge beerId={c.beerId} size="sm" />
                  </span>
                  <span className="coaster-name">{venueName}</span>
                  <span className="coaster-meta">{tier}{c.days > 1 ? ` · ${c.days}×` : ''}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {passport.alcoholFreeVisits > 0 && (
        <p className="muted passport-af">
          {t('passport.afNote', { count: passport.alcoholFreeVisits })}
        </p>
      )}
    </section>
  );
}
