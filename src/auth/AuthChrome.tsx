import type { CSSProperties, ReactNode } from 'react';
import { BEERS } from '../domain/beers';
import { t } from '../i18n';

/**
 * Shared chrome for the full-screen auth flows (login, onboarding, reset):
 * atmospheric backdrop with rising "bubbles" in the beer colours + wordmark.
 */

// Deterministic pseudo-random layout so renders stay pure.
const BUBBLES = BEERS.flatMap((beer, i) => [0, 1].map((k) => {
  const seed = (i * 7 + k * 13) % 23;
  return {
    key: `${beer.id}-${k}`,
    color: beer.color,
    left: ((i * 37 + k * 53) % 100),
    size: 6 + (seed % 5) * 4,
    delay: -((i * 3.1 + k * 5.7) % 18),
    duration: 16 + (seed % 7) * 2,
  };
}));

export function AuthBackdrop() {
  return (
    <div className="auth-backdrop" aria-hidden="true">
      {BUBBLES.map((b) => (
        <span
          key={b.key}
          className="auth-bubble"
          style={{
            '--bubble-color': b.color,
            left: `${b.left}%`,
            width: b.size,
            height: b.size,
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.duration}s`,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}

export function AuthBrand({ compact = false, claim = true }: { compact?: boolean; claim?: boolean }) {
  return (
    <header className={`auth-brand${compact ? ' compact' : ''}`}>
      <span className="auth-logo" aria-hidden="true">
        <svg viewBox="0 0 48 48" width="100%" height="100%">
          <path d="M12 16h20v20a6 6 0 0 1-6 6h-8a6 6 0 0 1-6-6V16z" fill="currentColor" opacity="0.95" />
          <path d="M32 20h3a5 5 0 0 1 0 10h-3" fill="none" stroke="currentColor" strokeWidth="3.2" />
          <path d="M11 17c-2-5 3-9 7-7 2-4 9-4 11 0 4-1 7 3 5 7z" fill="currentColor" opacity="0.55" />
          <path d="M18 23v12M24 23v12" stroke="var(--c-accent)" strokeWidth="2.4" strokeLinecap="round" opacity="0.55" />
        </svg>
      </span>
      <p className="auth-wordmark">{t('common.brand')}</p>
      {claim && <p className="auth-claim">{t('auth.claim')}</p>}
    </header>
  );
}

export type GpsPhase = 'first' | 'wait' | 'second';

/** Progress indicator while two GPS samples are taken. */
export function GpsProgress({ phase, intervalMs }: { phase: GpsPhase; intervalMs: number }) {
  const width = phase === 'first' ? '18%' : phase === 'wait' ? '85%' : '96%';
  const duration = phase === 'wait' ? intervalMs : 900;
  const text: Record<GpsPhase, ReactNode> = {
    first: t('auth.gpsFirst'),
    wait: t('auth.gpsWait'),
    second: t('auth.gpsSecond'),
  };
  return (
    <div className="gps-progress" role="status" aria-live="polite">
      <div className="gps-radar" aria-hidden="true"><span /><span /><span /></div>
      <div className="bar gps-bar">
        <span style={{ width, transitionDuration: `${duration}ms` }} />
      </div>
      <p className="gps-text">{text[phase]}</p>
    </div>
  );
}
