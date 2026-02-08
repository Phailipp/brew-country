import { useState, useEffect, useCallback } from 'react';
import type { User, Team } from '../domain/types';
import type { StorageInterface } from '../storage/StorageInterface';
import { BEER_MAP } from '../domain/beers';
import { GAME } from '../config/constants';
import './TeamPanel.css';

interface Props {
  user: User;
  store: StorageInterface;
}

export function TeamPanel({ user, store }: Props) {
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const t = await store.getTeam(user.beerId);
      setTeam(t);
      setLoading(false);
    };
    load();
  }, [user.beerId, store]);

  const handleJoin = useCallback(async () => {
    setLoading(true);
    let t = await store.getTeam(user.beerId);

    if (t) {
      if (t.memberUserIds.includes(user.id)) {
        setTeam(t);
        setLoading(false);
        return;
      }
      if (t.memberUserIds.length >= GAME.TEAM_MAX_MEMBERS) {
        setLoading(false);
        return;
      }
      t = { ...t, memberUserIds: [...t.memberUserIds, user.id] };
    } else {
      t = {
        id: `team_${user.beerId}`,
        beerId: user.beerId,
        memberUserIds: [user.id],
      };
    }

    await store.saveTeam(t);
    setTeam(t);
    setLoading(false);
  }, [user, store]);

  const handleLeave = useCallback(async () => {
    if (!team) return;
    setLoading(true);
    const updated: Team = {
      ...team,
      memberUserIds: team.memberUserIds.filter(id => id !== user.id),
    };
    await store.saveTeam(updated);
    setTeam(updated.memberUserIds.length > 0 ? updated : null);
    setLoading(false);
  }, [team, user.id, store]);

  const beer = BEER_MAP.get(user.beerId);
  const isMember = team?.memberUserIds.includes(user.id) ?? false;
  const memberCount = team?.memberUserIds.length ?? 0;

  return (
    <div className="team-panel">
      <h3>Biergemeinschaft</h3>
      <div className="team-info">
        {beer && <img src={beer.svgLogo} alt={beer.name} className="team-logo" />}
        <span className="team-name">{beer?.name ?? user.beerId}</span>
        <span className="team-count">
          {memberCount}/{GAME.TEAM_MAX_MEMBERS}
        </span>
      </div>

      {isMember ? (
        <>
          <p className="team-member-status">Du bist Mitglied! Team-Boost aktiv.</p>
          <button className="team-leave" onClick={handleLeave} disabled={loading}>
            Verlassen
          </button>
        </>
      ) : (
        <button className="team-join" onClick={handleJoin} disabled={loading || memberCount >= GAME.TEAM_MAX_MEMBERS}>
          {loading ? '...' : memberCount >= GAME.TEAM_MAX_MEMBERS ? 'Team voll' : 'Beitreten'}
        </button>
      )}

      <p className="team-desc">
        +{(GAME.TEAM_BOOST_PER_OVERLAP * 100).toFixed(0)}% pro Teammitglied mit überlappendem Radius
      </p>
    </div>
  );
}
