import { useMemo, useState, type CSSProperties } from 'react';
import NumberFlow from '@number-flow/react';
import type { Venue } from '../domain/venues';
import type { VenueStanding } from '../domain/influence';
import { breweryReport, type VenueInsight } from '../domain/breweryInsights';
import { BeerBadge } from './kit/BeerBadge';
import { BeerPicker } from './BeerPicker';
import { beerColor, beerName, pointsLabel } from './kit/beer';
import { VENUE_KIND } from './kit/venueKind';
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
        <p className="cockpit-empty">Nichts im Moment.</p>
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
        <span className="empty-title">Noch keine Kneipen geladen</span>
        <span>Zoom auf der Karte in ein Viertel. Sobald Kneipen erscheinen, rechnet das Cockpit.</span>
      </div>
    );
  }

  return (
    <div className="cockpit stagger">
      <div className="card card-hero cockpit-hero" style={{ '--c-beer': beerColor(beerId) } as CSSProperties}>
        <BeerBadge beerId={beerId} size="lg" />
        <div className="cockpit-hero-text">
          <span className="eyebrow">Brauerei-Cockpit</span>
          <h3>{beerName(beerId)}</h3>
          <button className="cockpit-switch" onClick={() => setPicking(!picking)} aria-expanded={picking}>
            {picking ? 'fertig' : 'Marke wechseln'}
          </button>
        </div>
      </div>
      {picking && <BeerPicker value={beerId} onChange={setBeerId} layout="carousel" label="Marke für das Cockpit" />}

      <div className="cockpit-kpis">
        <div className="card cockpit-kpi">
          <span className="num cockpit-kpi-value"><NumberFlow value={r.ruled} /></span>
          <span className="muted">Kneipen regiert</span>
        </div>
        <div className="card cockpit-kpi">
          <span className="num cockpit-kpi-value"><NumberFlow value={Math.round(r.shareOfVoice * 100)} suffix=" %" /></span>
          <span className="muted">Share of Voice</span>
        </div>
        <div className="card cockpit-kpi">
          <span className="num cockpit-kpi-value"><NumberFlow value={r.tapped} /></span>
          <span className="muted">Ausschank laut OSM</span>
        </div>
        <div className="card cockpit-kpi">
          <span className="num cockpit-kpi-value"><NumberFlow value={r.visitPoints} /></span>
          <span className="muted">Punkte durch Gäste</span>
        </div>
      </div>

      <div className="card">
        <p className="eyebrow">Wer regiert die Kneipen?</p>
        <div className="cockpit-share" role="img" aria-label="Anteil regierter Kneipen je Marke">
          {r.rivals.map((x) => (
            <span key={x.beerId} style={{ flexGrow: x.venues, background: beerColor(x.beerId) }} className={x.beerId === beerId ? 'is-us' : ''} />
          ))}
        </div>
        <ul className="cockpit-legend">
          {r.rivals.map((x) => (
            <li key={x.beerId} className={x.beerId === beerId ? 'is-us' : ''}>
              <span className="cockpit-dot" style={{ background: beerColor(x.beerId) }} />
              {beerName(x.beerId)} <span className="num muted">{Math.round((x.venues / totalRuled) * 100)} %</span>
            </li>
          ))}
        </ul>
      </div>

      <InsightList
        title="Gefährdet"
        hint="Hier fehlt der Konkurrenz nur noch wenig. Außendienst hinschicken, Aktion vor Ort."
        items={r.atRisk}
        tone="hot"
        render={(i) => `${i.rivalBeerId ? beerName(i.rivalBeerId) : 'Konkurrenz'} ${i.gap === 1 ? 'fehlt' : 'fehlen'} noch ${pointsLabel(i.gap)}`}
        onOpen={onOpenVenue}
      />
      <InsightList
        title="Chancen"
        hint="Mit einem kleinen Schub gehört die Kneipe euch. Ideal für eine Freibier-Quest."
        items={r.opportunities}
        tone="accent"
        render={(i) => `Noch ${pointsLabel(i.gap)}${i.rivalBeerId ? ` gegen ${beerName(i.rivalBeerId)}` : ''}`}
        onOpen={onOpenVenue}
      />
      <InsightList
        title="Ausschank ohne Fans"
        hint="Laut OpenStreetMap wird euer Bier hier gezapft, aber niemand checkt ein. Aktivieren!"
        items={r.sleeping}
        tone="calm"
        render={() => 'Keine Besuche in 30 Tagen'}
        onOpen={onOpenVenue}
      />

      <p className="muted cockpit-foot">
        Basis: {r.venuesTotal.toLocaleString('de-DE')} Kneipen im geladenen Kartenbereich, Besuche der letzten 30 Tage.
        Spielerdaten nur pseudonym. Kneipendaten © OpenStreetMap-Mitwirkende (ODbL).
      </p>
    </div>
  );
}
