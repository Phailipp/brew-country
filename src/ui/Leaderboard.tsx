import NumberFlow from '@number-flow/react';
import { BeerBadge } from './kit/BeerBadge';
import { beerColor, beerName } from './kit/beer';
import { intlLocale, percentSuffix, t } from '../i18n';
import './Leaderboard.css';

export interface LeaderboardEntry {
  beerId: string;
  share: number; // 0..1 of claimed area in view
}

interface Props {
  entries: LeaderboardEntry[];
  ownBeerId: string;
  computing: boolean;
}

export function Leaderboard({ entries, ownBeerId, computing }: Props) {
  const top = entries.slice(0, 6);
  return (
    <section className="section">
      <h2 className="section-title">
        {t('leaderboard.title')} <small>{computing ? t('leaderboard.computing') : t('leaderboard.share')}</small>
      </h2>
      {top.length === 0 ? (
        <div className="empty">
          <span className="empty-icon" aria-hidden="true">🗺️</span>
          <span className="empty-title">{t('leaderboard.emptyTitle')}</span>
          <span>{t('leaderboard.emptyText')}</span>
        </div>
      ) : (
        <ol className="leaderboard stagger">
          {top.map((e, i) => {
            const pct = Math.round(e.share * 100);
            const own = e.beerId === ownBeerId;
            return (
              <li key={e.beerId} className={`lb-row${own ? ' own' : ''}`}>
                <span className={`lb-rank num${i === 0 ? ' first' : ''}`}>{i + 1}</span>
                <BeerBadge beerId={e.beerId} size="sm" />
                <span className="lb-main">
                  <span className="lb-name">
                    {beerName(e.beerId)}
                    {own && <span className="chip chip-accent lb-you">{t('leaderboard.yourBeer')}</span>}
                  </span>
                  <span className="lb-track" aria-hidden="true">
                    <span style={{ width: `${Math.max(2, pct)}%`, background: beerColor(e.beerId) }} />
                  </span>
                </span>
                <span className="lb-pct num"><NumberFlow value={pct} locales={intlLocale()} suffix={percentSuffix()} /></span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
