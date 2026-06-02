import React from 'react';
import type { RewardDetails } from '../types/ProgressionTypes';
import { DEFEAT_CONSOLATION } from '../types/ProgressionTypes';
import { MAX_ROUNDS } from '../types/BattleTypes';
import './DefeatScreen.css';

interface Props {
  details:         RewardDetails;
  onReturnToSelect: () => void;
}

const CLOSE_MESSAGES = [
  'Fast! Der Gegner stand am Rand des Abgrunds.',
  'Du hast ihn fast erwischt. Nächstes Mal!',
  'So knapp! Noch ein Schlag hätte gereicht.',
  'Unglaublich nah. Schärfe deine Klingen.',
];
const MOTIVATIONAL = [
  'Niederlagen sind das Fundament der Stärke.',
  'Kehre zurück, wenn du das Unmögliche möglich machen kannst.',
  'Stärke kommt durch Niederlage. Komm zurück.',
  'Der Turm zeigt keine Gnade für Schwäche — aber Schwäche kann überwunden werden.',
];

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length]!;
}

const DefeatScreen: React.FC<Props> = ({ details, onReturnToSelect }) => {
  const reasonText = details.defeatReason === 'rounds'
    ? `Rundengrenze (${MAX_ROUNDS}) erreicht — Gegner zu stark.`
    : 'Alle HP verloren.';

  const totalDamage = details.totalDamage ?? 0;
  const maxCombo    = details.maxCombo    ?? 0;
  const enemyHpPct  = details.enemyHpPct  ?? 1;
  const wasClose    = enemyHpPct > 0 && enemyHpPct < 0.2;
  const seed        = Math.floor(Date.now() / 60000) % 4;
  const motivational = wasClose ? pick(CLOSE_MESSAGES, seed) : pick(MOTIVATIONAL, seed);

  return (
    <div className="defeat-screen">
      <div className="defeat-content">

        <div className="defeat-skull">💀</div>
        <h1 className="defeat-title">NIEDERLAGE</h1>
        <p className="defeat-reason">{reasonText}</p>

        {wasClose && (
          <div className="defeat-close-badge">
            ⚡ {Math.round(enemyHpPct * 100)}% HP verbleibend!
          </div>
        )}

        <div className="defeat-divider" />

        {/* Battle stats */}
        {(totalDamage > 0 || maxCombo > 0) && (
          <div className="defeat-stats">
            {totalDamage > 0 && (
              <div className="defeat-stat">
                <span className="defeat-stat__icon">⚔</span>
                <span className="defeat-stat__value">{totalDamage.toLocaleString('de-DE')}</span>
                <span className="defeat-stat__label">Schaden</span>
              </div>
            )}
            {maxCombo > 0 && (
              <div className="defeat-stat">
                <span className="defeat-stat__icon">🔥</span>
                <span className="defeat-stat__value">{maxCombo}×</span>
                <span className="defeat-stat__label">Max Combo</span>
              </div>
            )}
          </div>
        )}

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
          <div className="defeat-consolation__note">{motivational}</div>
        </div>

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
