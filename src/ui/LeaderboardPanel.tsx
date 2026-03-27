import { useMemo, memo } from 'react';
import type { Region } from '../domain/types';
import { BEER_MAP } from '../domain/beers';
import './LeaderboardPanel.css';

interface Props {
  regions: Region[];
  totalCells: number;
}

interface BeerStats {
  beerId: string;
  regionCount: number;
  cellCount: number;
  totalVotes: number;
  avgMargin: number;
}

export const LeaderboardPanel = memo(function LeaderboardPanel({ regions, totalCells }: Props) {
  const rankings = useMemo<BeerStats[]>(() => {
    const map = new Map<string, BeerStats>();

    for (const r of regions) {
      const existing = map.get(r.beerId);
      if (existing) {
        existing.regionCount += 1;
        existing.cellCount += r.cellCount;
        existing.totalVotes += r.totalVotes;
        existing.avgMargin = (existing.avgMargin * (existing.regionCount - 1) + r.avgMargin) / existing.regionCount;
      } else {
        map.set(r.beerId, {
          beerId: r.beerId,
          regionCount: 1,
          cellCount: r.cellCount,
          totalVotes: r.totalVotes,
          avgMargin: r.avgMargin,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.cellCount - a.cellCount);
  }, [regions]);

  if (rankings.length === 0) {
    return (
      <div className="leaderboard-panel">
        <h3 className="leaderboard-title">Rangliste</h3>
        <p className="leaderboard-empty">Noch keine Daten. Zoomt rein um Regionen zu laden.</p>
      </div>
    );
  }

  const effectiveTotal = totalCells > 0 ? totalCells : rankings.reduce((s, r) => s + r.cellCount, 0);

  return (
    <div className="leaderboard-panel">
      <h3 className="leaderboard-title">Rangliste <span className="leaderboard-subtitle">— Sichtbares Gebiet</span></h3>
      <div className="leaderboard-list">
        {rankings.map((stats, idx) => {
          const beer = BEER_MAP.get(stats.beerId);
          const pct = effectiveTotal > 0 ? (stats.cellCount / effectiveTotal) * 100 : 0;
          const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;

          return (
            <div key={stats.beerId} className={`leaderboard-row${idx === 0 ? ' leader' : ''}`}>
              <span className="lb-rank">
                {medal ?? <span className="lb-rank-num">{idx + 1}</span>}
              </span>

              <div className="lb-beer-info">
                {beer && (
                  <img src={beer.svgLogo} alt={beer.name} className="lb-logo" />
                )}
                <span className="lb-name" style={{ color: beer?.color ?? 'var(--text-100)' }}>
                  {beer?.name ?? stats.beerId}
                </span>
              </div>

              <div className="lb-stats">
                <div className="lb-bar-wrap">
                  <div
                    className="lb-bar-fill"
                    style={{
                      width: `${pct}%`,
                      background: beer?.color ?? 'var(--amber)',
                    }}
                  />
                </div>
                <div className="lb-numbers">
                  <span className="lb-pct">{pct.toFixed(1)}%</span>
                  <span className="lb-cells">{stats.cellCount} Zellen</span>
                  <span className="lb-regions">{stats.regionCount} {stats.regionCount === 1 ? 'Region' : 'Regionen'}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
