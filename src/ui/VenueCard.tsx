import { useState, type CSSProperties } from 'react';
import NumberFlow from '@number-flow/react';
import type { Venue, MyVisit } from '../domain/venues';
import { CHECKIN_RADIUS_M, MAX_VISITS_PER_DAY, visitBlocker } from '../domain/venues';
import { INFLUENCE, regularTier, type VenueStanding } from '../domain/influence';
import { haversineDistanceKm } from '../domain/geo';
import { acquireGpsSamples } from '../domain/gpsVerify';
import { BeerBadge } from './kit/BeerBadge';
import { BeerPicker } from './BeerPicker';
import { nearestCity } from '../domain/worldCities';
import { beerColor, beerName, pointsLabel } from './kit/beer';
import { haptic } from './kit/haptics';
import { clink, primeAudio } from './kit/sound';
import { VENUE_KIND, venueKindLabel } from './kit/venueKind';
import { intlLocale, t, tr } from '../i18n';
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

  const kindIcon = VENUE_KIND[venue.kind].icon;
  const owner = standing.ownerBeerId;
  const top = standing.scores.slice(0, 4);
  const maxPts = Math.max(1, ...top.map((s) => s.points));
  const myDays = new Set(myVisits.filter((v) => v.venueId === venue.id).map((v) => Math.floor(v.createdAt / 86_400_000))).size;
  const tier = regularTier(myDays);
  const blocker = visitBlocker(myVisits, venue.id, Date.now());
  const blockerText = blocker === 'already-today' ? t('venue.alreadyToday')
    : blocker === 'daily-limit' ? t('venue.dailyLimit', { max: MAX_VISITS_PER_DAY })
      : null;
  const myBeerRules = owner === beerId;

  const handleCheckIn = async () => {
    setError('');
    primeAudio();
    haptic('light');
    setPhase('locating');
    try {
      if (!isDemo) {
        const pos = await acquireGpsSamples(1).catch(() => {
          throw new Error(t('venue.noLocation'));
        });
        const distM = haversineDistanceKm(pos.lat, pos.lon, venue.lat, venue.lon) * 1000;
        // GPS noise: allow the reported accuracy on top, up to a limit
        if (distM > CHECKIN_RADIUS_M + Math.min(pos.accuracyM, 40)) {
          throw new Error(t('venue.tooFar', { distance: Math.round(distM), radius: CHECKIN_RADIUS_M }));
        }
      }
      setPhase('saving');
      await onCheckIn(beerId, alcoholFree);
      clink();
      haptic('success');
    } catch (e) {
      const code = (e as { code?: string }).code;
      setError(code === 'already-today' ? t('venue.alreadyToday')
        : code === 'daily-limit' ? t('venue.dailyLimit', { max: MAX_VISITS_PER_DAY })
          // own location errors carry a translated message; technical errors (with a code) do not
          : e instanceof Error && !code ? e.message : t('venue.failed'));
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
          <span className="venue-kind">{kindIcon} {venueKindLabel(venue.kind)}</span>
          <h3 className="venue-name">{venue.name}</h3>
          <p className="muted">
            {owner
              ? tr('venue.rulesHere', { beer: <strong className="venue-owner">{beerName(owner)}</strong> })
              : t('venue.free')}
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
          {phase === 'locating' && <><span className="spinner" aria-hidden="true" /> {t('venue.locating')}</>}
          {phase === 'saving' && <><span className="spinner" aria-hidden="true" /> {t('venue.saving')}</>}
          {phase === 'idle' && (blocker ? t('venue.doneToday') : t(myBeerRules ? 'venue.checkInDefend' : 'venue.checkIn', { points: INFLUENCE.VISIT }))}
        </button>
        {!blocker && (
          <button
            className="venue-choice"
            onClick={() => { setChoosing(!choosing); haptic('light'); }}
            aria-expanded={choosing}
          >
            <BeerBadge beerId={beerId} size="sm" />
            <span>{tr('venue.withBeer', { beer: <strong>{beerName(beerId)}</strong> })}{alcoholFree ? t('venue.alcoholFreeSuffix') : ''}</span>
            <span className="venue-choice-edit">{choosing ? t('common.done') : t('common.change')}</span>
          </button>
        )}
        {choosing && !blocker && (
          <div className="venue-choose fade-in">
            <BeerPicker value={beerId} onChange={setBeerId} layout="carousel" pinned={[playerBeerId, ...venue.beerIds]} country={nearestCity(venue.lat, venue.lon).country} label={t('venue.pickerLabel')} />
            <div className="settings-row venue-af">
              <span className="row-main">
                <span className="row-title">{t('common.alcoholFree')}</span>
                <span className="row-sub">{t('venue.afSub')}</span>
              </span>
              <button
                role="switch"
                aria-checked={alcoholFree}
                aria-label={t('common.alcoholFree')}
                className={`switch${alcoholFree ? ' on' : ''}`}
                onClick={() => { setAlcoholFree(!alcoholFree); haptic('light'); }}
              >
                <span />
              </button>
            </div>
          </div>
        )}
        <p className="muted venue-hint">
          {blockerText ?? (isDemo
            ? t('venue.demoHint')
            : t('venue.rulesHint', { radius: CHECKIN_RADIUS_M, max: MAX_VISITS_PER_DAY }))}
        </p>
      </div>

      {top.length > 0 && (
        <div className="card">
          <div className="venue-card-head">
            <p className="eyebrow">{t('venue.influence')}</p>
            {venue.beerIds.length > 0 && (
              <span className="chip">{t('venue.onTap', { beers: venue.beerIds.map(beerName).join(', ') })}</span>
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
                <span className="venue-bar-pts num"><NumberFlow value={s.points} locales={intlLocale()} format={{ maximumFractionDigits: 1 }} /></span>
              </li>
            ))}
          </ul>
          {owner && standing.challengerBeerId && standing.toFlip > 0 && (
            <p className="venue-flip">
              {tr('venue.flip', {
                count: standing.toFlip,
                beer: <strong>{beerName(standing.challengerBeerId)}</strong>,
                points: <strong className="num">{pointsLabel(standing.toFlip)}</strong>,
              })}{' '}
              {tr('venue.flipCap', { cap: INFLUENCE.PER_PLAYER_CAP, crew: <em>{t('venue.crewOnly')}</em> })}
            </p>
          )}
        </div>
      )}

      <div className="venue-stats">
        <div className="card venue-stat">
          <span className="num venue-stat-value"><NumberFlow value={standing.visits} locales={intlLocale()} /></span>
          <span className="muted">{t('venue.visits30')}</span>
        </div>
        <div className="card venue-stat">
          <span className="num venue-stat-value"><NumberFlow value={standing.regulars} locales={intlLocale()} /></span>
          <span className="muted">{t('venue.regulars')}</span>
        </div>
        <div className="card venue-stat">
          <span className="venue-stat-value">{tier.tier ? t(`venue.tier.${tier.tier}`) : '—'}</span>
          <span className="muted">
            {tier.next ? t('venue.tierProgress', { days: myDays, min: tier.next.min, tier: t(`venue.tier.${tier.next.tier}`) }) : t('venue.topTier')}
          </span>
        </div>
      </div>

      <p className="muted venue-osm">
        {tr('venue.osm', { link: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">{t('common.osmContributors')}</a> })}
      </p>
    </div>
  );
}
