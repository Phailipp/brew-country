import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import type { User, Team } from '../domain/types';
import type { StorageInterface } from '../storage/StorageInterface';
import { GAME } from '../config/constants';
import { BeerBadge } from './kit/BeerBadge';
import { beerName, beerColor } from './kit/beer';
import { haptic } from './kit/haptics';
import { fmtPercent, t } from '../i18n';
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
        if (!cancelled) setError(t('team.errLoad'));
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
      const existing = await store.getTeam(user.beerId);

      if (existing) {
        if (existing.memberUserIds.includes(user.id)) {
          setTeam(existing);
          return;
        }
        if (existing.memberUserIds.length >= GAME.TEAM_MAX_MEMBERS) {
          setTeam(existing);
          setError(t('team.errFull'));
          return;
        }
      }

      setTeam(await store.joinTeam(user.beerId, user.id));
      haptic('success');
    } catch (e) {
      console.error('TeamPanel join error:', e);
      setError(t('team.errJoin'));
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
      await store.leaveTeam(team.beerId, user.id);
      setTeam(updated.memberUserIds.length > 0 ? updated : null);
      setConfirmLeave(false);
      haptic('medium');
    } catch (e) {
      console.error('TeamPanel leave error:', e);
      setError(t('team.errLeave'));
    } finally {
      setLoading(false);
    }
  }, [team, user.id, store]);

  const isMember = team?.memberUserIds.includes(user.id) ?? false;
  const memberCount = team?.memberUserIds.length ?? 0;
  const isFull = memberCount >= GAME.TEAM_MAX_MEMBERS;
  const boostPct = fmtPercent(GAME.TEAM_BOOST_PER_OVERLAP);
  const maxBoostPct = fmtPercent(GAME.TEAM_MAX_BOOST);
  const name = beerName(user.beerId);

  return (
    <section className="section team" aria-labelledby="team-title">
      <h2 className="section-title" id="team-title">{t('team.title')}</h2>

      <div
        className={`card card-hero team-card${isMember ? ' member' : ''}`}
        style={{ '--team-color': beerColor(user.beerId) } as CSSProperties}
      >
        <div className="team-head">
          <BeerBadge beerId={user.beerId} size="lg" />
          <div className="team-head-text">
            <span className="team-name">{t('team.name', { beer: name })}</span>
            <span className="muted num">
              {loading && !team ? t('common.loadingSpaced') : t('team.seats', { count: memberCount, max: GAME.TEAM_MAX_MEMBERS })}
            </span>
          </div>
          {isMember && <span className="chip chip-success">{t('team.member')}</span>}
        </div>

        <div className="team-seats" aria-hidden="true">
          {Array.from({ length: GAME.TEAM_MAX_MEMBERS }, (_, i) => (
            <span key={i} className={`team-seat${i < memberCount ? ' taken' : ''}`} />
          ))}
        </div>

        <p className="team-desc">
          {isMember
            ? t('team.descMember', { boost: boostPct, max: maxBoostPct })
            : t('team.descJoin', { boost: boostPct })}
        </p>

        {isMember ? (
          confirmLeave ? (
            <div className="team-confirm" role="group" aria-label={t('team.leaveQuestion')}>
              <span className="team-confirm-text">{t('team.leaveText')}</span>
              <div className="team-confirm-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmLeave(false)} disabled={loading}>
                  {t('team.stay')}
                </button>
                <button type="button" className="btn btn-danger btn-sm" onClick={handleLeave} disabled={loading}>
                  {loading ? <span className="spinner" aria-hidden="true" /> : t('team.leave')}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn btn-ghost btn-block" onClick={() => setConfirmLeave(true)} disabled={loading}>
              {t('team.leaveButton')}
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
              <><span className="spinner" aria-hidden="true" /> {t('team.wait')}</>
            ) : isFull ? (
              t('team.allTaken')
            ) : (
              t('team.join')
            )}
          </button>
        )}

        {error && <p className="team-error" role="alert">{error}</p>}
      </div>
    </section>
  );
}
