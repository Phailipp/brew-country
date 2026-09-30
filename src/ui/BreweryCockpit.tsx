import { useMemo, useState, type CSSProperties } from 'react';
import NumberFlow from '@number-flow/react';
import type { Venue } from '../domain/venues';
import type { VenueStanding } from '../domain/influence';
import { breweryReport, type VenueInsight } from '../domain/breweryInsights';
import { BeerBadge } from './kit/BeerBadge';
import { BeerPicker } from './BeerPicker';
import { beerColor, beerName, pointsLabel } from './kit/beer';
import { VENUE_KIND } from './kit/venueKind';
import { fmtNumber, fmtPercent, intlLocale, percentSuffix, t } from '../i18n';
import './BreweryCockpit.css';

interface Props {
  initialBeerId: string;
  venues: Venue[];
  standings: Map<string, VenueStanding>;
  onOpenVenue: (venue: Venue) => void;
}

function InsightList({ title, hint, items, tone, render, onOpen }: {
  title: string;
  hint: string;
  items: VenueInsight[];
  tone: 'hot' | 'accent' | 'calm';
  render: (i: VenueInsight) => string;
  onOpen: (v: Venue) => void;
}) {
  return (
    <div className={`card cockpit-list tone-${tone}`}>
      <div className="cockpit-list-head">
        <p className="eyebrow">{title}</p>
        <span className="cockpit-count num">{items.length}</span>
      </div>
      <p className="muted">{hint}</p>
      {items.length === 0 ? (
        <p className="cockpit-empty">{t('cockpit.nothing')}</p>
      ) : (
        <ul>
          {items.slice(0, 5).map((i) => (
            <li key={i.venue.id}>
              <button className="cockpit-row" onClick={() => onOpen(i.venue)}>
                <span className="cockpit-row-kind" aria-hidden="true">{VENUE_KIND[i.venue.kind].icon}</span>
                <span className="cockpit-row-main">
                  <span className="cockpit-row-name">{i.venue.name}</span>
                  <span className="cockpit-row-sub">{render(i)}</span>
                </span>
                {i.rivalBeerId && <BeerBadge beerId={i.rivalBeerId} size="sm" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The brewery's control room: share of voice, pubs at risk, pubs to win. */
export function BreweryCockpit({ initialBeerId, venues, standings, onOpenVenue }: Props) {
  const [beerId, setBeerId] = useState(initialBeerId);
  const [picking, setPicking] = useState(false);
  const r = useMemo(() => breweryReport(beerId, venues, standings), [beerId, venues, standings]);
  const totalRuled = r.rivals.reduce((n, x) => n + x.venues, 0) || 1;

  if (venues.length === 0) {
    return (
      <div className="empty">
        <span className="empty-icon" aria-hidden="true">🏭</span>
        <span className="empty-title">{t('cockpit.emptyTitle')}</span>
        <span>{t('cockpit.emptyText')}</span>
      </div>
    );
  }

  return (
    <div className="cockpit stagger">
      <div className="card card-hero cockpit-hero" style={{ '--c-beer': beerColor(beerId) } as CSSProperties}>
        <BeerBadge beerId={beerId} size="lg" />
        <div className="cockpit-hero-text">
          <span className="eyebrow">{t('cockpit.eyebrow')}</span>
          <h3>{beerName(beerId)}</h3>
          <button className="cockpit-switch" onClick={() => setPicking(!picking)} aria-expanded={picking}>
            {picking ? t('common.done') : t('cockpit.switchBrand')}
          </button>
        </div>
      </div>
      {picking && <BeerPicker value={beerId} onChange={setBeerId} layout="carousel" label={t('cockpit.pickerLabel')} />}

      <div className="cockpit-kpis">
        <div className="card cockpit-kpi">
          <span className="num cockpit-kpi-value"><NumberFlow value={r.ruled} locales={intlLocale()} /></span>
          <span className="muted">{t('cockpit.ruled')}</span>
        </div>
        <div className="card cockpit-kpi">
          <span className="num cockpit-kpi-value"><NumberFlow value={Math.round(r.shareOfVoice * 100)} locales={intlLocale()} suffix={percentSuffix()} /></span>
          <span className="muted">{t('cockpit.shareOfVoice')}</span>
        </div>
        <div className="card cockpit-kpi">
          <span className="num cockpit-kpi-value"><NumberFlow value={r.tapped} locales={intlLocale()} /></span>
          <span className="muted">{t('cockpit.tapped')}</span>
        </div>
        <div className="card cockpit-kpi">
          <span className="num cockpit-kpi-value"><NumberFlow value={r.visitPoints} locales={intlLocale()} /></span>
          <span className="muted">{t('cockpit.visitPoints')}</span>
        </div>
      </div>

      <div className="card">
        <p className="eyebrow">{t('cockpit.whoRules')}</p>
        <div className="cockpit-share" role="img" aria-label={t('cockpit.shareLabel')}>
          {r.rivals.map((x) => (
            <span key={x.beerId} style={{ flexGrow: x.venues, background: beerColor(x.beerId) }} className={x.beerId === beerId ? 'is-us' : ''} />
          ))}
        </div>
        <ul className="cockpit-legend">
          {r.rivals.map((x) => (
            <li key={x.beerId} className={x.beerId === beerId ? 'is-us' : ''}>
              <span className="cockpit-dot" style={{ background: beerColor(x.beerId) }} />
              {beerName(x.beerId)} <span className="num muted">{fmtPercent(x.venues / totalRuled)}</span>
            </li>
          ))}
        </ul>
      </div>

      <InsightList
        title={t('cockpit.atRisk')}
        hint={t('cockpit.atRiskHint')}
        items={r.atRisk}
        tone="hot"
        render={(i) => t('cockpit.atRiskRow', { count: i.gap, rival: i.rivalBeerId ? beerName(i.rivalBeerId) : t('cockpit.competition'), points: pointsLabel(i.gap) })}
        onOpen={onOpenVenue}
      />
      <InsightList
        title={t('cockpit.chances')}
        hint={t('cockpit.chancesHint')}
        items={r.opportunities}
        tone="accent"
        render={(i) => (i.rivalBeerId
          ? t('cockpit.chanceRowVs', { points: pointsLabel(i.gap), rival: beerName(i.rivalBeerId) })
          : t('cockpit.chanceRow', { points: pointsLabel(i.gap) }))}
        onOpen={onOpenVenue}
      />
      <InsightList
        title={t('cockpit.sleeping')}
        hint={t('cockpit.sleepingHint')}
        items={r.sleeping}
        tone="calm"
        render={() => t('cockpit.sleepingRow')}
        onOpen={onOpenVenue}
      />

      <p className="muted cockpit-foot">
        {t('cockpit.foot', { count: fmtNumber(r.venuesTotal) })}
      </p>
    </div>
  );
}
