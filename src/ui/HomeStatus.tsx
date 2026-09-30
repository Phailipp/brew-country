import { useState, useEffect, useCallback, useRef } from 'react';
import type { User, WeightBreakdown } from '../domain/types';
import { computeWeightBreakdown } from '../domain/weights';
import type { StorageInterface } from '../storage/StorageInterface';
import { GAME } from '../config/constants';
import { BeerBadge } from './kit/BeerBadge';
import { beerName } from './kit/beer';
import { haptic } from './kit/haptics';
import { fmtNumber, fmtPercent, t } from '../i18n';
import './HomeStatus.css';

interface Props {
  user: User;
  store: StorageInterface;
  onUserUpdate: (user: User) => void;
}

function fmtFactor(n: number): string {
  return `×${fmtNumber(n, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
}

export function HomeStatus({ user, store, onUserUpdate }: Props) {
  const [breakdown, setBreakdown] = useState<WeightBreakdown | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  const markCopied = useCallback(() => {
    setCopied(true);
    haptic('light');
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleCopyId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(user.id);
      markCopied();
    } catch {
      // Fallback for older browsers / WKWebView
      const ta = document.createElement('textarea');
      ta.value = user.id;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      markCopied();
    }
  }, [user.id, markCopied]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const allUsers = await store.getAllUsers();
        const teams = await store.getAllTeams();
        const team = teams.find(t => t.beerId === user.beerId && t.memberUserIds.includes(user.id)) ?? null;
        const outcomes = await store.getDuelOutcomes(user.id);
        const wb = computeWeightBreakdown(user, team, allUsers, outcomes);
        if (!cancelled) {
          setBreakdown(wb);
          setLoadError(false);
        }
      } catch (e) {
        console.error('HomeStatus load error:', e);
        if (!cancelled) setLoadError(true);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user, store]);

  const toggleSYG = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setSaveError('');
    haptic('medium');
    try {
      const updated = { ...user, standYourGroundEnabled: !user.standYourGroundEnabled };
      await store.saveUser(updated);
      onUserUpdate(updated);
    } catch (e) {
      console.error('SYG toggle error:', e);
      setSaveError(t('home.errSave'));
    } finally {
      setSaving(false);
    }
  }, [user, store, onUserUpdate, saving]);

  const syg = user.standYourGroundEnabled;
  const shortId = user.id.length > 14 ? `${user.id.slice(0, 6)}…${user.id.slice(-4)}` : user.id;

  // Heimvorteil: 1.0 (min) … 2.0 (max). Shown as a charge bar.
  const base = breakdown?.baseMultiplier ?? GAME.HOME_BOOST_MAX;
  const charge = Math.round(
    ((base - GAME.HOME_BOOST_MIN) / (GAME.HOME_BOOST_MAX - GAME.HOME_BOOST_MIN)) * 100,
  );
  const fullyCharged = base >= GAME.HOME_BOOST_MAX;

  return (
    <section className="section home-status" aria-labelledby="hs-title">
      <h2 className="section-title" id="hs-title">{t('home.title')}</h2>

      <div className="card card-hero hs-hero">
        <div className="hs-top">
          <BeerBadge beerId={user.beerId} size="xl" />
          <div className="hs-top-text">
            <span className="eyebrow">{t('home.yourBeer')}</span>
            <p className="hs-beer-name">{beerName(user.beerId)}</p>
            <span className="muted">
              {t('home.radius', { km: breakdown ? breakdown.effectiveRadius : (syg ? GAME.HOME_RADIUS_KM / GAME.SYG_RADIUS_DIVISOR : GAME.HOME_RADIUS_KM) })}
            </span>
          </div>
        </div>

        <div className="hs-power" aria-live="polite">
          {breakdown ? (
            <>
              <div className="hs-power-main">
                <span className="hs-power-num num">{fmtFactor(breakdown.finalWeight)}</span>
                <span className="hs-power-label">{t('home.power')}</span>
              </div>
              <p className="hs-power-explain">
                {t('home.powerExplain')}
              </p>
              <ul className="hs-chips" aria-label={t('home.chipsLabel')}>
                <li className="chip chip-accent">{t('home.homeAdvantage', { factor: fmtFactor(breakdown.baseMultiplier) })}</li>
                {syg && <li className="chip chip-hot">{t('home.fortressChip', { factor: fmtFactor(breakdown.sygMultiplier) })}</li>}
                {breakdown.teamBoost > 0 && (
                  <li className="chip chip-success">{t('home.crewBonus', { pct: fmtPercent(breakdown.teamBoost) })}</li>
                )}
                {breakdown.duelDelta !== 0 && (
                  <li className={`chip ${breakdown.duelDelta > 0 ? 'chip-success' : 'chip-hot'}`}>
                    {t('home.duels', {
                      delta: (breakdown.duelDelta > 0 ? '+' : '−')
                        + fmtNumber(Math.abs(breakdown.duelDelta), { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
                    })}
                  </li>
                )}
              </ul>
            </>
          ) : loadError ? (
            <p className="hs-error" role="alert">
              {t('home.errLoad')}
            </p>
          ) : (
            <div className="hs-skeleton" role="status" aria-label={t('common.loadingSpaced')}>
              <span className="skeleton" style={{ width: 120, height: 40 }} />
              <span className="skeleton" style={{ width: '80%', height: 14 }} />
            </div>
          )}
        </div>

        <div className="hs-charge">
          <div className="hs-charge-head">
            <span className="hs-charge-title">{t('home.battery')}</span>
            <span className="num hs-charge-val">{fmtFactor(base)}</span>
          </div>
          <div
            className={`bar hs-charge-bar${fullyCharged ? ' full' : ''}`}
            role="progressbar"
            aria-label={t('home.batteryLabel')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={charge}
          >
            <span style={{ width: `${Math.max(4, charge)}%` }} />
          </div>
          <p className="hs-charge-hint">
            {fullyCharged
              ? t('home.full')
              : t('home.draining')}
          </p>
        </div>
      </div>

      <div className="card hs-syg">
        <div className="hs-syg-text">
          <span className="hs-syg-title" id="hs-syg-label">
            <span aria-hidden="true">🏰</span> {t('home.fortress')}
          </span>
          <span className="hs-syg-desc" id="hs-syg-desc">
            {t('home.fortressText')}
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={syg}
          aria-labelledby="hs-syg-label"
          aria-describedby="hs-syg-desc"
          className={`hs-switch${syg ? ' on' : ''}`}
          onClick={toggleSYG}
          disabled={saving}
        >
          <span className="hs-switch-thumb" />
        </button>
      </div>
      {saveError && <p className="hs-error" role="alert">{saveError}</p>}

      <div className="hs-id">
        <div className="hs-id-text">
          <span className="eyebrow">{t('home.friendId')}</span>
          <code className="hs-id-code" title={user.id}>{shortId}</code>
        </div>
        <button
          type="button"
          className={`btn btn-sm btn-secondary${copied ? ' hs-copied' : ''}`}
          onClick={handleCopyId}
          aria-label={t('home.copyId')}
        >
          {copied ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              {t('home.copied')}
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="3" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
              {t('home.copy')}
            </>
          )}
        </button>
        <span className="sr-only" aria-live="polite">{copied ? t('home.idCopied') : ''}</span>
      </div>
    </section>
  );
}
