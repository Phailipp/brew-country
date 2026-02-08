import { useState, useMemo, useRef, useCallback } from 'react';
import type { SharePayload } from '../domain/types';
import { encodeShareLink } from '../domain/shareLink';
import { generateShareCard, downloadShareCard } from '../domain/shareCard';
import './ShareModal.css';

interface Props {
  payload: SharePayload;
  onClose: () => void;
}

export function ShareModal({ payload, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const link = useMemo(() => encodeShareLink(payload), [payload]);
  const cardDataUrl = useMemo(() => generateShareCard(payload), [payload]);

  const handleCopy = useCallback(() => {
    // Use modern clipboard API with fallback for iOS/WKWebView
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(link).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {
        fallbackCopy();
      });
    } else {
      fallbackCopy();
    }

    function fallbackCopy() {
      const el = inputRef.current;
      if (el) {
        el.select();
        el.setSelectionRange(0, el.value.length);
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  }, [link]);

  const handleDownload = useCallback(() => {
    downloadShareCard(payload);
  }, [payload]);

  return (
    <div className="share-overlay" onClick={onClose}>
      <div className="share-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Region teilen</h2>
        <p className="share-subtitle">{payload.beerName} &mdash; {payload.cellCount} Zellen</p>

        <img src={cardDataUrl} alt="Share card preview" className="share-preview" />

        <div className="share-link-row">
          <input
            ref={inputRef}
            className="share-link-input"
            value={link}
            readOnly
            onClick={() => inputRef.current?.select()}
          />
          <button
            className={`share-btn share-btn-copy${copied ? ' copied' : ''}`}
            onClick={handleCopy}
          >
            {copied ? '\u2713 Kopiert' : 'Kopieren'}
          </button>
        </div>

        <div className="share-actions">
          <button className="share-btn share-btn-download" onClick={handleDownload}>
            Bild speichern
          </button>
          <button className="share-btn share-btn-close" onClick={onClose}>
            Schlie&szlig;en
          </button>
        </div>
      </div>
    </div>
  );
}
