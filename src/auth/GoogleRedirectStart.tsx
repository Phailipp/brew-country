import { useState } from 'react';
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
  const [loading, setLoading] = useState(false);

  const handleStartRedirect = async () => {
    if (!isFirebaseConfigured()) {
      setError('Firebase ist nicht konfiguriert. Google-Login ist nicht verfügbar.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const auth = getFirebaseAuth();
      const provider = new GoogleAuthProvider();
      await signInWithRedirect(auth, provider);
    } catch {
      setLoading(false);
      setError('Google-Weiterleitung fehlgeschlagen. Bitte erneut versuchen.');
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1 className="auth-title">Google-Anmeldung</h1>
        <p className="auth-subtitle">Starte die Weiterleitung zu Google.</p>
        <button className="auth-btn" onClick={handleStartRedirect} disabled={loading}>
          {loading ? 'Weiterleitung…' : 'Weiter zu Google'}
        </button>
        {error && <p className="auth-error">{error}</p>}
        <a className="auth-btn-secondary" href="#">
          Zurück zum Login
        </a>
      </div>
    </div>
  );
}
