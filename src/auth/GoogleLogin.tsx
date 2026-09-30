import { useState, type FormEvent } from 'react';
import { LegalLinks } from '../legal/LegalPage';
import { FirebaseError } from 'firebase/app';
import { useAuth } from './authContext';
import { isFirebaseConfigured } from '../config/firebase';
import { AuthBackdrop, AuthBrand } from './AuthChrome';
import { t, tr } from '../i18n';
import './Auth.css';

type Mode = 'login' | 'register';

function mapFirebaseError(error: unknown): string | null {
  if (!(error instanceof FirebaseError)) return t('auth.errUnknown');

  switch (error.code) {
    case 'auth/invalid-email':
      return t('auth.errInvalidEmail');
    case 'auth/email-already-in-use':
      return t('auth.errEmailInUse');
    case 'auth/weak-password':
      return t('auth.errWeakPassword');
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return t('auth.errWrongCredentials');
    case 'auth/too-many-requests':
      return t('auth.errTooMany');
    case 'auth/configuration-not-found':
      return null; // handled separately via dev bypass
    default:
      return t('auth.errGeneric');
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

  const ctaLabel = loading
    ? (mode === 'login' ? t('auth.loggingIn') : t('auth.registering'))
    : (mode === 'login' ? t('auth.login') : t('auth.createAccount'));

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
      setError(t('auth.errNoFirebase'));
      return;
    }

    if (!email.trim()) {
      setError(t('auth.enterEmail'));
      return;
    }
    if (!password) {
      setError(t('auth.enterPassword'));
      return;
    }
    if (mode === 'register' && nickname.trim().length < 3) {
      setError(t('auth.nicknameShort'));
      return;
    }

    setError('');
    setInfo('');
    setLoading(true);

    try {
      if (mode === 'register') {
        await register(email.trim(), password, nickname.trim());
        setInfo(t('auth.verifySent'));
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
      setInfo(t('auth.verifyResent'));
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
            <h1 className="auth-title">{t('auth.verifyTitle')}</h1>
            <p className="auth-instruction">
              {tr('auth.verifyText', { email: <strong>{verifyEmail}</strong> })}
            </p>

            <div className="auth-actions">
              <button type="button" className="btn btn-primary btn-lg btn-block" onClick={handleCheckVerification} disabled={loading} aria-busy={loading}>
                {loading ? <><span className="spinner" aria-hidden="true" /> {t('auth.checking')}</> : t('auth.confirmed')}
              </button>
              <button type="button" className="btn btn-secondary btn-block" onClick={handleResendVerification} disabled={loading}>
                {t('auth.resend')}
              </button>
              <button type="button" className="btn btn-ghost btn-block" onClick={logout} disabled={loading}>
                {t('auth.logout')}
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
          <h1 className="sr-only">{mode === 'login' ? t('auth.login') : t('auth.register')}</h1>
          <div className="segmented auth-segmented" role="group" aria-label={t('auth.modeLabel')}>
            <button type="button" aria-pressed={mode === 'login'} onClick={() => switchMode('login')} disabled={loading}>
              {t('auth.login')}
            </button>
            <button type="button" aria-pressed={mode === 'register'} onClick={() => switchMode('register')} disabled={loading}>
              {t('auth.newHere')}
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {mode === 'register' && (
              <div className="field fade-in">
                <label className="field-label" htmlFor="auth-nickname">{t('auth.nickname')}</label>
                <input
                  id="auth-nickname"
                  type="text"
                  placeholder={t('auth.nicknamePlaceholder')}
                  autoComplete="nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </div>
            )}

            <div className="field">
              <label className="field-label" htmlFor="auth-email">{t('auth.email')}</label>
              <input
                id="auth-email"
                type="email"
                inputMode="email"
                placeholder={t('auth.emailPlaceholder')}
                autoComplete="email"
                autoCapitalize="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="auth-password">{t('auth.password')}</label>
              <input
                id="auth-password"
                type="password"
                placeholder={mode === 'register' ? t('auth.passwordNewPlaceholder') : t('auth.passwordPlaceholder')}
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
            {t('auth.demo')}
          </button>
          <p className="auth-demo-hint">{t('auth.demoHint')}</p>
        </div>
        <LegalLinks className="auth-legal" />
      </main>
    </div>
  );
}
