import type { CSSProperties } from 'react';
import type { CellResult, Region } from '../domain/types';
import { BeerBadge } from './kit/BeerBadge';
import { beerColor, beerName } from './kit/beer';
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

function statusOf(cell: CellResult): { label: string; tone: 'hot' | 'accent' | 'success' } {
  if (cell.margin < 0.08) return { label: 'Hart umkämpft', tone: 'hot' };
  if (cell.margin < 0.25) return { label: 'Knapp in Führung', tone: 'accent' };
  return { label: 'Fest in der Hand', tone: 'success' };
}

export function TerritoryCard({ cell, region, isDemo, demoBeerId, onShare, onProst, onDemoVote }: Props) {
  if (!cell || !cell.winnerBeerId || cell.totalCount <= 0) {
    return (
      <div className="empty">
        <span className="empty-icon" aria-hidden="true">🏳️</span>
        <span className="empty-title">Niemandsland</span>
        <span>Hier hat noch keine Brauerei das Sagen. Sei die erste Stimme!</span>
        <button className="btn btn-primary" onClick={onProst}>Hier einchecken</button>
        {isDemo && demoBeerId && (
          <button className="btn btn-ghost" onClick={onDemoVote}>Demo: Stimme für {beerName(demoBeerId)} setzen</button>
        )}
      </div>
    );
  }

  const ranked = Object.entries(cell.voteCounts).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const status = statusOf(cell);
  const leadPct = cell.margin * 100;
  const lead = leadPct < 1 ? 'Hauchdünner' : `${Math.round(leadPct)} %`;

  return (
    <div className="territory stagger">
      <div className="card card-hero territory-hero" style={{ '--c-beer': beerColor(cell.winnerBeerId) } as CSSProperties}>
        <BeerBadge beerId={cell.winnerBeerId} size="xl" />
        <div className="territory-hero-text">
          <span className={`chip chip-${status.tone}`}>{status.label}</span>
          <h3 className="territory-winner">{beerName(cell.winnerBeerId)} regiert hier</h3>
          <p className="muted">
            {cell.runnerUpBeerId
              ? <>{lead} Vorsprung vor {beerName(cell.runnerUpBeerId)}</>
              : 'Ohne Konkurrenz – noch.'}
          </p>
        </div>
      </div>

      <div className="card">
        <p className="eyebrow">Stimmkraft vor Ort</p>
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
                <span className="territory-bar-pct num">{pct}&nbsp;%</span>
              </li>
            );
          })}
        </ul>
      </div>

      {region && (
        <div className="card territory-region">
          <div>
            <p className="eyebrow">Territorium</p>
            <p className="territory-region-size num">
              {region.cellCount.toLocaleString('de-DE')} <small>Felder</small>
            </p>
          </div>
          <button className="btn btn-secondary" onClick={() => onShare(region)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v13M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></svg>
            Teilen
          </button>
        </div>
      )}

      <button className="btn btn-primary btn-lg btn-block" onClick={onProst}>
        Hier einchecken &amp; mitmischen
      </button>
      {isDemo && demoBeerId && (
        <button className="btn btn-ghost btn-block" onClick={onDemoVote}>
          Demo: Stimme für {beerName(demoBeerId)} setzen
        </button>
      )}
    </div>
  );
}
