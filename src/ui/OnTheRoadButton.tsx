import { useState, useCallback } from 'react';
import type { User, OnTheRoadVote } from '../domain/types';
import type { StorageInterface } from '../storage/StorageInterface';
import { haversineDistanceKm } from '../domain/geo';
import { GAME } from '../config/constants';
import { getNow } from '../domain/clock';
import { haptic } from './kit/haptics';
import './OnTheRoadButton.css';

interface Props {
  user: User;
  store: StorageInterface;
  onVoteCreated: () => void;
}

export function OnTheRoadButton({ user, store, onVoteCreated }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeCount, setActiveCount] = useState<number | null>(null);

  const handlePush = useCallback(async () => {
    setLoading(true);
    setError('');
    haptic('light');

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('no-geolocation'));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
        });
      });

      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      // Must be outside the home area
      const distFromHome = haversineDistanceKm(user.homeLat, user.homeLon, lat, lon);
      const homeRadius = user.standYourGroundEnabled
        ? GAME.HOME_RADIUS_KM / GAME.SYG_RADIUS_DIVISOR
        : GAME.HOME_RADIUS_KM;

      if (distFromHome <= homeRadius) {
        setError(`Du bist noch in deinem Revier. Flaggen gehen erst ab ${homeRadius} km von zu Hause.`);
        return;
      }

      const existing = await store.getOTRVotes(user.id);
      const active = existing.filter(v => v.expiresAt > getNow());
      setActiveCount(active.length);
      if (active.length >= GAME.OTR_MAX_ACTIVE) {
        setError(`Alle ${GAME.OTR_MAX_ACTIVE} Flaggen sind schon gesetzt. Warte, bis eine abläuft.`);
        return;
      }

      for (const v of active) {
        const dist = haversineDistanceKm(v.lat, v.lon, lat, lon);
        if (dist < GAME.OTR_RADIUS_KM * 2) {
          setError('Hier in der Nähe weht schon eine deiner Flaggen. Zieh weiter!');
          return;
        }
      }

      const now = getNow();
      const vote: OnTheRoadVote = {
        id: `otr_${user.id}_${now}`,
        userId: user.id,
        lat,
        lon,
        beerId: user.beerId,
        createdAt: now,
        expiresAt: now + GAME.OTR_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      };

      await store.saveOTRVote(vote);
      setActiveCount(active.length + 1);
      haptic('success');
      onVoteCreated();
    } catch (err) {
      setError(
        typeof GeolocationPositionError !== 'undefined' && err instanceof GeolocationPositionError
          ? 'Wir finden dich gerade nicht. Erlaube den Standortzugriff und versuch es nochmal.'
          : 'Die Flagge konnte nicht gesetzt werden. Versuch es gleich nochmal.'
      );
    } finally {
      setLoading(false);
    }
  }, [user, store, onVoteCreated]);

  return (
    <section className="section otr" aria-labelledby="otr-title">
      <div className="card otr-card">
        <div className="otr-head">
          <span className="otr-icon" aria-hidden="true">🚩</span>
          <div className="otr-head-text">
            <h2 className="otr-title" id="otr-title">Unterwegs-Flagge</h2>
            <p className="otr-desc">
              Auf Reisen? Setz eine Flagge für dein Bier – hält {GAME.OTR_EXPIRY_DAYS} Tage mit halber Kraft.
            </p>
          </div>
        </div>

        <div className="otr-slots" aria-label={activeCount !== null ? `${activeCount} von ${GAME.OTR_MAX_ACTIVE} Flaggen aktiv` : undefined}>
          {activeCount !== null && Array.from({ length: GAME.OTR_MAX_ACTIVE }, (_, i) => (
            <span key={i} className={`otr-slot${i < activeCount ? ' used' : ''}`} aria-hidden="true" />
          ))}
          {activeCount !== null && (
            <span className="otr-slot-label num">{activeCount}/{GAME.OTR_MAX_ACTIVE} Flaggen aktiv</span>
          )}
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={handlePush}
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? (
            <>
              <span className="spinner" aria-hidden="true" /> Suche deinen Standort …
            </>
          ) : (
            'Hier Flagge setzen'
          )}
        </button>

        {error && <p className="otr-error" role="alert">{error}</p>}
      </div>
    </section>
  );
}
