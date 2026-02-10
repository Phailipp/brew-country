import { useEffect, useState } from 'react';
import { GoogleAuthProvider, signInWithRedirect } from 'firebase/auth';
import { getFirebaseAuth } from '../config/firebaseAuth';
import { isFirebaseConfigured } from '../config/firebase';
import './Auth.css';

/**
 * Dedicated redirect-start screen.
 * Triggered via URL hash to avoid popup-related click handling issues.
 */
export function GoogleRedirectStart() {
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setError('Firebase ist nicht konfiguriert. Google-Login ist nicht verfügbar.');
      return;
    }

    const start = async () => {
      try {
        const auth = getFirebaseAuth();
        const provider = new GoogleAuthProvider();
        await signInWithRedirect(auth, provider);
      } catch {
        setError('Google-Weiterleitung fehlgeschlagen. Bitte erneut versuchen.');
      }
    };

    start();
  }, []);

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1 className="auth-title">Google-Anmeldung</h1>
        <p className="auth-subtitle">Du wirst zu Google weitergeleitet …</p>
        {error && <p className="auth-error">{error}</p>}
        <a className="auth-btn-secondary" href={window.location.pathname}>
          Zurück zum Login
        </a>
      </div>
    </div>
  );
}
