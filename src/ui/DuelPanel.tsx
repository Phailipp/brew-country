import { useState, useEffect, useCallback } from 'react';
import type { Duel, User } from '../domain/types';
import type { StorageInterface } from '../storage/StorageInterface';
import { GAME } from '../config/constants';
import { BeerBadge } from './kit/BeerBadge';
import { beerName } from './kit/beer';
import { haptic } from './kit/haptics';
import './DuelPanel.css';

interface Props {
  user: User;
  store: StorageInterface;
}

function formatTimeLeft(ms: number): string {
  if (ms <= 0) return 'Abgelaufen';
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const mins = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return `noch ${hours} Std. ${mins} Min.`;
  return `noch ${mins} Min.`;
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
  const [, setTick] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const d = await store.getDuelsForUser(user.id);
        if (!cancelled) setDuels(d.filter(d => d.status === 'pending' || d.status === 'active'));
      } catch (e) {
        console.error('DuelPanel load error:', e);
      }
    };
    load();
    const interval = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user.id, store]);

  // Re-render every minute for the countdown
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  const handleDecline = useCallback(async (duelId: string) => {
    setBusyId(duelId);
    setError('');
    try {
      const duel = await store.getDuel(duelId);
      if (!duel) return;
      const updated: Duel = { ...duel, status: 'declined', resolvedAt: Date.now() };
      await store.saveDuel(updated);
      setDuels(prev => prev.filter(d => d.id !== duelId));
      haptic('light');
    } catch (e) {
      console.error('Duel decline error:', e);
      setError('Das hat nicht geklappt. Versuch es nochmal.');
    } finally {
      setBusyId(null);
    }
  }, [store]);

  const handleAccept = useCallback(async (duelId: string) => {
    setBusyId(duelId);
    setError('');
    try {
      const duel = await store.getDuel(duelId);
      if (!duel) return;
      const now = Date.now();
      const updated: Duel = { ...duel, status: 'active', acceptedAt: now, lastActionAt: now };
      await store.saveDuel(updated);
      setDuels(prev => prev.map(d => d.id === duelId ? updated : d));
      haptic('heavy');
    } catch (e) {
      console.error('Duel accept error:', e);
      setError('Annehmen hat nicht geklappt. Versuch es nochmal.');
    } finally {
      setBusyId(null);
    }
  }, [store]);

  if (duels.length === 0) return null;

  return (
    <section className="section duels" aria-labelledby="duels-title">
      <h2 className="section-title" id="duels-title">
        Deine Duelle
        <small className="num">{duels.length}/{GAME.DUEL_MAX_ACTIVE} aktiv</small>
      </h2>

      <ul className="duel-list">
        {duels.map(duel => {
          const isChallenger = duel.challengerUserId === user.id;
          const myBeerId = isChallenger ? duel.challengerBeerId : duel.defenderBeerId;
          const oppBeerId = isChallenger ? duel.defenderBeerId : duel.challengerBeerId;
          const timeLeft = getDuelTimeoutMs(duel);
          const urgent = timeLeft > 0 && timeLeft < 60 * 60 * 1000;
          const busy = busyId === duel.id;
          const incoming = duel.status === 'pending' && !isChallenger;

          let statusChip: { label: string; cls: string };
          if (duel.status === 'active') statusChip = { label: `⚔️ Läuft · Runde ${duel.roundCount}`, cls: 'chip-hot' };
          else if (incoming) statusChip = { label: '🔔 Herausforderung!', cls: 'chip-accent' };
          else statusChip = { label: '⏳ Wartet auf Antwort', cls: '' };

          return (
            <li key={duel.id} className={`card duel duel-${duel.status}${incoming ? ' incoming' : ''}`}>
              <div className="duel-top">
                <span className={`chip ${statusChip.cls}`}>{statusChip.label}</span>
                <span className={`duel-timer num${timeLeft <= 0 ? ' expired' : urgent ? ' urgent' : ''}`}>
                  {formatTimeLeft(timeLeft)}
                </span>
              </div>

              <div className="duel-vs" role="img" aria-label={`${beerName(myBeerId)} gegen ${beerName(oppBeerId)}`}>
                <div className="duel-side">
                  <BeerBadge beerId={myBeerId} size="lg" />
                  <span className="duel-side-name">{beerName(myBeerId)}</span>
                  <span className="duel-side-role">Du</span>
                </div>
                <span className="duel-vs-mark" aria-hidden="true">VS</span>
                <div className="duel-side">
                  <BeerBadge beerId={oppBeerId} size="lg" />
                  <span className="duel-side-name">{beerName(oppBeerId)}</span>
                  <span className="duel-side-role">{isChallenger ? 'Verteidiger' : 'Herausforderer'}</span>
                </div>
              </div>

              {incoming && (
                <div className="duel-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => handleDecline(duel.id)} disabled={busy}>
                    Ablehnen
                  </button>
                  <button type="button" className="btn btn-primary" onClick={() => handleAccept(duel.id)} disabled={busy}>
                    {busy ? <span className="spinner" aria-hidden="true" /> : 'Duell annehmen'}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p className="duel-error" role="alert">{error}</p>}
    </section>
  );
}
