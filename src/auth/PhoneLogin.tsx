import { useState } from 'react';
import { useAuth } from './AuthProvider';
import './Auth.css';

/**
 * Phone number input screen.
 * Uses local anonymous auth — generates a deterministic userId from the phone number.
 * Firebase is used only for Firestore (friends, chat, presence), not for authentication.
 */
export function PhoneLogin() {
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const handleLogin = () => {
    if (!phone || phone.length < 6) {
      setError('Bitte gültige Telefonnummer eingeben');
      return;
    }
    setError('');

    // Generate a deterministic userId from the phone number
    const userId = 'user_' + phone.replace(/\D/g, '').slice(-8);
    login(userId, phone);
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1 className="auth-title">Brew Country</h1>
        <p className="auth-subtitle">Bier-Dominanz-Karte</p>

        <p className="auth-instruction">
          Melde dich mit deiner Telefonnummer an — deine Nummer ist deine ID.
        </p>
        <div className="auth-input-group">
          <input
            type="tel"
            className="auth-input"
            placeholder="+49 170 1234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
        </div>
        {error && <p className="auth-error">{error}</p>}
        <button className="auth-btn" onClick={handleLogin}>
          Anmelden
        </button>
      </div>
    </div>
  );
}
