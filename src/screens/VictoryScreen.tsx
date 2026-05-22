import React, { useState } from 'react';
import type { RewardDetails } from '../types/ProgressionTypes';
import { CardDatabase } from '../services/CardDatabase';
import { RARITY_COLOR } from '../types/Card';
import './VictoryScreen.css';

interface Props {
  details:    RewardDetails;
  onContinue: () => void;
}

const VictoryScreen: React.FC<Props> = ({ details, onContinue }) => {
  return (
    <div className="victory-screen">
      {/* Hintergrund-Partikel */}
      <div className="victory-particles" aria-hidden="true">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className={`vp vp--${i % 4}`} />
        ))}
      </div>

      <div className="victory-content">

        {/* Trophy + Titel */}
        <div className="victory-trophy">🏆</div>
        <h1 className="victory-title">SIEG!</h1>
        <div className="victory-divider" />

        {/* Belohnungen */}
        <div className="victory-rewards">

          {/* Kristalle */}
          <div className="reward-row reward-row--crystals">
            <span className="reward-row__label">💎 Kristalle</span>
            <span className="reward-row__value">+{details.crystalsGained.toLocaleString('de-DE')}</span>
          </div>

          {/* Account-XP */}
          {(details.accountXpGained ?? 0) > 0 && (
            <div className="reward-row reward-row--xp">
              <span className="reward-row__label">✦ Account-XP</span>
              <span className="reward-row__value">+{(details.accountXpGained ?? 0).toLocaleString('de-DE')}</span>
            </div>
          )}

          {/* Level-Up */}
          {details.accountLevelUp && (
            <div className="reward-row reward-row--levelup">
              <span className="reward-row__label">🎉 Level Up!</span>
              <span className="reward-row__value">Account Lv. {details.accountLevelUp.newLevel}</span>
              <div className="reward-levelup-details">
                <span>Ausdauer: {details.accountLevelUp.newMaxStamina}</span>
                <span>Mana: {details.accountLevelUp.newMaxMana.toLocaleString('de-DE')}</span>
              </div>
            </div>
          )}

          {/* Ausdauertrank */}
          {details.potionsGained && details.potionsGained > 0 && (
            <div className="reward-row reward-row--xp">
              <span className="reward-row__label">🧪 Ausdauertrank</span>
              <span className="reward-row__value">+{details.potionsGained}</span>
            </div>
          )}

          {/* Karten-Drops */}
          {details.newCards.length > 0 && (
            <div className="victory-cards">
              <div className="victory-cards__title">🃏 Neue Karten erhalten!</div>
              <div className="victory-cards__grid">
                {details.newCards.map(inst => (
                  <RewardCardItem key={inst.uuid} cardId={inst.cardId} />
                ))}
              </div>
            </div>
          )}

          {details.newCards.length === 0 && (
            <div className="victory-no-drop">
              Kein Karten-Drop dieses Mal.
            </div>
          )}
        </div>

        {/* Weiter-Button */}
        <button className="victory-btn" onClick={onContinue}>
          ◀ Zurück zur Auswahl
        </button>

      </div>
    </div>
  );
};

// ── Einzelne Belohnungs-Karte ─────────────────────────────────

const RewardCardItem: React.FC<{ cardId: string }> = ({ cardId }) => {
  const card = CardDatabase.getById(cardId);
  const [imgErr, setImgErr] = useState(false);

  if (!card) {
    return (
      <div className="reward-card reward-card--unknown">
        <span className="reward-card__placeholder">🌑</span>
        <span className="reward-card__name">{cardId}</span>
      </div>
    );
  }

  const rc = RARITY_COLOR[card.rarity] ?? '#9e9e9e';

  return (
    <div
      className="reward-card"
      style={{ '--rc': rc } as React.CSSProperties}
    >
      <div className="reward-card__art">
        {!imgErr ? (
          <img
            src={card.image}
            alt={card.name}
            onError={() => setImgErr(true)}
          />
        ) : (
          <span className="reward-card__placeholder">🌑</span>
        )}
      </div>
      <div className="reward-card__rarity" style={{ color: rc }}>
        {card.rarity}
      </div>
      <div className="reward-card__name">{card.name}</div>
    </div>
  );
};

export default VictoryScreen;
