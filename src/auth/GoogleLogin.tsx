import { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useAuth } from './AuthProvider';
import { isFirebaseConfigured } from '../config/firebase';
import { getFirebaseAuth } from '../config/firebaseAuth';
import './Auth.css';

/**
 * Google OAuth login screen.
 */
export function GoogleLogin() {
  const { login } = useAuth();
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
      const result = await signInWithPopup(auth, provider);
      login(result.user.uid);
    } catch {
      setError('Google-Login fehlgeschlagen. Bitte Popup erlauben und erneut versuchen.');
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
          Melde dich mit deinem Google-Konto an.
        </p>

        {error && <p className="auth-error">{error}</p>}

        <button className="auth-btn" onClick={handleGoogleLogin} disabled={loading}>
          {loading ? 'Anmeldung läuft...' : 'Mit Google anmelden'}
        </button>
      </div>
    </div>
  );
}
