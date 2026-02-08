import { useState, useEffect } from 'react';
import type { StorageInterface } from '../storage/StorageInterface';
import { getNow } from '../domain/clock';

interface Props {
  store: StorageInterface;
}

interface Stats {
  users: number;
  otrVotes: number;
  drinkVotesActive: number;
  drinkVotesExpired: number;
  duels: number;
  teams: number;
}

export function DebugStats({ store }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const load = async () => {
      const now = getNow();
      const users = await store.getAllUsers();
      const otr = await store.getAllOTRVotes();
      const drink = await store.getAllDrinkVotes();
      const teams = await store.getAllTeams();

      setStats({
        users: users.length,
        otrVotes: otr.filter(v => v.expiresAt > now).length,
        drinkVotesActive: drink.filter(v => v.expiresAt > now).length,
        drinkVotesExpired: drink.filter(v => v.expiresAt <= now).length,
        duels: 0, // would need getDuelsForUser for all users — simplified
        teams: teams.length,
      });
    };

    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [store]);

  if (!stats) return <p>Laden...</p>;

  return (
    <div className="admin-section">
      <h3>Live Stats</h3>
      <div className="admin-stat">
        <span className="admin-stat-label">Users</span>
        <span className="admin-stat-value">{stats.users}</span>
      </div>
      <div className="admin-stat">
        <span className="admin-stat-label">OTR Votes (aktiv)</span>
        <span className="admin-stat-value">{stats.otrVotes}</span>
      </div>
      <div className="admin-stat">
        <span className="admin-stat-label">Drink Votes (aktiv)</span>
        <span className="admin-stat-value">{stats.drinkVotesActive}</span>
      </div>
      <div className="admin-stat">
        <span className="admin-stat-label">Drink Votes (expired)</span>
        <span className="admin-stat-value">{stats.drinkVotesExpired}</span>
      </div>
      <div className="admin-stat">
        <span className="admin-stat-label">Teams</span>
        <span className="admin-stat-value">{stats.teams}</span>
      </div>
    </div>
  );
}
