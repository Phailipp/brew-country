import { BEERS } from '../domain/beers';
import './BeerPicker.css';

interface Props {
  selectedBeerId: string | null;
  onSelect: (beerId: string) => void;
}

export function BeerPicker({ selectedBeerId, onSelect }: Props) {
  return (
    <div className="beer-picker">
      <h3>Bier ausw&auml;hlen</h3>
      <div className="beer-list">
        {BEERS.map((beer) => (
          <button
            key={beer.id}
            className={`beer-item ${selectedBeerId === beer.id ? 'selected' : ''}`}
            onClick={() => onSelect(beer.id)}
            style={{
              borderColor: selectedBeerId === beer.id ? beer.color : 'transparent',
            }}
          >
            <img src={beer.svgLogo} alt={beer.name} className="beer-logo" />
            <span className="beer-name">{beer.name}</span>
            <span
              className="beer-color-dot"
              style={{ backgroundColor: beer.color }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
