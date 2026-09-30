import { useState, useCallback, useEffect } from 'react';
import type { User, DrinkVote } from '../domain/types';
import type { StorageInterface } from '../storage/StorageInterface';
import { GAME } from '../config/constants';
import { getNow } from '../domain/clock';
import { roundToPlaceKey } from '../domain/placeKey';
import { validateDrinkVote, getDailyDrinkCount } from '../domain/drinkVoteRules';
import { acquireGpsSamples } from '../domain/gpsVerify';
import { BeerPicker } from './BeerPicker';
import { nearestCity } from '../domain/worldCities';
import { SuggestBeerDialog } from './SuggestBeerDialog';
import { appEvents } from '../domain/events';
import { beerName } from './kit/beer';
import { haptic } from './kit/haptics';
import { clink, primeAudio } from './kit/sound';
import './ProstPanel.css';

interface Props {
  user: User;
  store: StorageInterface;
  onCheckedIn: (vote: DrinkVote) => void;
  /**
   * Demo sandbox only: check in at this point (the map centre) when the
   * device has no GPS, so the flow can be shown on a laptop.
   */
  demoLocation?: { lat: number; lon: number } | null;
  /** Locate the player and open the pub they are sitting in (venue check-in). */
  onFindVenue?: () => Promise<void>;
}

type Phase = 'idle' | 'locating' | 'saving';

export function ProstPanel({ user, store, onCheckedIn, demoLocation, onFindVenue }: Props) {
  const [finding, setFinding] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [dailyCount, setDailyCount] = useState(0);
  const [beerId, setBeerId] = useState(user.beerId);
  const [suggestOpen, setSuggestOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    store.getDrinkVotes(user.id)
      .then((votes) => { if (!cancelled) setDailyCount(getDailyDrinkCount(votes)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [store, user.id]);

  const capReached = dailyCount >= GAME.DRINK_DAILY_CAP;

  const handleProst = useCallback(async () => {
    setError('');
    setPhase('locating');
    haptic('light');
    primeAudio();

    try {
      const { lat, lon, accuracyM } = await acquireGpsSamples().catch((err) => {
        if (demoLocation) return { ...demoLocation, accuracyM: 10, timestamp: Date.now() };
        throw err;
      });
      setPhase('saving');

      const placeKey = roundToPlaceKey(lat, lon);
      const existing = await store.getDrinkVotes(user.id);
      const result = validateDrinkVote(existing, placeKey, beerId, accuracyM);
      if (!result.ok) {
        setError(result.error ?? 'Check-in gerade nicht möglich.');
        haptic('medium');
        return;
      }

      const now = getNow();
      const vote: DrinkVote = {
        id: `drink_${user.id}_${now}`,
        userId: user.id,
        beerId,
        lat,
        lon,
        placeKey,
        createdAt: now,
        expiresAt: now + GAME.DRINK_TTL_HOURS * 60 * 60 * 1000,
        gpsAccuracyM: accuracyM,
        proofType: 'gps',
      };

      await store.saveDrinkVote(vote);
      appEvents.emit({ type: 'drink:created', vote });
      setDailyCount(getDailyDrinkCount([...existing, vote]));
      haptic('success');
      clink();
      onCheckedIn(vote);
    } catch (err) {
      setError(
        typeof GeolocationPositionError !== 'undefined' && err instanceof GeolocationPositionError
          ? 'Wir konnten deinen Standort nicht bestätigen. Erlaube den Standortzugriff und versuch es nochmal.'
          : 'Da ist was schiefgelaufen. Versuch es gleich nochmal.',
      );
      haptic('medium');
    } finally {
      setPhase('idle');
    }
  }, [user.id, store, beerId, onCheckedIn, demoLocation]);

  const busy = phase !== 'idle';

  return (
    <div className="prost">
      {onFindVenue && (
        <button
          className="card prost-venue"
          disabled={finding}
          onClick={async () => {
            haptic('light');
            setFinding(true);
            try { await onFindVenue(); } finally { setFinding(false); }
          }}
        >
          <span className="prost-venue-icon" aria-hidden="true">{finding ? <span className="spinner" /> : '📍'}</span>
          <span className="prost-venue-text">
            <strong>In einer Kneipe?</strong>
            <span>Check dort ein und hol sie für dein Bier. Das zählt 30 Tage.</span>
          </span>
          <span className="prost-venue-go" aria-hidden="true">›</span>
        </button>
      )}
      <p className="prost-lede">
        Was trinkst du gerade? Dein Check-in färbt die Umgebung für 24&nbsp;Stunden in deiner Bierfarbe.
      </p>

      <BeerPicker
        value={beerId}
        onChange={setBeerId}
        layout="carousel"
        pinned={[user.beerId]}
        country={nearestCity(user.homeLat, user.homeLon).country}
        disabled={busy}
        label="Bier wählen"
        onSuggest={() => setSuggestOpen(true)}
      />
      <SuggestBeerDialog open={suggestOpen} onClose={() => setSuggestOpen(false)} userId={user.id} />

      <button
        className={`prost-go${busy ? ' busy' : ''}`}
        onClick={handleProst}
        disabled={busy || capReached}
        aria-describedby="prost-status"
      >
        {busy ? (
          <>
            <span className="prost-radar" aria-hidden="true"><span /><span /></span>
            {phase === 'locating' ? 'Standort wird bestätigt…' : 'Check-in läuft…'}
          </>
        ) : capReached ? (
          'Für heute ist Schluss – morgen geht’s weiter'
        ) : (
          <>Prost mit {beerName(beerId)}!</>
        )}
      </button>

      <div id="prost-status" className="prost-status" aria-live="polite">
        {error ? (
          <p className="prost-error" role="alert">{error}</p>
        ) : (
          <div className="prost-meter">
            <span className="muted">Check-ins heute</span>
            <span className="prost-dots" aria-label={`${dailyCount} von ${GAME.DRINK_DAILY_CAP}`}>
              {Array.from({ length: GAME.DRINK_DAILY_CAP }, (_, i) => (
                <span key={i} className={i < dailyCount ? 'on' : ''} />
              ))}
            </span>
          </div>
        )}
      </div>

      <ul className="prost-rules">
        <li><span aria-hidden="true">📍</span> Nur vor Ort – wir prüfen dein GPS.</li>
        <li><span aria-hidden="true">⏱️</span> Wirkt 24 Stunden im Umkreis von {GAME.DRINK_RADIUS_KM}&nbsp;km.</li>
        <li><span aria-hidden="true">🧡</span> Genieß verantwortungsvoll – es zählt der Check-in, nicht die Menge.</li>
      </ul>
    </div>
  );
}
