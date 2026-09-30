import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { LegalPage } from './LegalPage';
import { HowToPage } from './HowToPage';
import { HOWTO_HASH, legalDocFromHash, type LegalDoc } from './docs';
import { useLocale } from '../i18n';

const isOverlayHash = (hash: string) => !!legalDocFromHash(hash) || hash === HOWTO_HASH;

/** How many overlay pages the app itself pushed onto the history (0 = opened by a deep link). */
function depthOf(state: unknown): number | null {
  const d = (state as { bcOverlay?: unknown } | null)?.bcOverlay;
  return typeof d === 'number' ? d : null;
}

/**
 * Shows the legal pages (and the how-to) above whatever is on screen when the
 * hash asks for one. Closing walks back through the pages the app opened, so
 * the browser/Android back button and the in-page back button agree; a page
 * opened by a deep link is closed in place instead of leaving the app.
 */
export function LegalOverlay({ children }: { children: ReactNode }) {
  const [hash, setHash] = useState(() => window.location.hash);
  // The legal pages sit above the app: follow language changes here too
  useLocale();

  const depth = useRef(0);
  // Where focus was before the overlay opened, so closing does not strand it
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const lastHash = { current: window.location.hash };
    if (isOverlayHash(window.location.hash)) history.replaceState({ ...(history.state ?? {}), bcOverlay: 0 }, '');

    const onHash = () => {
      const next = window.location.hash;
      if (isOverlayHash(next)) {
        const known = depthOf(history.state);
        if (known === null) {
          // A fresh entry pushed by a link inside the app
          if (depth.current === 0 && !isOverlayHash(lastHash.current)) {
            const active = document.activeElement;
            if (active instanceof HTMLElement && !active.closest('.legal')) returnFocus.current = active;
          }
          depth.current = isOverlayHash(lastHash.current) ? depth.current + 1 : 1;
          history.replaceState({ ...(history.state ?? {}), bcOverlay: depth.current }, '');
        } else {
          depth.current = known; // back/forward between overlay pages
        }
      } else {
        depth.current = 0;
        if (isOverlayHash(lastHash.current)) {
          const el = returnFocus.current;
          returnFocus.current = null;
          if (el?.isConnected) requestAnimationFrame(() => el.focus());
        }
      }
      lastHash.current = next;
      setHash(next);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const close = useCallback(() => {
    if (depth.current > 0) {
      history.back(); // the hashchange above updates the view
      return;
    }
    // Deep link: drop the hash without leaving the app
    history.replaceState(null, '', window.location.pathname + window.location.search);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }, []);

  const doc: LegalDoc | null = legalDocFromHash(hash);
  return (
    <>
      {children}
      {doc && <LegalPage doc={doc} onClose={close} />}
      {hash === HOWTO_HASH && <HowToPage onClose={close} />}
    </>
  );
}
