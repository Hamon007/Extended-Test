import React from 'react';
import type { RewardDetails } from '../types/ProgressionTypes';
import { DEFEAT_CONSOLATION } from '../types/ProgressionTypes';
import { MAX_ROUNDS } from '../types/BattleTypes';
import './DefeatScreen.css';

interface Props {
  details:         RewardDetails;
  onReturnToSelect: () => void;
}

const DefeatScreen: React.FC<Props> = ({ details, onReturnToSelect }) => {
  const reasonText = details.defeatReason === 'rounds'
    ? `Rundengrenze (${MAX_ROUNDS}) erreicht — Gegner zu stark.`
    : 'Alle HP verloren.';

  return (
    <div className="defeat-screen">
      <div className="defeat-content">

        {/* Skull + Titel */}
        <div className="defeat-skull">💀</div>
        <h1 className="defeat-title">NIEDERLAGE</h1>
        <p className="defeat-reason">{reasonText}</p>

        <div className="defeat-divider" />

        {/* Trostpreis */}
        <div className="defeat-consolation">
          <div className="defeat-consolation__label">Trostpreis</div>
          <div className="defeat-consolation__value">
            <span className="defeat-consolation__icon">💎</span>
            <span className="defeat-consolation__amount">+{DEFEAT_CONSOLATION}</span>
          </div>
          {(details.accountXpGained ?? 0) > 0 && (
            <div className="defeat-consolation__value">
              <span className="defeat-consolation__icon">✦</span>
              <span className="defeat-consolation__amount">+{details.accountXpGained} Account-XP</span>
            </div>
          )}
          <div className="defeat-consolation__note">
            Kämpfe weiter — der Sieg wartet.
          </div>
        </div>

        {/* Aktionen */}
        <div className="defeat-actions">
          <button className="defeat-btn defeat-btn--return" onClick={onReturnToSelect}>
            ◀ Zurück zur Auswahl
          </button>
        </div>

      </div>
    </div>
  );
};

export default DefeatScreen;
