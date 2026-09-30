import type { FeedItem } from '../domain/types';
import { BeerBadge } from './kit/BeerBadge';
import { beerName } from './kit/beer';
import { fmtPercent, t, type Key } from '../i18n';
import './ExploreFeed.css';

interface Props {
  items: FeedItem[];
  onNavigate: (lat: number, lon: number, zoom: number) => void;
}

const TYPE_LABEL: Record<FeedItem['type'], { label: Key; tone: string }> = {
  battlefront: { label: 'feed.battlefront', tone: 'chip-hot' },
  'flip-watch': { label: 'feed.flipWatch', tone: 'chip-accent' },
  trending: { label: 'feed.trending', tone: 'chip-success' },
};

/** Title and subtitle of a hotspot in the UI language. */
function feedText(item: FeedItem): { title: string; subtitle: string } {
  const { stats } = item;
  switch (item.type) {
    case 'battlefront':
      return {
        title: t('feed.battleTitle', { beer: beerName(item.beerId), rival: item.secondaryBeerId ? beerName(item.secondaryBeerId) : '?' }),
        subtitle: t('feed.battleSub', { margin: fmtPercent((stats.marginPct ?? 0) / 100) }),
      };
    case 'flip-watch':
      return {
        title: t('feed.flipTitle', { beer: beerName(item.beerId) }),
        subtitle: t('feed.flipSub', { recent: stats.recent ?? 0, against: stats.against ?? 0 }),
      };
    case 'trending':
      return {
        title: t('feed.trendTitle', { beer: beerName(item.beerId) }),
        subtitle: t('feed.trendSub', { count: stats.votes ?? 0 }),
      };
  }
}

export function ExploreFeed({ items, onNavigate }: Props) {
  return (
    <section className="section">
      <h2 className="section-title">
        {t('feed.title')} <small>{t('feed.inView')}</small>
      </h2>
      {items.length === 0 ? (
        <div className="empty">
          <span className="empty-icon" aria-hidden="true">🌙</span>
          <span className="empty-title">{t('feed.emptyTitle')}</span>
          <span>{t('feed.emptyText')}</span>
        </div>
      ) : (
        <div className="feed stagger">
          {items.map((item) => {
            const text = feedText(item);
            return (
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
                <span className="row-title">{text.title}</span>
                <span className="row-sub">{text.subtitle}</span>
              </span>
              <span className={`chip ${TYPE_LABEL[item.type].tone}`}>{t(TYPE_LABEL[item.type].label)}</span>
            </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
