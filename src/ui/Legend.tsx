import { BEERS } from '../domain/beers';
import './Legend.css';

interface Props {
  voteCount: number;
  showSwords: boolean;
}

export function Legend({ voteCount, showSwords }: Props) {
  return (
    <div className="legend">
      <h3>Legende</h3>
      <div className="legend-items">
        {BEERS.map((beer) => (
          <div key={beer.id} className="legend-item">
            <span
              className="legend-swatch"
              style={{ backgroundColor: beer.color, opacity: 0.6 }}
            />
            <img src={beer.svgLogo} alt="" className="legend-logo" />
            <span className="legend-label">{beer.name}</span>
          </div>
        ))}
        <div className="legend-item">
          <span className="legend-swatch" style={{ backgroundColor: '#ccc', opacity: 0.4 }} />
          <span className="legend-label no-data">Keine Daten</span>
        </div>
        {showSwords && (
          <div className="legend-item close-call-item">
            <span className="legend-swatch" style={{ backgroundColor: '#fbbf24', opacity: 0.7 }} />
            <span className="legend-label close-call">&#x2694; Knappes Gebiet</span>
          </div>
        )}
      </div>
      <div className="legend-stats">
        Votes: {voteCount}
      </div>
    </div>
  );
}
