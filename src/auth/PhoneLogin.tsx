import { useState } from 'react';
import { isFirebaseConfigured } from '../config/firebase';
import { useAuth } from './AuthProvider';
import './Auth.css';

/**
 * Phone number input + OTP verification screen.
 * When Firebase is not configured, uses a local anonymous auth.
 */
export function PhoneLogin() {
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [error, setError] = useState('');
  const firebaseReady = isFirebaseConfigured();

  const handleSendOTP = () => {
    if (!phone || phone.length < 6) {
      setError('Bitte gültige Telefonnummer eingeben');
      return;
    }
    setError('');

    if (firebaseReady) {
      // Firebase Phone Auth would go here:
      // signInWithPhoneNumber(auth, phone, recaptchaVerifier)
      setStep('otp');
    } else {
      // Local dev: skip OTP, generate a userId from phone
      const userId = 'local_' + phone.replace(/\D/g, '').slice(-8);
      login(userId, phone);
    }
  };

  const handleVerifyOTP = () => {
    if (!otp || otp.length < 4) {
      setError('Bitte OTP-Code eingeben');
      return;
    }
    setError('');

    if (firebaseReady) {
      // Firebase: confirmationResult.confirm(otp)
      // On success: login(result.user.uid, phone)
      setError('Firebase nicht konfiguriert. Bitte config/firebase.ts anpassen.');
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1 className="auth-title">Brew Country</h1>
        <p className="auth-subtitle">Bier-Dominanz-Karte</p>

        {step === 'phone' ? (
          <>
            <p className="auth-instruction">
              Melde dich mit deiner Telefonnummer an — wie bei WhatsApp, kein Passwort nötig.
            </p>
            <div className="auth-input-group">
              <input
                type="tel"
                className="auth-input"
                placeholder="+49 170 1234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendOTP()}
              />
            </div>
            {error && <p className="auth-error">{error}</p>}
            <button className="auth-btn" onClick={handleSendOTP}>
              {firebaseReady ? 'Code senden' : 'Weiter (Dev-Modus)'}
            </button>
            {!firebaseReady && (
              <p className="auth-dev-note">
                Firebase nicht konfiguriert — lokaler Modus aktiv
              </p>
            )}
          </>
        ) : (
          <>
            <p className="auth-instruction">
              Code an <strong>{phone}</strong> gesendet. Bitte eingeben:
            </p>
            <div className="auth-input-group">
              <input
                type="text"
                className="auth-input"
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyOTP()}
              />
            </div>
            {error && <p className="auth-error">{error}</p>}
            <button className="auth-btn" onClick={handleVerifyOTP}>
              Bestätigen
            </button>
            <button className="auth-btn-secondary" onClick={() => setStep('phone')}>
              Zurück
            </button>
          </>
        )}
      </div>
    </div>
  );
}
