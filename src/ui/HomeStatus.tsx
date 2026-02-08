import { useState, useEffect, useCallback } from 'react';
import type { User, WeightBreakdown } from '../domain/types';
import { computeWeightBreakdown } from '../domain/weights';
import type { StorageInterface } from '../storage/StorageInterface';
import { BEER_MAP } from '../domain/beers';
import './HomeStatus.css';

interface Props {
  user: User;
  store: StorageInterface;
  onUserUpdate: (user: User) => void;
}

export function HomeStatus({ user, store, onUserUpdate }: Props) {
  const [breakdown, setBreakdown] = useState<WeightBreakdown | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopyId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(user.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = user.id;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [user.id]);

  useEffect(() => {
    const load = async () => {
      const allUsers = await store.getAllUsers();
      const teams = await store.getAllTeams();
      const team = teams.find(t => t.beerId === user.beerId && t.memberUserIds.includes(user.id)) ?? null;
      const outcomes = await store.getDuelOutcomes(user.id);
      const wb = computeWeightBreakdown(user, team, allUsers, outcomes);
      setBreakdown(wb);
    };
    load();
  }, [user, store]);

  const toggleSYG = useCallback(async () => {
    const updated = { ...user, standYourGroundEnabled: !user.standYourGroundEnabled };
    await store.saveUser(updated);
    onUserUpdate(updated);
  }, [user, store, onUserUpdate]);

  const beer = BEER_MAP.get(user.beerId);

  return (
    <div className="home-status">
      <h3>Home Status</h3>

      <div className="home-status-beer">
        {beer && <img src={beer.svgLogo} alt={beer.name} className="home-status-logo" />}
        <span className="home-status-beer-name">{beer?.name ?? user.beerId}</span>
      </div>

      <div className="home-status-id">
        <span className="stat-label">Deine ID</span>
        <button className="id-copy-btn" onClick={handleCopyId} title="ID kopieren">
          {user.id.length > 12 ? `${user.id.substring(0, 8)}...` : user.id}
          {' '}{copied ? '✓' : '📋'}
        </button>
      </div>

      {breakdown && (
        <div className="home-status-stats">
          <div className="stat-row">
            <span className="stat-label">Gewicht</span>
            <span className="stat-value">{breakdown.finalWeight.toFixed(2)}x</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Basis</span>
            <span className="stat-value">{breakdown.baseMultiplier.toFixed(1)}x</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Radius</span>
            <span className="stat-value">{breakdown.effectiveRadius} km</span>
          </div>
          {breakdown.teamBoost > 0 && (
            <div className="stat-row">
              <span className="stat-label">Team-Boost</span>
              <span className="stat-value team-boost">+{(breakdown.teamBoost * 100).toFixed(0)}%</span>
            </div>
          )}
          {breakdown.duelDelta !== 0 && (
            <div className="stat-row">
              <span className="stat-label">Duell-Bonus</span>
              <span className={`stat-value ${breakdown.duelDelta > 0 ? 'positive' : 'negative'}`}>
                {breakdown.duelDelta > 0 ? '+' : ''}{breakdown.duelDelta.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      )}

      <label className="syg-toggle">
        <input
          type="checkbox"
          checked={user.standYourGroundEnabled}
          onChange={toggleSYG}
        />
        <span className="syg-label">
          Stand Your Ground
          <span className="syg-desc">
            {user.standYourGroundEnabled
              ? '4x Gewicht, halber Radius'
              : 'Aktivieren: 4x Gewicht, halber Radius'}
          </span>
        </span>
      </label>
    </div>
  );
}
