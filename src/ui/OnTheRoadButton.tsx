import { useState, useCallback } from 'react';
import type { User, OnTheRoadVote } from '../domain/types';
import type { StorageInterface } from '../storage/StorageInterface';
import { haversineDistanceKm } from '../domain/geo';
import { GAME } from '../config/constants';
import { getNow } from '../domain/clock';
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

    try {
      // Get current position
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
        });
      });

      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      // Check: must be outside home radius
      const distFromHome = haversineDistanceKm(user.homeLat, user.homeLon, lat, lon);
      const homeRadius = user.standYourGroundEnabled
        ? GAME.HOME_RADIUS_KM / GAME.SYG_RADIUS_DIVISOR
        : GAME.HOME_RADIUS_KM;

      if (distFromHome <= homeRadius) {
        setError('Du bist noch im Home-Radius. OTR-Votes nur außerhalb möglich.');
        setLoading(false);
        return;
      }

      // Check: max 5 active
      const existing = await store.getOTRVotes(user.id);
      const active = existing.filter(v => v.expiresAt > getNow());
      if (active.length >= GAME.OTR_MAX_ACTIVE) {
        setError(`Maximal ${GAME.OTR_MAX_ACTIVE} aktive OTR-Votes.`);
        setLoading(false);
        return;
      }

      // Check: no overlap with existing OTR votes
      for (const v of active) {
        const dist = haversineDistanceKm(v.lat, v.lon, lat, lon);
        if (dist < GAME.OTR_RADIUS_KM * 2) {
          setError('Zu nah an einem bestehenden OTR-Vote.');
          setLoading(false);
          return;
        }
      }

      // Create OTR vote
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
      onVoteCreated();
    } catch (err) {
      setError(
        err instanceof GeolocationPositionError
          ? 'GPS-Fehler: Standortzugriff nicht möglich.'
          : 'Fehler beim Erstellen des OTR-Votes.'
      );
    }

    setLoading(false);
  }, [user, store, onVoteCreated]);

  return (
    <div className="otr-section">
      <h3>On The Road</h3>
      <p className="otr-desc">
        Setze temporäre Votes außerhalb deines Home-Radius (14 Tage, halbes Gewicht).
      </p>
      <button
        className="otr-btn"
        onClick={handlePush}
        disabled={loading}
      >
        {loading ? 'GPS...' : '🚗 Hier pushen (2 Wochen)'}
      </button>
      {activeCount !== null && (
        <p className="otr-count">{activeCount}/{GAME.OTR_MAX_ACTIVE} aktiv</p>
      )}
      {error && <p className="otr-error">{error}</p>}
    </div>
  );
}
