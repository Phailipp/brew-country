import { useEffect, useRef } from 'react';
import { CHECKIN_RADIUS_M, MAX_VISITS_PER_DAY } from '../domain/venues';
import { t } from '../i18n';
import { LegalLinks } from './LegalPage';
import './LegalPage.css';

const STEPS = ['find', 'checkin', 'influence', 'map', 'collect', 'friends'] as const;

/** "How it works", reachable via #anleitung from login, onboarding and profile. */
export function HowToPage({ onClose }: { onClose: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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
        <ol className="howto-steps">
          {STEPS.map((s) => (
            <li key={s}>
              <h2>{t(`howto.steps.${s}.title`)}</h2>
              <p>{t(`howto.steps.${s}.text`, { radius: CHECKIN_RADIUS_M, max: MAX_VISITS_PER_DAY })}</p>
            </li>
          ))}
        </ol>
        <p className="howto-fair" role="note">{t('howto.fair')}</p>
        <p className="muted howto-version">{t('howto.version', { version: __APP_VERSION__ })}</p>
        <LegalLinks />
      </article>
    </div>
  );
}
