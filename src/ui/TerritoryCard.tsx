import type { CSSProperties } from 'react';
import NumberFlow from '@number-flow/react';
import type { CellResult, Region } from '../domain/types';
import { BeerBadge } from './kit/BeerBadge';
import { beerColor, beerName } from './kit/beer';
import { fmtNumber, fmtPercent, intlLocale, percentSuffix, t, type Key } from '../i18n';
import './TerritoryCard.css';

interface Props {
  cell: CellResult | null;
  region: Region | null;
  isDemo: boolean;
  demoBeerId: string | null;
  onShare: (region: Region) => void;
  onProst: () => void;
  onDemoVote: () => void;
}

function statusOf(cell: CellResult): { label: Key; tone: 'hot' | 'accent' | 'success' } {
  if (cell.margin < 0.08) return { label: 'territory.hardFought', tone: 'hot' };
  if (cell.margin < 0.25) return { label: 'territory.narrowLead', tone: 'accent' };
  return { label: 'territory.firm', tone: 'success' };
}

export function TerritoryCard({ cell, region, isDemo, demoBeerId, onShare, onProst, onDemoVote }: Props) {
  if (!cell || !cell.winnerBeerId || cell.totalCount <= 0) {
    return (
      <div className="empty">
        <span className="empty-icon" aria-hidden="true">🏳️</span>
        <span className="empty-title">{t('territory.noMansLand')}</span>
        <span>{t('territory.noMansText')}</span>
        <button className="btn btn-primary" onClick={onProst}>{t('territory.checkInHere')}</button>
        {isDemo && demoBeerId && (
          <button className="btn btn-ghost" onClick={onDemoVote}>{t('territory.demoVote', { beer: beerName(demoBeerId) })}</button>
        )}
      </div>
    );
  }

  const ranked = Object.entries(cell.voteCounts).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const status = statusOf(cell);
  const leadPct = cell.margin * 100;
  const lead = leadPct < 1 ? t('territory.razorThin') : fmtPercent(Math.round(leadPct) / 100);

  return (
    <div className="territory stagger">
      <div className="card card-hero territory-hero" style={{ '--c-beer': beerColor(cell.winnerBeerId) } as CSSProperties}>
        <BeerBadge beerId={cell.winnerBeerId} size="xl" />
        <div className="territory-hero-text">
          <span className={`chip chip-${status.tone}`}>{t(status.label)}</span>
          <h3 className="territory-winner">{t('territory.rules', { beer: beerName(cell.winnerBeerId) })}</h3>
          <p className="muted">
            {cell.runnerUpBeerId
              ? t('territory.lead', { lead, rival: beerName(cell.runnerUpBeerId) })
              : t('territory.noRival')}
          </p>
        </div>
      </div>

      <div className="card">
        <p className="eyebrow">{t('territory.votingPower')}</p>
        <ul className="territory-bars">
          {ranked.map(([beerId, weight]) => {
            const pct = Math.round((weight / cell.totalCount) * 100);
            return (
              <li key={beerId}>
                <BeerBadge beerId={beerId} size="sm" />
                <span className="territory-bar-name">{beerName(beerId)}</span>
                <span className="territory-bar-track" aria-hidden="true">
                  <span style={{ width: `${pct}%`, background: beerColor(beerId) }} />
                </span>
                <span className="territory-bar-pct num"><NumberFlow value={pct} locales={intlLocale()} suffix={percentSuffix()} /></span>
              </li>
            );
          })}
        </ul>
      </div>

      {region && (
        <div className="card territory-region">
          <div>
            <p className="eyebrow">{t('territory.region')}</p>
            <p className="territory-region-size num">
              {fmtNumber(region.cellCount)} <small>{t('territory.cells')}</small>
            </p>
          </div>
          <button className="btn btn-secondary" onClick={() => onShare(region)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v13M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></svg>
            {t('territory.share')}
          </button>
        </div>
      )}

      <button className="btn btn-primary btn-lg btn-block" onClick={onProst}>
        {t('territory.joinIn')}
      </button>
      {isDemo && demoBeerId && (
        <button className="btn btn-ghost btn-block" onClick={onDemoVote}>
          {t('territory.demoVote', { beer: beerName(demoBeerId) })}
        </button>
      )}
    </div>
  );
}
