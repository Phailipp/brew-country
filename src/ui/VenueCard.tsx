import { useState, type CSSProperties } from 'react';
import NumberFlow from '@number-flow/react';
import type { Venue, MyVisit } from '../domain/venues';
import { CHECKIN_RADIUS_M, visitBlocker } from '../domain/venues';
import { INFLUENCE, regularTier, type VenueStanding } from '../domain/influence';
import { haversineDistanceKm } from '../domain/geo';
import { acquireGpsSamples } from '../domain/gpsVerify';
import { BeerBadge } from './kit/BeerBadge';
import { BeerPicker } from './BeerPicker';
import { nearestCity } from '../domain/worldCities';
import { beerColor, beerName } from './kit/beer';
import { haptic } from './kit/haptics';
import { clink, primeAudio } from './kit/sound';
import { VENUE_KIND } from './kit/venueKind';
import './VenueCard.css';


interface Props {
  venue: Venue;
  standing: VenueStanding;
  myVisits: MyVisit[];
  playerBeerId: string;
  isDemo: boolean;
  onCheckIn: (beerId: string, alcoholFree: boolean) => Promise<void>;
}

type Phase = 'idle' | 'locating' | 'saving';

export function VenueCard({ venue, standing, myVisits, playerBeerId, isDemo, onCheckIn }: Props) {
  const [beerId, setBeerId] = useState(playerBeerId);
  const [alcoholFree, setAlcoholFree] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [choosing, setChoosing] = useState(false);

  const kind = VENUE_KIND[venue.kind];
  const owner = standing.ownerBeerId;
  const top = standing.scores.slice(0, 4);
  const maxPts = Math.max(1, ...top.map((s) => s.points));
  const myDays = new Set(myVisits.filter((v) => v.venueId === venue.id).map((v) => Math.floor(v.createdAt / 86_400_000))).size;
  const tier = regularTier(myDays);
  const blocker = visitBlocker(myVisits, venue.id, Date.now());
  const myBeerRules = owner === beerId;

  const handleCheckIn = async () => {
    setError('');
    primeAudio();
    haptic('light');
    setPhase('locating');
    try {
      if (!isDemo) {
        const pos = await acquireGpsSamples(1).catch(() => {
          throw new Error('Ohne Standort kein Check-in. Erlaube den Standortzugriff und versuch es nochmal.');
        });
        const distM = haversineDistanceKm(pos.lat, pos.lon, venue.lat, venue.lon) * 1000;
        // GPS noise: allow the reported accuracy on top, up to a limit
        if (distM > CHECKIN_RADIUS_M + Math.min(pos.accuracyM, 40)) {
          throw new Error(`Du bist ${Math.round(distM)} m entfernt. Einchecken geht nur vor Ort (max. ${CHECKIN_RADIUS_M} m).`);
        }
      }
      setPhase('saving');
      await onCheckIn(beerId, alcoholFree);
      clink();
      haptic('success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Check-in fehlgeschlagen.');
      haptic('heavy');
    } finally {
      setPhase('idle');
    }
  };

  return (
    <div className="venue stagger">
      <div className="card card-hero venue-hero" style={{ '--c-beer': owner ? beerColor(owner) : 'var(--c-text-3)' } as CSSProperties}>
        {owner ? <BeerBadge beerId={owner} size="xl" /> : <span className="venue-free" aria-hidden="true">🏳️</span>}
        <div className="venue-hero-text">
          <span className="venue-kind">{kind.icon} {kind.label}</span>
          <h3 className="venue-name">{venue.name}</h3>
          <p className="muted">
            {owner
              ? <><strong className="venue-owner">{beerName(owner)}</strong> regiert hier</>
              : 'Noch frei: der erste Besuch holt sie.'}
          </p>
        </div>
      </div>

      <div className="card venue-checkin">
        {error && <p className="venue-error" role="alert">{error}</p>}
        <button
          className="btn btn-primary btn-lg btn-block"
          onClick={handleCheckIn}
          disabled={phase !== 'idle' || !!blocker}
        >
          {phase === 'locating' && <><span className="spinner" aria-hidden="true" /> Standort wird geprüft…</>}
          {phase === 'saving' && <><span className="spinner" aria-hidden="true" /> Zapfe…</>}
          {phase === 'idle' && (blocker ? 'Heute schon erledigt' : `Hier einchecken · +${INFLUENCE.VISIT}${myBeerRules ? ' Verteidigung' : ''}`)}
        </button>
        {!blocker && (
          <button
            className="venue-choice"
            onClick={() => { setChoosing(!choosing); haptic('light'); }}
            aria-expanded={choosing}
          >
            <BeerBadge beerId={beerId} size="sm" />
            <span>mit <strong>{beerName(beerId)}</strong>{alcoholFree ? ' · alkoholfrei' : ''}</span>
            <span className="venue-choice-edit">{choosing ? 'fertig' : 'ändern'}</span>
          </button>
        )}
        {choosing && !blocker && (
          <div className="venue-choose fade-in">
            <BeerPicker value={beerId} onChange={setBeerId} layout="carousel" pinned={[playerBeerId, ...venue.beerIds]} country={nearestCity(venue.lat, venue.lon).country} label="Bier für den Check-in" />
            <div className="settings-row venue-af">
              <span className="row-main">
                <span className="row-title">Alkoholfrei</span>
                <span className="row-sub">Zählt genauso: Es geht um den Besuch.</span>
              </span>
              <button
                role="switch"
                aria-checked={alcoholFree}
                aria-label="Alkoholfrei"
                className={`switch${alcoholFree ? ' on' : ''}`}
                onClick={() => { setAlcoholFree(!alcoholFree); haptic('light'); }}
              >
                <span />
              </button>
            </div>
          </div>
        )}
        <p className="muted venue-hint">
          {blocker ?? (isDemo
            ? 'Demo: Check-in ohne Standortprüfung.'
            : `Nur vor Ort (max. ${CHECKIN_RADIUS_M} m) · 1× pro Kneipe und Tag · max. 3 Kneipen am Tag`)}
        </p>
      </div>

      {top.length > 0 && (
        <div className="card">
          <div className="venue-card-head">
            <p className="eyebrow">Einfluss</p>
            {venue.beerIds.length > 0 && (
              <span className="chip">Ausschank: {venue.beerIds.map(beerName).join(', ')}</span>
            )}
          </div>
          <ul className="venue-bars">
            {top.map((s) => (
              <li key={s.beerId}>
                <BeerBadge beerId={s.beerId} size="sm" />
                <span className="venue-bar-name">{beerName(s.beerId)}</span>
                <span className="venue-bar-track" aria-hidden="true">
                  <span style={{ width: `${(s.points / maxPts) * 100}%`, background: beerColor(s.beerId) }} />
                </span>
                <span className="venue-bar-pts num"><NumberFlow value={s.points} format={{ maximumFractionDigits: 1 }} /></span>
              </li>
            ))}
          </ul>
          {owner && standing.challengerBeerId && standing.toFlip > 0 && (
            <p className="venue-flip">
              <strong>{beerName(standing.challengerBeerId)}</strong> fehlen noch{' '}
              <strong className="num">{standing.toFlip.toLocaleString('de-DE')}</strong> Punkte zur Übernahme.
              Eine Person bringt höchstens {INFLUENCE.PER_PLAYER_CAP}: <em>Übernehmen geht nur als Crew.</em>
            </p>
          )}
        </div>
      )}

      <div className="venue-stats">
        <div className="card venue-stat">
          <span className="num venue-stat-value"><NumberFlow value={standing.visits} /></span>
          <span className="muted">Besuche · 30 Tage</span>
        </div>
        <div className="card venue-stat">
          <span className="num venue-stat-value"><NumberFlow value={standing.regulars} /></span>
          <span className="muted">Stammgäste</span>
        </div>
        <div className="card venue-stat">
          <span className="venue-stat-value">{tier.name ?? '—'}</span>
          <span className="muted">
            {tier.next ? `${myDays}/${tier.next.min} bis ${tier.next.name}` : 'Höchste Stufe'}
          </span>
        </div>
      </div>

    </div>
  );
}
