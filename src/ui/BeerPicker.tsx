import { useMemo, useState, type CSSProperties } from 'react';
import { countryFlag } from '../domain/countries';
import { localeCountry } from '../domain/worldCities';
import { searchBeers } from '../domain/beers';
import { BeerBadge } from './kit/BeerBadge';
import { useBeerCatalog } from './kit/useBeerCatalog';
import { haptic } from './kit/haptics';
import { t } from '../i18n';
import './BeerPicker.css';

interface Props {
  value: string | null;
  onChange: (beerId: string) => void;
  /** 'grid' = wrapping tiles (onboarding), 'carousel' = one scrollable row (check-in) */
  layout?: 'grid' | 'carousel';
  /** Beer ids pinned to the front (e.g. the player's own beer). */
  pinned?: string[];
  onSuggest?: () => void;
  disabled?: boolean;
  label?: string;
  /** Country whose beers come first (default: the browser locale's). */
  country?: string | null;
}


export function BeerPicker({ value, onChange, layout = 'grid', pinned = [], onSuggest, disabled, label = t('picker.label'), country }: Props) {
  const catalogVersion = useBeerCatalog();
  const [query, setQuery] = useState('');

  const beers = useMemo(() => {
    const list = searchBeers(query, country ?? localeCountry());
    if (query) return list;
    const pins = pinned.map((id) => list.find((b) => b.id === id)).filter((b) => b !== undefined);
    return [...pins, ...list.filter((b) => !pinned.includes(b.id))];
    // catalogVersion: re-run when community beers arrive
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, pinned.join(','), catalogVersion, country]);

  return (
    <div className={`bp bp-${layout}`}>
      <div className="bp-search">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('picker.placeholder')}
          aria-label={t('picker.search')}
          disabled={disabled}
        />
      </div>

      <div className="bp-list" role="radiogroup" aria-label={label}>
        {beers.map((beer) => {
          const selected = value === beer.id;
          return (
            <button
              key={beer.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`bp-item${selected ? ' selected' : ''}`}
              style={{ '--beer': beer.color } as CSSProperties}
              onClick={() => { onChange(beer.id); haptic('light'); }}
              disabled={disabled}
              title={beer.brewery ? `${beer.name} · ${beer.brewery}, ${beer.city}` : beer.name}
            >
              <BeerBadge beerId={beer.id} size="lg" />
              <span className="bp-name">{beer.name}</span>
              {layout === 'grid' && beer.city && (
                <span className="bp-city">{countryFlag(beer.country)} {beer.city}</span>
              )}
            </button>
          );
        })}
        {beers.length === 0 && (
          <div className="bp-empty">
            <span>{t('picker.noMatch', { query })}</span>
          </div>
        )}
      </div>

      {onSuggest && (
        <button type="button" className="bp-suggest" onClick={onSuggest}>
          <span aria-hidden="true">＋</span> {t('picker.suggest')}
        </button>
      )}
    </div>
  );
}
