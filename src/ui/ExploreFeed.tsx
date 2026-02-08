import type { FeedItem } from '../domain/types';
import './ExploreFeed.css';

interface Props {
  items: FeedItem[];
  onNavigate: (lat: number, lon: number, zoom: number) => void;
}

export function ExploreFeed({ items, onNavigate }: Props) {
  if (items.length === 0) return null;

  return (
    <div className="explore-feed">
      <h3>Explore</h3>
      {items.map((item) => (
        <div
          key={item.id}
          className="feed-item"
          onClick={() => onNavigate(item.lat, item.lon, item.zoom)}
        >
          <span className="feed-icon">{item.icon}</span>
          <div className="feed-text">
            <div className="feed-title">{item.title}</div>
            <div className="feed-subtitle">{item.subtitle}</div>
          </div>
          <span className={`feed-type-badge ${item.type}`}>
            {item.type === 'battlefront' ? 'Battle' : item.type === 'flip-watch' ? 'Flip' : 'Trend'}
          </span>
          <span className="feed-chevron">{'\u203A'}</span>
        </div>
      ))}
    </div>
  );
}
