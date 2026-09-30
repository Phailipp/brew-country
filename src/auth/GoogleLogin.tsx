import { useMemo, useState, type FormEvent } from 'react';
import { LegalLinks } from '../legal/LegalPage';
import { FirebaseError } from 'firebase/app';
import { useAuth } from './authContext';
import { isFirebaseConfigured } from '../config/firebase';
import { AuthBackdrop, AuthBrand } from './AuthChrome';
import './Auth.css';

type Mode = 'login' | 'register';

function mapFirebaseError(error: unknown): string | null {
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
    case 'auth/configuration-not-found':
      return null; // handled separately via dev bypass
    default:
      return 'Anmelden hat nicht geklappt. Versuch es gleich nochmal.';
  }
}

/**
 * E-Mail Login / Registrierung (ersetzt Google Login).
 */
export function GoogleLogin() {
  const { register, loginWithEmail, resendVerificationEmail, refreshVerificationStatus, auth, logout, login } = useAuth();
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
    if (loading) return mode === 'login' ? 'Melde an …' : 'Lege Konto an …';
    return mode === 'login' ? 'Anmelden' : 'Konto erstellen';
  }, [loading, mode]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError('');
    setInfo('');
  };

  const handleDevBypass = () => {
    login('dev_' + Math.random().toString(36).slice(2, 8));
  };

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!firebaseReady) {
      setError('Firebase ist nicht konfiguriert. Anmeldung ist nicht verfügbar.');
      return;
    }

    if (!email.trim()) {
      setError('Gib deine E-Mail-Adresse ein.');
      return;
    }
    if (!password) {
      setError('Gib dein Passwort ein.');
      return;
    }
    if (mode === 'register' && nickname.trim().length < 3) {
      setError('Dein Spitzname braucht mindestens 3 Zeichen.');
      return;
    }

    setError('');
    setInfo('');
    setLoading(true);

    try {
      if (mode === 'register') {
        await register(email.trim(), password, nickname.trim());
        setInfo('Fast geschafft! Wir haben dir eine Bestätigungs-Mail geschickt.');
      } else {
        await loginWithEmail(email.trim(), password);
      }
    } catch (e) {
      setError(mapFirebaseError(e) ?? '');
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
      setInfo('Neue Bestätigungs-Mail ist unterwegs.');
    } catch (e) {
      setError(mapFirebaseError(e) ?? '');
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
      setError(mapFirebaseError(e) ?? '');
    } finally {
      setLoading(false);
    }
  };

  if (isVerifyMode) {
    return (
      <div className="auth-screen">
        <AuthBackdrop />
        <main className="auth-wrap">
          <AuthBrand compact claim={false} />
          <div className="auth-card glass fade-in">
            <div className="auth-hero-icon" aria-hidden="true">✉️</div>
            <h1 className="auth-title">Check dein Postfach</h1>
            <p className="auth-instruction">
              Wir haben dir einen Bestätigungslink an <strong>{verifyEmail}</strong> geschickt.
              Tipp drauf und komm dann hierher zurück.
            </p>

            <div className="auth-actions">
              <button type="button" className="btn btn-primary btn-lg btn-block" onClick={handleCheckVerification} disabled={loading} aria-busy={loading}>
                {loading ? <><span className="spinner" aria-hidden="true" /> Prüfe …</> : 'Ich habe bestätigt'}
              </button>
              <button type="button" className="btn btn-secondary btn-block" onClick={handleResendVerification} disabled={loading}>
                Mail nochmal senden
              </button>
              <button type="button" className="btn btn-ghost btn-block" onClick={logout} disabled={loading}>
                Abmelden
              </button>
            </div>

            <div aria-live="polite">
              {info && <p className="auth-info">{info}</p>}
              {error && <p className="auth-error" role="alert">{error}</p>}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <AuthBackdrop />
      <main className="auth-wrap">
        <AuthBrand />

        <div className="auth-card glass fade-in">
          <h1 className="sr-only">{mode === 'login' ? 'Anmelden' : 'Registrieren'}</h1>
          <div className="segmented auth-segmented" role="group" aria-label="Anmelden oder registrieren">
            <button type="button" aria-pressed={mode === 'login'} onClick={() => switchMode('login')} disabled={loading}>
              Anmelden
            </button>
            <button type="button" aria-pressed={mode === 'register'} onClick={() => switchMode('register')} disabled={loading}>
              Neu hier
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {mode === 'register' && (
              <div className="field fade-in">
                <label className="field-label" htmlFor="auth-nickname">Spitzname</label>
                <input
                  id="auth-nickname"
                  type="text"
                  placeholder="z. B. HopfenHeld"
                  autoComplete="nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </div>
            )}

            <div className="field">
              <label className="field-label" htmlFor="auth-email">E-Mail</label>
              <input
                id="auth-email"
                type="email"
                inputMode="email"
                placeholder="du@beispiel.de"
                autoComplete="email"
                autoCapitalize="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="auth-password">Passwort</label>
              <input
                id="auth-password"
                type="password"
                placeholder={mode === 'register' ? 'Mindestens 6 Zeichen' : 'Dein Passwort'}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div aria-live="polite">
              {info && <p className="auth-info">{info}</p>}
              {error && <p className="auth-error" role="alert">{error}</p>}
            </div>

            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading} aria-busy={loading}>
              {loading && <span className="spinner" aria-hidden="true" />}
              {ctaLabel}
            </button>
          </form>
        </div>

        <div className="auth-demo">
          <button type="button" className="btn btn-ghost" onClick={handleDevBypass}>
            Demo ansehen (ohne Konto)
          </button>
          <p className="auth-demo-hint">Lokale Demo, nichts wird gespeichert</p>
        </div>
        <LegalLinks className="auth-legal" />
      </main>
    </div>
  );
}
