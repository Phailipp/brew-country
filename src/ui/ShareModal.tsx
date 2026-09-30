import { useState, useMemo, useRef, useCallback, useEffect, type CSSProperties } from 'react';
import type { SharePayload } from '../domain/types';
import { encodeShareLink } from '../domain/shareLink';
import { downloadShareCard } from '../domain/shareCard';
import { BeerBadge } from './kit/BeerBadge';
import { beerColor } from './kit/beer';
import { haptic } from './kit/haptics';
import { fmtNumber, fmtPercent, t, tr } from '../i18n';
import './ShareModal.css';

interface Props {
  payload: SharePayload;
  onClose: () => void;
}

export function ShareModal({ payload, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const link = useMemo(() => encodeShareLink(payload), [payload]);
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const shareText = t('share.text', { beer: payload.beerName });
  const margin = fmtPercent(Math.round(payload.avgMargin * 100) / 100);

  // Focus management + ESC to close + simple focus trap
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input, [href], [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  const markCopied = useCallback(() => {
    setCopied(true);
    haptic('success');
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleCopy = useCallback(() => {
    const fallbackCopy = () => {
      const el = inputRef.current;
      if (el) {
        el.select();
        el.setSelectionRange(0, el.value.length);
        document.execCommand('copy');
        markCopied();
      }
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(link).then(markCopied).catch(fallbackCopy);
    } else {
      fallbackCopy();
    }
  }, [link, markCopied]);

  const handleShare = useCallback(async () => {
    haptic('light');
    if (!canNativeShare) {
      handleCopy();
      return;
    }
    try {
      await navigator.share({ title: 'Brew Country', text: shareText, url: link });
    } catch (e) {
      // User cancelled → nothing to do; other errors → copy as fallback
      if (!(e instanceof DOMException && e.name === 'AbortError')) handleCopy();
    }
  }, [canNativeShare, handleCopy, link, shareText]);

  const handleDownload = useCallback(() => {
    haptic('light');
    downloadShareCard(payload, {
      subtitle: t('share.cardSubtitle'),
      stats: t('share.cardStats', { cells: payload.cellCount, votes: payload.totalVotes, margin }),
      rival: payload.runnerUpName ? t('share.cardRival', { name: payload.runnerUpName }) : null,
    });
  }, [payload, margin]);

  return (
    <div className="share-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="share-sheet glass"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="share-grabber" aria-hidden="true" />
        <div className="share-head">
          <h2 id="share-title" className="share-title">{t('share.title')}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('common.close')}>
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
          </button>
        </div>

        <figure
          className="share-card"
          style={{ '--share-color': beerColor(payload.beerId) } as CSSProperties}
          aria-label={t('share.preview', { beer: payload.beerName })}
        >
          <div className="share-card-glow" aria-hidden="true" />
          <span className="share-card-brand">{t('common.brand')}</span>
          <BeerBadge beerId={payload.beerId} size="xl" className="share-card-badge" />
          <p className="share-card-claim">
            {tr('share.rules', { beer: <span className="share-card-beer">{payload.beerName}</span> })}
          </p>
          <dl className="share-card-stats">
            <div>
              <dt>{t('share.cells')}</dt>
              <dd className="num">{fmtNumber(payload.cellCount)}</dd>
            </div>
            <div>
              <dt>{t('share.votes')}</dt>
              <dd className="num">{fmtNumber(payload.totalVotes)}</dd>
            </div>
            <div>
              <dt>{t('share.lead')}</dt>
              <dd className="num">{margin}</dd>
            </div>
          </dl>
          {payload.runnerUpName && (
            <p className="share-card-rival">{t('share.rival', { name: payload.runnerUpName })}</p>
          )}
        </figure>

        <div className="share-actions">
          <button type="button" className="btn btn-primary btn-lg btn-block" onClick={handleShare}>
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            {canNativeShare ? t('share.share') : t('share.shareLink')}
          </button>
          <div className="share-actions-row">
            <button type="button" className={`btn btn-secondary${copied ? ' share-copied' : ''}`} onClick={handleCopy}>
              {copied ? t('share.copiedButton') : t('share.copy')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleDownload}>
              {t('share.saveImage')}
            </button>
          </div>
          <span className="sr-only" aria-live="polite">{copied ? t('share.copied') : ''}</span>
        </div>

        <label htmlFor="share-link" className="sr-only">{t('share.linkLabel')}</label>
        <input
          id="share-link"
          ref={inputRef}
          type="text"
          className="share-link"
          value={link}
          readOnly
          onFocus={(e) => e.currentTarget.select()}
        />
      </div>
    </div>
  );
}
