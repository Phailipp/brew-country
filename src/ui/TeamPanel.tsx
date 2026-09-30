import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import type { User, Team } from '../domain/types';
import type { StorageInterface } from '../storage/StorageInterface';
import { GAME } from '../config/constants';
import { BeerBadge } from './kit/BeerBadge';
import { beerName, beerColor } from './kit/beer';
import { haptic } from './kit/haptics';
import './TeamPanel.css';

interface Props {
  user: User;
  store: StorageInterface;
}

export function TeamPanel({ user, store }: Props) {
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const t = await store.getTeam(user.beerId);
        if (!cancelled) {
          setTeam(t);
          setError('');
        }
      } catch (e) {
        console.error('TeamPanel load error:', e);
        if (!cancelled) setError('Die Biergemeinschaft konnte nicht geladen werden.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user.beerId, store]);

  const handleJoin = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let t = await store.getTeam(user.beerId);

      if (t) {
        if (t.memberUserIds.includes(user.id)) {
          setTeam(t);
          return;
        }
        if (t.memberUserIds.length >= GAME.TEAM_MAX_MEMBERS) {
          setTeam(t);
          setError('Leider voll – jemand war schneller.');
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
      haptic('success');
    } catch (e) {
      console.error('TeamPanel join error:', e);
      setError('Beitreten hat nicht geklappt. Versuch es gleich nochmal.');
    } finally {
      setLoading(false);
    }
  }, [user, store]);

  const handleLeave = useCallback(async () => {
    if (!team) return;
    setLoading(true);
    setError('');
    try {
      const updated: Team = {
        ...team,
        memberUserIds: team.memberUserIds.filter(id => id !== user.id),
      };
      await store.saveTeam(updated);
      setTeam(updated.memberUserIds.length > 0 ? updated : null);
      setConfirmLeave(false);
      haptic('medium');
    } catch (e) {
      console.error('TeamPanel leave error:', e);
      setError('Verlassen hat nicht geklappt. Versuch es gleich nochmal.');
    } finally {
      setLoading(false);
    }
  }, [team, user.id, store]);

  const isMember = team?.memberUserIds.includes(user.id) ?? false;
  const memberCount = team?.memberUserIds.length ?? 0;
  const isFull = memberCount >= GAME.TEAM_MAX_MEMBERS;
  const boostPct = Math.round(GAME.TEAM_BOOST_PER_OVERLAP * 100);
  const maxBoostPct = Math.round(GAME.TEAM_MAX_BOOST * 100);
  const name = beerName(user.beerId);

  return (
    <section className="section team" aria-labelledby="team-title">
      <h2 className="section-title" id="team-title">Biergemeinschaft</h2>

      <div
        className={`card card-hero team-card${isMember ? ' member' : ''}`}
        style={{ '--team-color': beerColor(user.beerId) } as CSSProperties}
      >
        <div className="team-head">
          <BeerBadge beerId={user.beerId} size="lg" />
          <div className="team-head-text">
            <span className="team-name">{name}-Gemeinschaft</span>
            <span className="muted num">
              {loading && !team ? 'Lädt …' : `${memberCount} von ${GAME.TEAM_MAX_MEMBERS} Plätzen belegt`}
            </span>
          </div>
          {isMember && <span className="chip chip-success">Dabei</span>}
        </div>

        <div className="team-seats" aria-hidden="true">
          {Array.from({ length: GAME.TEAM_MAX_MEMBERS }, (_, i) => (
            <span key={i} className={`team-seat${i < memberCount ? ' taken' : ''}`} />
          ))}
        </div>

        <p className="team-desc">
          {isMember
            ? `Crew-Bonus aktiv: +${boostPct} % Stimmkraft für jedes Mitglied in deiner Nähe (bis +${maxBoostPct} %).`
            : `Tritt bei und kämpft gemeinsam: +${boostPct} % Stimmkraft pro Mitglied in deiner Nähe.`}
        </p>

        {isMember ? (
          confirmLeave ? (
            <div className="team-confirm" role="group" aria-label="Gemeinschaft verlassen?">
              <span className="team-confirm-text">Wirklich raus? Dein Crew-Bonus fällt weg.</span>
              <div className="team-confirm-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmLeave(false)} disabled={loading}>
                  Bleiben
                </button>
                <button type="button" className="btn btn-danger btn-sm" onClick={handleLeave} disabled={loading}>
                  {loading ? <span className="spinner" aria-hidden="true" /> : 'Verlassen'}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn btn-ghost btn-block" onClick={() => setConfirmLeave(true)} disabled={loading}>
              Gemeinschaft verlassen
            </button>
          )
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={handleJoin}
            disabled={loading || isFull}
            aria-busy={loading}
          >
            {loading ? (
              <><span className="spinner" aria-hidden="true" /> Einen Moment …</>
            ) : isFull ? (
              'Alle Plätze belegt'
            ) : (
              'Beitreten'
            )}
          </button>
        )}

        {error && <p className="team-error" role="alert">{error}</p>}
      </div>
    </section>
  );
}
