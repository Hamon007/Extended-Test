import React, { useState, useEffect, useRef } from 'react';
import type { RewardDetails } from '../types/ProgressionTypes';
import { CardDatabase } from '../services/CardDatabase';
import { RARITY_COLOR } from '../types/Card';
import { BOND_ICONS, BOND_NAMES } from '../services/CardBondService';
import './VictoryScreen.css';

interface Props {
  details:    RewardDetails;
  onContinue: () => void;
}

// Animated number counter
const CountUp: React.FC<{ target: number; prefix?: string; suffix?: string; duration?: number }> = ({
  target, prefix = '', suffix = '', duration = 800,
}) => {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === 0) return;
    const start = performance.now();
    startRef.current = start;
    const tick = (now: number) => {
      const pct = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - pct, 3);
      setValue(Math.round(eased * target));
      if (pct < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);

  return <>{prefix}{value.toLocaleString('de-DE')}{suffix}</>;
};

const GRADE_COLORS: Record<string, string> = {
  D: '#9e9e9e', C: '#8bc34a', B: '#03a9f4', A: '#9c27b0',
  S: '#ff9800', SS: '#f44336', SSS: '#ffd700',
};

const VictoryScreen: React.FC<Props> = ({ details, onContinue }) => {
  const maxCombo    = details.maxCombo    ?? 0;
  const totalDamage = details.totalDamage ?? 0;
  const bondUps     = details.bondLevelUps ?? [];
  const masteryUps  = details.masteryLevelUps ?? [];
  const grade       = details.grade;
  const gradeColor  = grade ? GRADE_COLORS[grade] : undefined;

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

        {/* Performance Grade */}
        {grade && (
          <div className="victory-grade" style={{ color: gradeColor, textShadow: `0 0 20px ${gradeColor}` }}>
            {grade}
          </div>
        )}

        <div className="victory-divider" />

        {/* Battle-Stats */}
        {(totalDamage > 0 || maxCombo > 0) && (
          <div className="victory-stats">
            {totalDamage > 0 && (
              <div className="victory-stat">
                <span className="victory-stat__icon">⚔</span>
                <span className="victory-stat__value">
                  <CountUp target={totalDamage} />
                </span>
                <span className="victory-stat__label">Gesamtschaden</span>
              </div>
            )}
            {maxCombo > 0 && (
              <div className={`victory-stat ${maxCombo >= 5 ? 'victory-stat--max' : ''}`}>
                <span className="victory-stat__icon">🔥</span>
                <span className="victory-stat__value">{maxCombo}×</span>
                <span className="victory-stat__label">Max Combo</span>
              </div>
            )}
          </div>
        )}

        {/* Bond Level-Ups */}
        {bondUps.length > 0 && (
          <div className="victory-bonds">
            <div className="victory-bonds__title">💫 Kartenband gestärkt!</div>
            {bondUps.map(b => (
              <div key={b.cardId} className="victory-bond-row">
                <span className="victory-bond-row__icon">{BOND_ICONS[b.newLevel]}</span>
                <span className="victory-bond-row__name">{b.cardName}</span>
                <span className="victory-bond-row__level">{BOND_NAMES[b.newLevel]}</span>
              </div>
            ))}
          </div>
        )}

        {/* Mastery Level-Ups */}
        {masteryUps.length > 0 && (
          <div className="victory-bonds victory-mastery">
            <div className="victory-bonds__title">⚔ Meisterschaft erhöht!</div>
            {masteryUps.map((m, i) => (
              <div key={i} className="victory-bond-row">
                <span className="victory-mastery-row__stars">{m.stars}</span>
                <span className="victory-bond-row__name">{m.cardName}</span>
                <span className="victory-bond-row__level">Stufe {m.newLevel}</span>
              </div>
            ))}
          </div>
        )}

        {/* Belohnungen */}
        <div className="victory-rewards">

          {/* Kristalle */}
          <div className="reward-row reward-row--crystals">
            <span className="reward-row__label">💎 Kristalle</span>
            <span className="reward-row__value">
              +<CountUp target={details.crystalsGained} />
            </span>
          </div>

          {/* Erster Sieg des Tages */}
          {details.firstWinBonus && details.firstWinBonus > 0 && (
            <div className="reward-row reward-row--firstwin">
              <span className="reward-row__label">🌅 Erster Sieg heute!</span>
              <span className="reward-row__value">
                +<CountUp target={details.firstWinBonus} />
              </span>
            </div>
          )}

          {/* Account-XP */}
          {(details.accountXpGained ?? 0) > 0 && (
            <div className="reward-row reward-row--xp">
              <span className="reward-row__label">✦ Account-XP</span>
              <span className="reward-row__value">
                +<CountUp target={details.accountXpGained ?? 0} />
              </span>
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

          {/* Win Streak Meilenstein */}
          {details.streakMilestoneBonus && details.streakMilestoneBonus > 0 && (
            <div className="reward-row reward-row--streak">
              <span className="reward-row__label">🔥 Streak x{details.winStreak} Bonus!</span>
              <span className="reward-row__value">
                +<CountUp target={details.streakMilestoneBonus} />
              </span>
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
