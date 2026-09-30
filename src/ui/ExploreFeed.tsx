import type { FeedItem } from '../domain/types';
import { BeerBadge } from './kit/BeerBadge';
import './ExploreFeed.css';

interface Props {
  items: FeedItem[];
  onNavigate: (lat: number, lon: number, zoom: number) => void;
}

const TYPE_LABEL: Record<FeedItem['type'], { label: string; tone: string }> = {
  battlefront: { label: 'Frontlinie', tone: 'chip-hot' },
  'flip-watch': { label: 'Kippt gleich', tone: 'chip-accent' },
  trending: { label: 'Im Trend', tone: 'chip-success' },
};

export function ExploreFeed({ items, onNavigate }: Props) {
  return (
    <section className="section">
      <h2 className="section-title">
        Brennpunkte <small>in deiner Ansicht</small>
      </h2>
      {items.length === 0 ? (
        <div className="empty">
          <span className="empty-icon" aria-hidden="true">🌙</span>
          <span className="empty-title">Ruhige Lage</span>
          <span>Gerade wird hier nicht gekämpft. Zieh die Karte woanders hin – oder starte selbst was.</span>
        </div>
      ) : (
        <div className="feed stagger">
          {items.map((item) => (
            <button
              key={item.id}
              className="row feed-row"
              onClick={() => onNavigate(item.lat, item.lon, item.zoom)}
            >
              <span className="feed-badges" aria-hidden="true">
                <BeerBadge beerId={item.beerId} size="sm" />
                {item.secondaryBeerId && <BeerBadge beerId={item.secondaryBeerId} size="sm" className="feed-badge-2" />}
              </span>
              <span className="row-main">
                <span className="row-title">{item.title}</span>
                <span className="row-sub">{item.subtitle}</span>
              </span>
              <span className={`chip ${TYPE_LABEL[item.type].tone}`}>{TYPE_LABEL[item.type].label}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
