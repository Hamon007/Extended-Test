import React, { useState } from 'react';
import { DevModeService } from '../services/DevModeService';
import './SettingsScreen.css';


interface Props { onBack: () => void; }

const SettingsScreen: React.FC<Props> = ({ onBack }) => {
  const [devEnabled, setDevEnabled] = useState(() => DevModeService.isEnabled());
  const [password,   setPassword]   = useState('');
  const [showInput,  setShowInput]  = useState(false);
  const [error,      setError]      = useState(false);
  const [toast,      setToast]      = useState('');

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2400);
  }

  function handleActivate() {
    const ok = DevModeService.tryActivate(password);
    if (ok) {
      setDevEnabled(true);
      setShowInput(false);
      setPassword('');
      setError(false);
      showToast('Entwicklermodus aktiviert.');
    } else {
      setError(true);
      setPassword('');
    }
  }

  function handleDeactivate() {
    DevModeService.deactivate();
    setDevEnabled(false);
    showToast('Entwicklermodus deaktiviert.');
  }

  return (
    <div className="settings-screen">
      {toast && <div className="settings-toast">{toast}</div>}

      <div className="settings-header">
        <button className="settings-header__back" onClick={onBack}>← Zurück</button>
        <h1 className="settings-header__title">Einstellungen</h1>
        <div />
      </div>

      <div className="settings-body">

        {/* ── Entwicklermodus ── */}
        <section className="settings-section">
          <div className="settings-section__title">ENTWICKLERMODUS</div>

          <div className="settings-dev-card">
            <div className="settings-dev-card__left">
              <div className="settings-dev-card__icon">🛠</div>
              <div className="settings-dev-card__info">
                <div className="settings-dev-card__name">Dev-Modus</div>
                <div className="settings-dev-card__desc">
                  {devEnabled
                    ? 'Aktiv — Energie & Tränke unbegrenzt'
                    : 'Passwort erforderlich zum Aktivieren'}
                </div>
              </div>
              {devEnabled && <span className="settings-dev-badge">DEV</span>}
            </div>

            {devEnabled ? (
              <button className="settings-dev-btn settings-dev-btn--off" onClick={handleDeactivate}>
                Deaktivieren
              </button>
            ) : (
              <button className="settings-dev-btn" onClick={() => { setShowInput(v => !v); setError(false); }}>
                {showInput ? 'Abbrechen' : 'Aktivieren'}
              </button>
            )}
          </div>

          {showInput && !devEnabled && (
            <div className="settings-password-row">
              <input
                className={`settings-password-input ${error ? 'settings-password-input--error' : ''}`}
                type="password"
                placeholder="Passwort eingeben …"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(false); }}
                onKeyDown={e => e.key === 'Enter' && handleActivate()}
                autoFocus
              />
              <button className="settings-password-confirm" onClick={handleActivate}>
                ✓
              </button>
              {error && (
                <div className="settings-password-error">Falsches Passwort.</div>
              )}
            </div>
          )}
        {/* ── Dev-Aktionen ── */}
          {devEnabled && (
            <div className="settings-dev-actions">
              <button
                className="settings-dev-action-btn"
                onClick={() => {
                  const n = DevModeService.unlockAllCards();
                  showToast(n > 0 ? `${n} Karten freigeschaltet!` : 'Alle Karten bereits vorhanden.');
                }}
              >
                🃏 Alle Karten freischalten
              </button>
              <button
                className="settings-dev-action-btn"
                onClick={() => {
                  const n = DevModeService.maxLevelAllCards();
                  showToast(n > 0 ? `${n} Karten auf Lvl 60 gesetzt!` : 'Alle Karten bereits Lvl 60.');
                }}
              >
                ⬆️ Alle Karten → Lvl 60
              </button>
              <button
                className="settings-dev-action-btn"
                onClick={() => {
                  const n = DevModeService.ensureFourDupes();
                  showToast(n > 0 ? `${n} Duplikate hinzugefügt!` : 'Alle Karten haben bereits 4 Kopien.');
                }}
              >
                📋 4 Dupes pro Karte
              </button>
            </div>
          )}
        </section>

      </div>
    </div>
  );
};

export default SettingsScreen;
