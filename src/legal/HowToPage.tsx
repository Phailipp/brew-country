import { useEffect, useRef } from 'react';
import { CHECKIN_RADIUS_M, MAX_VISITS_PER_DAY } from '../domain/venues';
import { INFLUENCE, REGULAR_TIERS } from '../domain/influence';
import { t } from '../i18n';
import { LegalLinks } from './LegalPage';
import './LegalPage.css';

const STEPS = ['find', 'checkin', 'influence', 'map', 'collect', 'friends'] as const;

const tierMin = (tier: string) => REGULAR_TIERS.find((r) => r.tier === tier)?.min ?? 0;

/** Every number in the text comes from the rules themselves. */
function params() {
  return {
    prost: t('tabs.prost'),
    radius: CHECKIN_RADIUS_M,
    max: MAX_VISITS_PER_DAY,
    days: INFLUENCE.WINDOW_DAYS,
    visits: Math.round(INFLUENCE.PER_PLAYER_CAP / INFLUENCE.VISIT),
    lead: Math.round((INFLUENCE.HYSTERESIS - 1) * 100),
    regular: tierMin('regular'),
    table: tierMin('table'),
    fixture: tierMin('fixture'),
  };
}

/** "How it works", reachable via #anleitung from login, onboarding and profile. */
export function HowToPage({ onClose }: { onClose: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
    // Capture phase + stop: Escape closes only this page, not a sheet below it
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div className="legal" role="dialog" aria-modal="true" aria-labelledby="howto-title">
      <header className="legal-header">
        <button className="icon-btn" onClick={onClose} aria-label={t('common.back')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <h1 id="howto-title" ref={headingRef} tabIndex={-1}>{t('howto.title')}</h1>
      </header>
      <article className="legal-body">
        <p className="howto-lede">{t('howto.lede')}</p>
        {/* role: list-style none drops the list semantics in Safari/VoiceOver */}
        <ol className="howto-steps" role="list">
          {STEPS.map((s) => (
            <li key={s}>
              <h2>{t(`howto.steps.${s}.title`)}</h2>
              <p>{t(`howto.steps.${s}.text`, params())}</p>
            </li>
          ))}
        </ol>
        <p className="howto-fair" role="note">{t('howto.fair')}</p>
        <p className="muted howto-version">{t('howto.version', { version: __APP_VERSION__ })}</p>
        <LegalLinks withHowTo={false} />
      </article>
    </div>
  );
}
