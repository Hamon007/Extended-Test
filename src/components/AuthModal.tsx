import React, { useState, useEffect } from 'react';
import { AuthService } from '../services/AuthService';
import { SaveService } from '../services/SaveService';
import type { User } from '@supabase/supabase-js';
import './AuthModal.css';

interface AuthModalProps {
  onClose: () => void;
}

type Tab = 'login' | 'register';

const AuthModal: React.FC<AuthModalProps> = ({ onClose }) => {
  const [user, setUser]         = useState<User | null>(() => AuthService.user);
  const [tab, setTab]           = useState<Tab>('login');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [info, setInfo]         = useState('');
  const [loading, setLoading]   = useState(false);

  useEffect(() => AuthService.subscribe(u => setUser(u)), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    if (tab === 'register') {
      const err = await AuthService.register(email, password);
      setLoading(false);
      if (err) { setError(err); return; }
      setInfo('Konto erstellt! Bitte E-Mail bestätigen, dann anmelden.');
      setTab('login');
      return;
    }

    const err = await AuthService.login(email, password);
    setLoading(false);
    if (err) { setError(err); return; }

    // Sync cloud save after login
    setInfo('Synchronisiere …');
    try {
      const wasNewer = await SaveService.downloadSave();
      if (wasNewer) {
        setInfo('Cloud-Spielstand geladen! Lade Spiel neu …');
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setInfo('Spielstand gespeichert ✓');
        setTimeout(() => { setInfo(''); onClose(); }, 1500);
      }
    } catch (e) {
      setError('Sync fehlgeschlagen – bitte erneut versuchen.');
    }
  };

  const handleLogout = async () => {
    await AuthService.logout();
  };

  const switchTab = (t: Tab) => { setTab(t); setError(''); setInfo(''); };

  return (
    <div className="auth-modal__overlay" onClick={onClose}>
      <div className="auth-modal" onClick={e => e.stopPropagation()}>
        <button className="auth-modal__close" onClick={onClose} aria-label="Schließen">✕</button>

        <div className="auth-modal__header">
          <span className="auth-modal__icon">⚔️</span>
          <h2 className="auth-modal__title">Konto</h2>
          <p className="auth-modal__subtitle">Spielstand geräteübergreifend speichern</p>
        </div>

        {user ? (
          <div className="auth-modal__profile">
            <div className="auth-modal__profile-avatar">👤</div>
            <p className="auth-modal__profile-email">{user.email}</p>
            <p className="auth-modal__profile-hint">
              Dein Spielstand wird bei jeder Aktion automatisch synchronisiert.
            </p>
            <button
              className="auth-modal__btn auth-modal__btn--outline"
              onClick={handleLogout}
            >
              Abmelden
            </button>
          </div>
        ) : !AuthService.isAvailable ? (
          <p className="auth-modal__unavailable">
            Cloud-Speicherung ist noch nicht konfiguriert.
          </p>
        ) : (
          <>
            <div className="auth-modal__tabs">
              <button
                className={`auth-modal__tab${tab === 'login' ? ' auth-modal__tab--active' : ''}`}
                onClick={() => switchTab('login')}
              >Anmelden</button>
              <button
                className={`auth-modal__tab${tab === 'register' ? ' auth-modal__tab--active' : ''}`}
                onClick={() => switchTab('register')}
              >Registrieren</button>
            </div>

            <form className="auth-modal__form" onSubmit={handleSubmit}>
              <input
                className="auth-modal__input"
                type="email"
                placeholder="E-Mail"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <input
                className="auth-modal__input"
                type="password"
                placeholder="Passwort (min. 6 Zeichen)"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              />
              {error && <p className="auth-modal__error">{error}</p>}
              {info  && <p className="auth-modal__info">{info}</p>}
              <button className="auth-modal__btn" type="submit" disabled={loading}>
                {loading ? '…' : tab === 'login' ? 'Anmelden' : 'Konto erstellen'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthModal;
