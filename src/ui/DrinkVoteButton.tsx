import { useState, useCallback, useEffect } from 'react';
import type { User, DrinkVote } from '../domain/types';
import type { StorageInterface } from '../storage/StorageInterface';
import { GAME } from '../config/constants';
import { getNow } from '../domain/clock';
import { roundToPlaceKey } from '../domain/placeKey';
import { validateDrinkVote, getDailyDrinkCount } from '../domain/drinkVoteRules';
import { acquireGpsSamples } from '../domain/gpsVerify';
import { BEERS } from '../domain/beers';
import { appEvents } from '../domain/events';
import './DrinkVoteButton.css';

interface Props {
  user: User;
  store: StorageInterface;
  onVoteCreated: () => void;
}

export function DrinkVoteButton({ user, store, onVoteCreated }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dailyCount, setDailyCount] = useState(0);
  const [selectedBeerId, setSelectedBeerId] = useState(user.beerId);

  // Load daily count on mount
  useEffect(() => {
    (async () => {
      const votes = await store.getDrinkVotes(user.id);
      setDailyCount(getDailyDrinkCount(votes));
    })();
  }, [store, user.id]);

  const handleCheckin = useCallback(async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // 1. Acquire GPS
      const sample = await acquireGpsSamples();
      const { lat, lon, accuracyM } = sample;

      // 2. Compute placeKey
      const placeKey = roundToPlaceKey(lat, lon);

      // 3. Load existing votes for validation
      const existing = await store.getDrinkVotes(user.id);

      // 4. Validate
      const result = validateDrinkVote(existing, placeKey, selectedBeerId, accuracyM);
      if (!result.ok) {
        setError(result.error!);
        setLoading(false);
        return;
      }

      // 5. Create DrinkVote
      const now = getNow();
      const vote: DrinkVote = {
        id: `drink_${user.id}_${now}`,
        userId: user.id,
        beerId: selectedBeerId,
        lat,
        lon,
        placeKey,
        createdAt: now,
        expiresAt: now + GAME.DRINK_TTL_HOURS * 60 * 60 * 1000,
        gpsAccuracyM: accuracyM,
        proofType: 'gps',
      };

      // 6. Save + emit + callback
      await store.saveDrinkVote(vote);
      appEvents.emit({ type: 'drink:created', vote });
      setDailyCount(getDailyDrinkCount([...existing, vote]));
      setSuccess('Drink Vote gesetzt (24h aktiv)');
      onVoteCreated();

      // Clear success after 3s
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(
        err instanceof GeolocationPositionError
          ? 'GPS-Fehler: Standortzugriff nicht möglich.'
          : 'Fehler beim Check-in.'
      );
    }

    setLoading(false);
  }, [user, store, selectedBeerId, onVoteCreated]);

  return (
    <div className="drink-section">
      <h3>Drink Vote</h3>
      <p className="drink-desc">
        Check-in: Bier an deinem aktuellen Standort (24h, Gewicht 0.75, 5km Radius).
      </p>

      <select
        className="drink-select"
        value={selectedBeerId}
        onChange={e => setSelectedBeerId(e.target.value)}
        disabled={loading}
      >
        {BEERS.map(b => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>

      <button
        className="drink-btn"
        onClick={handleCheckin}
        disabled={loading || dailyCount >= GAME.DRINK_DAILY_CAP}
      >
        {loading ? 'GPS...' : `Check-in`}
      </button>

      <p className="drink-count">
        Heute: {dailyCount}/{GAME.DRINK_DAILY_CAP} Drink Votes
      </p>

      {success && <p className="drink-success">{success}</p>}
      {error && <p className="drink-error">{error}</p>}
    </div>
  );
}
