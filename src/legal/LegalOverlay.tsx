import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { LegalPage } from './LegalPage';
import { HowToPage } from './HowToPage';
import { HOWTO_HASH, legalDocFromHash, type LegalDoc } from './docs';
import { useLocale } from '../i18n';

/** Shows the legal pages (and the how-to) above whatever is on screen when the hash asks for one. */
export function LegalOverlay({ children }: { children: ReactNode }) {
  const [doc, setDoc] = useState<LegalDoc | null>(() => legalDocFromHash(window.location.hash));
  const [howTo, setHowTo] = useState(() => window.location.hash === HOWTO_HASH);
  // The legal pages sit above the app: follow language changes here too
  useLocale();

  useEffect(() => {
    const onHash = () => {
      setDoc(legalDocFromHash(window.location.hash));
      setHowTo(window.location.hash === HOWTO_HASH);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const close = useCallback(() => {
    // Drop the hash without adding a history entry
    history.replaceState(null, '', window.location.pathname + window.location.search);
    setDoc(null);
    setHowTo(false);
  }, []);

  return (
    <>
      {children}
      {doc && <LegalPage doc={doc} onClose={close} />}
      {howTo && <HowToPage onClose={close} />}
    </>
  );
}
