import { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { isFirebaseConfigured } from '../config/firebase';
import { getFirebaseAuth } from '../config/firebaseAuth';
import './Auth.css';

/**
 * Google OAuth login screen.
 */
export function GoogleLogin() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    if (!isFirebaseConfigured()) {
      setError('Firebase ist nicht konfiguriert. Google-Login ist nicht verfügbar.');
      return;
    }

    setLoading(true);
    setError('');

    const auth = getFirebaseAuth();
    const provider = new GoogleAuthProvider();

    try {
      await signInWithPopup(auth, provider);
    } catch (popupError) {
      try {
        await signInWithRedirect(auth, provider);
      } catch {
        console.error('Google login failed', popupError);
        setError('Google-Login fehlgeschlagen. Bitte erneut versuchen.');
        setLoading(false);
      }
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1 className="auth-title">Brew Country</h1>
        <p className="auth-subtitle">Bier-Dominanz-Karte</p>

        <p className="auth-instruction">Melde dich mit deinem Google-Konto an.</p>

        <button className="auth-btn" onClick={handleGoogleLogin} disabled={loading}>
          {loading ? 'Anmeldung läuft…' : 'Mit Google anmelden'}
        </button>
        {error && <p className="auth-error">{error}</p>}
      </div>
    </div>
  );
}
