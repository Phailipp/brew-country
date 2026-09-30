/**
 * Minimal crash reporting without a third party: uncaught errors, unhandled
 * promise rejections and React render errors of signed-in players are written
 * to `bc_clientErrors` (create-only, admin-readable, no user id, no location).
 * At most a few reports per session, so a crash loop cannot run up costs.
 */
import { addDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import { getFirebaseAuth } from '../config/firebaseAuth';
import { getFirestoreDb } from '../config/firestore';

const MAX_REPORTS_PER_SESSION = 5;
let sent = 0;
const seen = new Set<string>();

type Kind = 'error' | 'rejection' | 'render';

async function report(kind: Kind, message: string, stack?: string): Promise<void> {
  const key = `${kind}:${message}`;
  if (sent >= MAX_REPORTS_PER_SESSION || seen.has(key)) return;
  seen.add(key);
  sent++;
  try {
    if (!getFirebaseAuth().currentUser) return; // rules require a signed-in player
    await addDoc(collection(getFirestoreDb(), 'bc_clientErrors'), {
      kind,
      message: message.slice(0, 500),
      stack: (stack ?? '').slice(0, 4000),
      version: __APP_VERSION__.slice(0, 40),
      ua: navigator.userAgent.slice(0, 200),
      at: serverTimestamp(),
      // deleted by a Firestore TTL policy
      expiresAt: Timestamp.fromMillis(Date.now() + 30 * 86_400_000),
    });
  } catch {
    // reporting must never throw
  }
}

export function installErrorReporting(enabled: boolean): void {
  if (!enabled) return;
  window.addEventListener('error', (e) => { void report('error', String(e.message), e.error?.stack); });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason as { message?: string; stack?: string } | undefined;
    void report('rejection', String(r?.message ?? e.reason), r?.stack);
  });
  window.addEventListener('bc:ui-error', (e) => {
    const d = (e as CustomEvent<{ message: string; stack?: string }>).detail;
    void report('render', d.message, d.stack);
  });
}
