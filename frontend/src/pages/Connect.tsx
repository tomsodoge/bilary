import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const GMAIL_IMAP = 'imap.gmail.com';
const TONLINE_IMAP = 'secureimap.t-online.de';

const Connect: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { connect, removeAccount, checkStatus, accounts, loading, error } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    imapServer: GMAIL_IMAP,
  });
  const [successMessage, setSuccessMessage] = useState('');
  const [googleError, setGoogleError] = useState('');
  const [removingId, setRemovingId] = useState<number | null>(null);

  const isGmail = (email: string) =>
    /@(gmail|googlemail)\.com$/i.test(email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage('');
    try {
      await connect(formData.email, formData.password, formData.imapServer);
      setSuccessMessage('Postfach verbunden. Weiterleitung zum Dashboard...');
      setFormData({ email: '', password: '', imapServer: GMAIL_IMAP });
      // Redirect to dashboard after successful connection using React Router
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } catch {
      // error from useAuth
    }
  };

  const handleEmailChange = (email: string) => {
    const imapServer = isGmail(email)
      ? GMAIL_IMAP
      : email.includes('@t-online.de')
        ? TONLINE_IMAP
        : formData.imapServer;
    setFormData((prev) => ({ ...prev, email, imapServer }));
  };

  const handleRemove = async (userId: number) => {
    try {
      setRemovingId(userId);
      await removeAccount(userId);
    } finally {
      setRemovingId(null);
    }
  };

  // Nach Google-OAuth-Redirect: Erfolg/Misserfolg anzeigen und Status neu laden
  useEffect(() => {
    const googleParam = searchParams.get('google');

    if (googleParam === 'success') {
      setSearchParams({}, { replace: true });
      setGoogleError('');
      setSuccessMessage('Google-Konto verbunden.');
      checkStatus();
    } else if (googleParam === 'not_configured') {
      setSearchParams({}, { replace: true });
      setSuccessMessage('');
      setGoogleError(
        'Google-Login ist noch nicht konfiguriert. Bitte GOOGLE_CLIENT_ID und GOOGLE_CLIENT_SECRET im Backend (.env) setzen.'
      );
    }
  }, [searchParams, setSearchParams, checkStatus]);

  // Get API base URL; force HTTPS when page is loaded over HTTPS (Mixed Content)
  const rawApiBase = import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.DEV ? 'http://localhost:8000' : '');
  const apiBase = (typeof window !== 'undefined' && window.location?.protocol === 'https:' && rawApiBase.startsWith('http://'))
    ? rawApiBase.replace(/^http:\/\//i, 'https://') : rawApiBase;

  const handleGoogleSignIn = () => {
    setGoogleError('');
    setSuccessMessage('');

    if (!apiBase) {
      setGoogleError('API-URL ist nicht konfiguriert. Bitte VITE_API_BASE_URL setzen.');
      return;
    }

    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const url = `${apiBase}/api/auth/google?mode=popup`;
    const features = `width=${width},height=${height},left=${left},top=${top}`;

    const popup = window.open(url, 'google-oauth', features);

    if (!popup) {
      // Fallback: voller Redirect, wenn der Browser Popups blockiert
      window.location.href = `${apiBase}/api/auth/google`;
    }
  };

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      // Accept messages from same origin or from backend domain (for OAuth popup)
      const allowedOrigins = [
        window.location.origin,
        apiBase ? new URL(apiBase).origin : null
      ].filter(Boolean);

      if (!allowedOrigins.includes(event.origin)) return;

      if (event.data === 'google-auth-success') {
        setGoogleError('');
        setSuccessMessage('Google-Konto verbunden.');
        checkStatus();
      } else if (event.data === 'google-auth-error-not-configured') {
        setSuccessMessage('');
        setGoogleError(
          'Google-Login ist noch nicht konfiguriert. Bitte GOOGLE_CLIENT_ID und GOOGLE_CLIENT_SECRET im Backend (.env) setzen.'
        );
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [checkStatus, apiBase]);

  return (
    <div className="page-container">
      <div className="connect-page">
        <div className="connect-card">
          <h1>{accounts.length > 0 ? 'Weiteres Postfach hinzufügen' : 'E-Mail verbinden'}</h1>
          <p className="subtitle">
            Gmail und andere IMAP-Postfächer verbinden, um Rechnungen zu importieren.
          </p>

          {accounts.length > 0 && (
            <div className="connected-accounts">
              <h3>Verbundene Postfächer</h3>
              <ul className="account-list">
                {accounts.map((acc) => (
                  <li key={acc.id} className="account-item">
                    <span className="account-email">{acc.email}</span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleRemove(acc.id)}
                      disabled={removingId !== null}
                    >
                      {removingId === acc.id ? 'Entfernen…' : 'Entfernen'}
                    </button>
                  </li>
                ))}
              </ul>
              <p className="account-hint">Sync holt Rechnungen aus allen verbundenen Postfächern.</p>
            </div>
          )}

          <div className="connect-divider">
            <span>oder mit Google anmelden</span>
          </div>
          <div className="google-signin-row">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="btn-google"
            >
              <svg className="btn-google-icon" viewBox="0 0 24 24" width="20" height="20">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Mit Google anmelden
            </button>
          </div>

          <div className="connect-divider">
            <span>oder mit E-Mail und Passwort</span>
          </div>

          <form onSubmit={handleSubmit} className="connect-form">
            <div className="form-group">
              <label htmlFor="email">E-Mail-Adresse</label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => handleEmailChange(e.target.value)}
                placeholder="name@gmail.com"
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Passwort</label>
              <input
                type="password"
                id="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={isGmail(formData.email) ? 'App-Passwort (nicht dein Gmail-Passwort)' : 'Passwort'}
                required
                disabled={loading}
              />
              {isGmail(formData.email) && (
                <small className="gmail-hint">
                  Gmail: App-Passwort unter Google-Konto → Sicherheit → 2-Faktor-Aktivierung → App-Passwörter verwenden.
                </small>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="imap-server">IMAP-Server</label>
              <input
                type="text"
                id="imap-server"
                value={formData.imapServer}
                onChange={(e) => setFormData({ ...formData, imapServer: e.target.value })}
                placeholder="imap.gmail.com"
                required
                disabled={loading}
              />
              <small>Für Gmail und T-Online automatisch gesetzt.</small>
            </div>

            {error && <div className="error-message">{error}</div>}
            {googleError && <div className="error-message">{googleError}</div>}
            {successMessage && <div className="success-message">{successMessage}</div>}

            <div className="connect-actions">
              <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                {loading ? 'Verbinde…' : 'Postfach bestätigen'}
              </button>
            </div>
          </form>

          <div className="info-box">
            <h3>Hinweis</h3>
            <p>
              Zugangsdaten werden verschlüsselt gespeichert und nur für den IMAP-Zugriff zum Abruf von Rechnungs-E-Mails genutzt.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Connect;
