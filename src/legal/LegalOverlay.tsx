import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { LegalPage } from './LegalPage';
import { legalDocFromHash, type LegalDoc } from './docs';
import { useLocale } from '../i18n';

/** Shows the legal pages above whatever is on screen when the hash asks for one. */
export function LegalOverlay({ children }: { children: ReactNode }) {
  const [doc, setDoc] = useState<LegalDoc | null>(() => legalDocFromHash(window.location.hash));
  // The legal pages sit above the app: follow language changes here too
  useLocale();

  useEffect(() => {
    const onHash = () => setDoc(legalDocFromHash(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const close = useCallback(() => {
    // Drop the hash without adding a history entry
    history.replaceState(null, '', window.location.pathname + window.location.search);
    setDoc(null);
  }, []);

  return (
    <>
      {children}
      {doc && <LegalPage doc={doc} onClose={close} />}
    </>
  );
}
