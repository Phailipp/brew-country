import { useMemo, useState } from 'react';
import { FirebaseError } from 'firebase/app';
import { useAuth } from './AuthProvider';
import { isFirebaseConfigured } from '../config/firebase';
import './Auth.css';

type Mode = 'login' | 'register';

function mapFirebaseError(error: unknown): string {
  if (!(error instanceof FirebaseError)) return 'Unbekannter Fehler. Bitte erneut versuchen.';

  switch (error.code) {
    case 'auth/invalid-email':
      return 'Die E-Mail-Adresse ist ungültig.';
    case 'auth/email-already-in-use':
      return 'Diese E-Mail-Adresse wird bereits verwendet.';
    case 'auth/weak-password':
      return 'Das Passwort ist zu schwach (mindestens 6 Zeichen).';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'E-Mail oder Passwort ist falsch.';
    case 'auth/too-many-requests':
      return 'Zu viele Versuche. Bitte warte kurz und versuche es erneut.';
    default:
      return `Login fehlgeschlagen (${error.code}).`;
  }
}

/**
 * E-Mail Login / Registrierung (ersetzt Google Login).
 */
export function GoogleLogin() {
  const { register, loginWithEmail, resendVerificationEmail, refreshVerificationStatus, auth, logout } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const firebaseReady = isFirebaseConfigured();
  const isVerifyMode = auth.status === 'verify-email';
  const verifyEmail = auth.status === 'verify-email' ? auth.email : '';

  const ctaLabel = useMemo(() => {
    if (loading) return 'Bitte warten…';
    return mode === 'login' ? 'Anmelden' : 'Registrieren';
  }, [loading, mode]);

  const handleSubmit = async () => {
    if (!firebaseReady) {
      setError('Firebase ist nicht konfiguriert. Anmeldung ist nicht verfügbar.');
      return;
    }

    if (!email.trim()) {
      setError('Bitte eine E-Mail-Adresse eingeben.');
      return;
    }
    if (!password) {
      setError('Bitte ein Passwort eingeben.');
      return;
    }
    if (mode === 'register' && nickname.trim().length < 3) {
      setError('Der Nickname muss mindestens 3 Zeichen lang sein.');
      return;
    }

    setError('');
    setInfo('');
    setLoading(true);

    try {
      if (mode === 'register') {
        await register(email.trim(), password, nickname.trim());
        setInfo('Bestätigungs-E-Mail wurde gesendet. Bitte öffne dein Postfach.');
      } else {
        await loginWithEmail(email.trim(), password);
      }
    } catch (e) {
      setError(mapFirebaseError(e));
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setError('');
    setInfo('');
    setLoading(true);
    try {
      await resendVerificationEmail();
      setInfo('Bestätigungs-E-Mail wurde erneut gesendet.');
    } catch (e) {
      setError(mapFirebaseError(e));
    } finally {
      setLoading(false);
    }
  };

  const handleCheckVerification = async () => {
    setError('');
    setInfo('');
    setLoading(true);
    try {
      await refreshVerificationStatus();
    } catch (e) {
      setError(mapFirebaseError(e));
    } finally {
      setLoading(false);
    }
  };

  if (isVerifyMode) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h1 className="auth-title">E-Mail bestätigen</h1>
          <p className="auth-instruction">
            Wir haben eine Bestätigungs-E-Mail an <strong>{verifyEmail}</strong> gesendet.
            Bitte bestätige deine Adresse und klicke dann auf „Ich habe bestätigt“.
          </p>

          <button className="auth-btn" onClick={handleCheckVerification} disabled={loading}>
            {loading ? 'Prüfe…' : 'Ich habe bestätigt'}
          </button>
          <button className="auth-btn-secondary" onClick={handleResendVerification} disabled={loading}>
            E-Mail erneut senden
          </button>
          <button className="auth-btn-secondary" onClick={logout} disabled={loading}>
            Abmelden
          </button>

          {info && <p className="auth-instruction">{info}</p>}
          {error && <p className="auth-error">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1 className="auth-title">Brew Country</h1>
        <p className="auth-subtitle">Anmelden oder Registrieren</p>

        {mode === 'register' && (
          <div className="auth-input-group">
            <input
              className="auth-input"
              placeholder="Nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </div>
        )}

        <div className="auth-input-group">
          <input
            className="auth-input"
            type="email"
            placeholder="E-Mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="auth-input"
            type="password"
            placeholder="Passwort"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button className="auth-btn" onClick={handleSubmit} disabled={loading}>
          {ctaLabel}
        </button>

        <button
          className="auth-btn-secondary"
          onClick={() => {
            setMode((m) => (m === 'login' ? 'register' : 'login'));
            setError('');
            setInfo('');
          }}
          disabled={loading}
        >
          {mode === 'login' ? 'Neu hier? Jetzt registrieren' : 'Schon ein Konto? Jetzt anmelden'}
        </button>

        {info && <p className="auth-instruction">{info}</p>}
        {error && <p className="auth-error">{error}</p>}
      </div>
    </div>
  );
}
