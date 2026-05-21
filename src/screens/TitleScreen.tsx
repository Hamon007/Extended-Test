import React from 'react';
import './TitleScreen.css';

interface TitleScreenProps {
  onEnter: () => void;
}

const TitleScreen: React.FC<TitleScreenProps> = ({ onEnter }) => {
  return (
    <div className="title-screen" onClick={onEnter}>
      {/* Hintergrundbilder */}
      <img
        className="title-screen__card-left"
        src="/assets/cards/azazel.png"
        alt="Azazel"
      />
      <img
        className="title-screen__card-right"
        src="/assets/cards/satan.png"
        alt="Satan"
      />

      {/* Mittelbereich */}
      <div className="title-screen__center" onClick={e => e.stopPropagation()}>
        <div className="title-screen__logo">
          <span className="title-screen__logo-codex">Codex</span>
          <span className="title-screen__logo-immortalis">Immortalis</span>
        </div>
        <div className="title-screen__ornament">✦ ─────────────── ✦</div>
        <button className="title-screen__start-btn" onClick={onEnter}>
          ZUM STARTEN DRÜCKEN
        </button>
      </div>

      {/* Untere linke Buttons */}
      <div className="title-screen__bottom-left" onClick={e => e.stopPropagation()}>
        <button className="title-screen__meta-btn">📖 KONTO</button>
        <button className="title-screen__meta-btn">⚙️ OPTIONEN</button>
        <button className="title-screen__meta-btn">🔔 NEWS</button>
      </div>

      {/* Untere rechte Buttons */}
      <div className="title-screen__bottom-right" onClick={e => e.stopPropagation()}>
        <button className="title-screen__meta-btn">👤 KONTO</button>
        <button className="title-screen__meta-btn">🌐 SPRACHE</button>
        <button className="title-screen__meta-btn">🚪 BEENDEN</button>
      </div>
    </div>
  );
};

export default TitleScreen;
