import { useEffect, useRef } from 'react';
import { OPERATOR } from '../config/legal';
import { LegalContent } from './content';
import { HOWTO_HASH, LEGAL_DOCS, legalTitle, type LegalDoc } from './docs';
import { t } from '../i18n';
import './LegalPage.css';

interface Props {
  doc: LegalDoc;
  onClose: () => void;
}

/** Full-screen legal text; reachable in and out of the app via #impressum etc. */
export function LegalPage({ doc, onClose }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doc, onClose]);

  return (
    <div className="legal" role="dialog" aria-modal="true" aria-labelledby="legal-title">
      <header className="legal-header">
        <button className="icon-btn" onClick={onClose} aria-label={t('common.back')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <h1 id="legal-title" ref={headingRef} tabIndex={-1}>{legalTitle(doc)}</h1>
      </header>
      <article className="legal-body">
        {!OPERATOR.configured && (
          <p className="legal-template" role="note">
            {t('legalLinks.template')}
          </p>
        )}
        <LegalContent doc={doc} />
        <nav className="legal-nav" aria-label={t('legalLinks.label')}>
          {LEGAL_DOCS.filter((d) => d !== doc).map((d) => (
            <a key={d} href={`#${d}`}>{legalTitle(d)}</a>
          ))}
        </nav>
      </article>
    </div>
  );
}

/** Small link row for login, onboarding and profile (how-to first). */
export function LegalLinks({ className = '' }: { className?: string }) {
  return (
    <nav className={`legal-links ${className}`.trim()} aria-label={t('legalLinks.label')}>
      <a href={HOWTO_HASH}>{t('howto.link')}</a>
      {LEGAL_DOCS.map((d) => <a key={d} href={`#${d}`}>{legalTitle(d)}</a>)}
    </nav>
  );
}
