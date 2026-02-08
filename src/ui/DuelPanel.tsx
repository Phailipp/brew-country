import { useState, useEffect, useCallback } from 'react';
import type { Duel, User } from '../domain/types';
import type { StorageInterface } from '../storage/StorageInterface';
import { BEER_MAP } from '../domain/beers';
import { GAME } from '../config/constants';
import './DuelPanel.css';

interface Props {
  user: User;
  store: StorageInterface;
}

function formatTimeLeft(ms: number): string {
  if (ms <= 0) return 'Abgelaufen';
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const mins = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function getDuelTimeoutMs(duel: Duel): number {
  if (duel.status === 'pending') {
    return duel.createdAt + GAME.DUEL_ACCEPT_TIMEOUT_HOURS * 60 * 60 * 1000 - Date.now();
  }
  if (duel.status === 'active') {
    return duel.lastActionAt + GAME.DUEL_ROUND_TIMEOUT_HOURS * 60 * 60 * 1000 - Date.now();
  }
  return 0;
}

export function DuelPanel({ user, store }: Props) {
  const [duels, setDuels] = useState<Duel[]>([]);
  const [_, setTick] = useState(0);

  useEffect(() => {
    const load = async () => {
      const d = await store.getDuelsForUser(user.id);
      setDuels(d.filter(d => d.status === 'pending' || d.status === 'active'));
    };
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [user.id, store]);

  // Tick every minute for countdown
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  const handleDecline = useCallback(async (duelId: string) => {
    const duel = await store.getDuel(duelId);
    if (!duel) return;
    const updated: Duel = {
      ...duel,
      status: 'declined',
      resolvedAt: Date.now(),
    };
    await store.saveDuel(updated);
    setDuels(prev => prev.filter(d => d.id !== duelId));
  }, [store]);

  const handleAccept = useCallback(async (duelId: string) => {
    const duel = await store.getDuel(duelId);
    if (!duel) return;
    const now = Date.now();
    const updated: Duel = {
      ...duel,
      status: 'active',
      acceptedAt: now,
      lastActionAt: now,
    };
    await store.saveDuel(updated);
    setDuels(prev => prev.map(d => d.id === duelId ? updated : d));
  }, [store]);

  // Suppress unused _ warning
  void _;

  if (duels.length === 0) return null;

  return (
    <div className="duel-panel">
      <h3>Meine Duelle ({duels.length}/{GAME.DUEL_MAX_ACTIVE})</h3>
      <div className="duel-list">
        {duels.map(duel => {
          const isChallenger = duel.challengerUserId === user.id;
          const opponentBeerId = isChallenger ? duel.defenderBeerId : duel.challengerBeerId;
          const opponentBeer = BEER_MAP.get(opponentBeerId);
          const timeLeft = getDuelTimeoutMs(duel);
          const myBeer = BEER_MAP.get(isChallenger ? duel.challengerBeerId : duel.defenderBeerId);

          return (
            <div key={duel.id} className={`duel-item duel-${duel.status}`}>
              <div className="duel-header">
                <span className="duel-vs">
                  <span className="duel-beer" style={{ color: myBeer?.color }}>
                    {myBeer?.name}
                  </span>
                  {' vs '}
                  <span className="duel-beer" style={{ color: opponentBeer?.color }}>
                    {opponentBeer?.name}
                  </span>
                </span>
                <span className={`duel-timer ${timeLeft <= 0 ? 'expired' : ''}`}>
                  {formatTimeLeft(timeLeft)}
                </span>
              </div>
              <div className="duel-info">
                <span className="duel-status-badge">{duel.status}</span>
                {duel.status === 'active' && (
                  <span className="duel-rounds">Runde {duel.roundCount}</span>
                )}
              </div>
              {duel.status === 'pending' && !isChallenger && (
                <div className="duel-actions">
                  <button className="duel-accept" onClick={() => handleAccept(duel.id)}>
                    Annehmen
                  </button>
                  <button className="duel-decline" onClick={() => handleDecline(duel.id)}>
                    Ablehnen
                  </button>
                </div>
              )}
              {duel.status === 'pending' && isChallenger && (
                <p className="duel-waiting">Warte auf Antwort...</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
