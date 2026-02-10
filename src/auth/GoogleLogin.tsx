import { useState } from 'react';
import { GoogleAuthProvider, signInWithRedirect } from 'firebase/auth';
import { isFirebaseConfigured } from '../config/firebase';
import { getFirebaseAuth } from '../config/firebaseAuth';
import './Auth.css';

/**
 * Google OAuth login screen.
 */
export function GoogleLogin() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
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
      // Redirect leaves the page; login is completed via onAuthStateChanged in AuthProvider.
    } catch {
      setError('Google-Login fehlgeschlagen. Bitte versuche es erneut.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1 className="auth-title">Brew Country</h1>
        <p className="auth-subtitle">Bier-Dominanz-Karte</p>

        <p className="auth-instruction">
          Melde dich mit deinem Google-Konto an. Der Login öffnet keinen Popup-Dialog,
          sondern leitet dich kurz zu Google weiter.
        </p>

        {error && <p className="auth-error">{error}</p>}

        <button className="auth-btn" onClick={handleGoogleLogin} disabled={loading}>
          {loading ? 'Anmeldung läuft...' : 'Mit Google anmelden'}
        </button>
      </div>
    </div>
  );
}
