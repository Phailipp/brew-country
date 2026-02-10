import './Auth.css';

/**
 * Google OAuth login screen.
 */
export function GoogleLogin() {
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1 className="auth-title">Brew Country</h1>
        <p className="auth-subtitle">Bier-Dominanz-Karte</p>

        <p className="auth-instruction">
          Melde dich mit deinem Google-Konto an. Der Login startet über eine eigene
          Weiterleitungsseite statt über ein Browser-Popup.
        </p>

        <a className="auth-btn" href="#google-login-start">
          Mit Google anmelden
        </a>
      </div>
    </div>
  );
}
