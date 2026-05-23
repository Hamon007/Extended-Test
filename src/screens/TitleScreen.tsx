import React, { useState, useEffect } from 'react';
import { AuthService } from '../services/AuthService';
import './TitleScreen.css';

interface TitleScreenProps {
  onEnter: () => void;
  onAccountPress: () => void;
}

const B = import.meta.env.BASE_URL;

const TitleScreen: React.FC<TitleScreenProps> = ({ onEnter, onAccountPress }) => {
  const [loggedIn, setLoggedIn] = useState(() => AuthService.isLoggedIn);
  useEffect(() => AuthService.subscribe(u => setLoggedIn(u !== null)), []);

  return (
    <div className="title-screen" onClick={onEnter}>

      {/* Vollbild-Hintergrund */}
      <img
        className="title-screen__bg"
        src={`${B}assets/title_bg.jpg`}
        alt=""
        aria-hidden="true"
      />
      <div className="title-screen__bg-overlay" />

      {/* Logo oben mittig */}
      <div className="title-screen__logo" onClick={e => e.stopPropagation()}>
        <span className="title-screen__logo-codex">Codex</span>
        <span className="title-screen__logo-immortalis">Immortalis</span>
      </div>

      {/* Start-Button unten mittig */}
      <div className="title-screen__bottom-center" onClick={e => e.stopPropagation()}>
        <button className="title-screen__start-btn" onClick={onEnter}>
          ZUM STARTEN DRÜCKEN
        </button>
      </div>

      {/* Untere linke Buttons */}
      <div className="title-screen__bottom-left" onClick={e => e.stopPropagation()}>
        <button className="title-screen__meta-btn">
          <span className="title-screen__meta-icon">📖</span>
          <span className="title-screen__meta-label">Konto</span>
        </button>
        <button className="title-screen__meta-btn">
          <span className="title-screen__meta-icon">⚙️</span>
          <span className="title-screen__meta-label">Optionen</span>
        </button>
        <button className="title-screen__meta-btn">
          <span className="title-screen__meta-icon">🔔</span>
          <span className="title-screen__meta-label">News</span>
        </button>
      </div>

      {/* Untere rechte Buttons */}
      <div className="title-screen__bottom-right" onClick={e => e.stopPropagation()}>
        <button className="title-screen__meta-btn" onClick={onAccountPress}>
          <span className="title-screen__meta-icon">{loggedIn ? '✅' : '👤'}</span>
          <span className="title-screen__meta-label">Konto</span>
        </button>
        <button className="title-screen__meta-btn">
          <span className="title-screen__meta-icon">🌐</span>
          <span className="title-screen__meta-label">Sprache</span>
        </button>
        <button className="title-screen__meta-btn">
          <span className="title-screen__meta-icon">🚪</span>
          <span className="title-screen__meta-label">Beenden</span>
        </button>
      </div>

    </div>
  );
};

export default TitleScreen;
