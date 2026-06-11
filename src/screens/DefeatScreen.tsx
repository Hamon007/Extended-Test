import React, { useMemo } from 'react';
import type { RewardDetails } from '../types/ProgressionTypes';
import { DEFEAT_CONSOLATION } from '../types/ProgressionTypes';
import { MAX_ROUNDS } from '../types/BattleTypes';
import { SaveService } from '../services/SaveService';
import { CardDatabase } from '../services/CardDatabase';
import { FusionSystem } from '../services/FusionSystem';
import { CardMasteryService } from '../services/CardMasteryService';
import { LevelSystem } from '../services/LevelSystem';
import { RageModeService } from '../services/RageModeService';
import { BountyService }   from '../services/BountyService';
import { WorldBossService } from '../services/WorldBossService';
import { WinStreakService } from '../services/WinStreakService';
import './DefeatScreen.css';

interface Props {
  details:          RewardDetails;
  onReturnToSelect: () => void;
  onRetry?:         () => void;
  canRetry?:        boolean;
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

// ── Tactical analysis helpers ─────────────────────────────────

interface TacTip {
  icon: string;
  text: string;
  variant: 'primary' | 'secondary' | 'combo';
}

function buildTips(details: RewardDetails): TacTip[] {
  const tips: TacTip[] = [];
  const enemyHpPct   = details.enemyHpPct   ?? 1;
  const maxCombo     = details.maxCombo     ?? 0;
  const roundsElapsed = details.roundsElapsed ?? 0;
  const defeatReason = details.defeatReason ?? 'hp';

  if (defeatReason === 'rounds') {
    tips.push({
      icon: '⏱',
      text: roundsElapsed >= MAX_ROUNDS - 1
        ? `Rundengrenze (${MAX_ROUNDS}) erreicht. Dein Deck braucht mehr Schaden pro Runde — ATK-Levelups priorisieren!`
        : 'Zu viele Runden verbraucht. Erhöhe den Durchsatz durch stärkere ATK-Werte.',
      variant: 'primary',
    });
  } else {
    if (enemyHpPct > 0.55) {
      tips.push({
        icon: '⚔',
        text: 'Massiver Rückstand. Beide ATK und Verteidigung deiner Karten müssen deutlich gesteigert werden.',
        variant: 'primary',
      });
    } else if (enemyHpPct > 0.25) {
      tips.push({
        icon: '🛡',
        text: `Der Gegner hatte noch ${Math.round(enemyHpPct * 100)}% HP. Steigere dein Deck-ATK durch Levelups und Fusion.`,
        variant: 'primary',
      });
    } else {
      tips.push({
        icon: '⚡',
        text: `Nur ${Math.round(enemyHpPct * 100)}% HP des Gegners verbleibend — ein kleines ATK-Upgrade reicht für den Sieg!`,
        variant: 'primary',
      });
    }
  }

  if (maxCombo < 2) {
    tips.push({
      icon: '🔥',
      text: 'Keine Kombos erzielt! Ketten-Angriffe verdoppeln deinen Schaden — spare Energie für Combo-Züge.',
      variant: 'combo',
    });
  } else if (maxCombo < 4) {
    tips.push({
      icon: '🔥',
      text: `Max Combo: ${maxCombo}×. Strebe nach 5+ Treffer-Ketten für massiv mehr Schadenspotenzial.`,
      variant: 'combo',
    });
  }

  if (roundsElapsed > 0 && defeatReason === 'hp' && roundsElapsed >= MAX_ROUNDS - 2) {
    tips.push({
      icon: '⏳',
      text: 'Kampf dauerte fast bis zur Rundenbegrenzung. Verbessere Deck-Synergien für effizientere Angriffe.',
      variant: 'secondary',
    });
  }

  return tips.slice(0, 3);
}

// Progress bar: fraction of enemy HP eliminated (1 - enemyHpPct)
function damageProgress(enemyHpPct: number): number {
  return Math.max(0, Math.min(1, 1 - enemyHpPct));
}

const DefeatScreen: React.FC<Props> = ({ details, onReturnToSelect, onRetry, canRetry }) => {
  const reasonText = details.defeatReason === 'rounds'
    ? `Rundengrenze (${MAX_ROUNDS}) erreicht — Gegner zu stark.`
    : 'Alle HP verloren.';

  // Deck upgrade suggestion: weakest card + whether it can level up or fuse
  const upgradeSuggestion = useMemo(() => {
    const gState = SaveService.loadGachaState();
    const deck = SaveService.loadDeck();
    if (deck.uuids.length === 0) return null;
    let weakest: { name: string; atk: number; canLevel: boolean } | null = null;
    for (const uuid of deck.uuids) {
      const inst = gState.inventory.find(i => i.uuid === uuid);
      if (!inst) continue;
      const card = CardDatabase.getById(inst.cardId);
      if (!card) continue;
      const stats = FusionSystem.getEffectiveStats(card, inst.rarity, inst.level ?? 1);
      const atk = stats.atk + CardMasteryService.getAtkBonus(inst.cardId);
      const canLevel = (inst.level ?? 1) < LevelSystem.levelCap(inst.rarity);
      if (!weakest || atk < weakest.atk) weakest = { name: card.name, atk, canLevel };
    }
    return weakest;
  }, []);

  const totalDamage  = details.totalDamage ?? 0;
  const maxCombo     = details.maxCombo    ?? 0;
  const enemyHpPct   = details.enemyHpPct  ?? 1;
  const wasClose     = enemyHpPct > 0 && enemyHpPct < 0.2;
  const seed         = Math.floor(Date.now() / 60000) % 4;
  const motivational = wasClose ? pick(CLOSE_MESSAGES, seed) : pick(MOTIVATIONAL, seed);
  const tips         = buildTips(details);
  const dmgPct       = damageProgress(enemyHpPct);
  const barColor     = dmgPct >= 0.85 ? '#44cc44' : dmgPct >= 0.6 ? '#f0c040' : dmgPct >= 0.35 ? '#e07020' : '#cc2200';

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

        {details.streakShielded ? (
          <div className="defeat-streak-shielded">
            <span className="defeat-streak-shielded__icon">🛡</span>
            <span className="defeat-streak-shielded__text">
              <strong>SCHUTZSCHILD AKTIVIERT!</strong><br />
              Deine {details.winStreak}× Sieg-Serie wurde gerettet!
            </span>
          </div>
        ) : (details.winStreak ?? 0) >= 3 && (
          <div className="defeat-streak-broken">
            <span className="defeat-streak-broken__icon">💔</span>
            <span className="defeat-streak-broken__text">
              Sieg-Serie gebrochen! <strong>{details.winStreak}×</strong> in Folge
            </span>
          </div>
        )}

        <div className="defeat-comeback-hint">
          <span className="defeat-comeback-hint__icon">⚡</span>
          <span className="defeat-comeback-hint__text">
            Comeback-Bonus: nächster Sieg <strong>+50% 💎</strong>
          </span>
        </div>

        {/* Rage Mode progress */}
        {(() => {
          const losses = RageModeService.getLossCount();
          const isRage = losses >= RageModeService.RAGE_THRESHOLD;
          if (losses === 0) return null;
          return (
            <div className={`defeat-rage-progress${isRage ? ' defeat-rage-progress--active' : ''}`}>
              {isRage ? (
                <>
                  <span className="defeat-rage-progress__icon">😡</span>
                  <span className="defeat-rage-progress__text">
                    <strong>RAGE MODE AKTIV!</strong> Nächster Sieg <strong>×2 💎</strong>
                  </span>
                </>
              ) : (
                <>
                  <span className="defeat-rage-progress__icon">🔴</span>
                  <span className="defeat-rage-progress__text">
                    {losses}/{RageModeService.RAGE_THRESHOLD} Niederlagen
                    {' — '}noch {RageModeService.RAGE_THRESHOLD - losses} → <strong>RAGE MODE ×2 💎</strong>
                  </span>
                  <div className="defeat-rage-progress__bar-wrap">
                    {Array.from({ length: RageModeService.RAGE_THRESHOLD }).map((_, i) => (
                      <div key={i} className={`defeat-rage-progress__dot${i < losses ? ' defeat-rage-progress__dot--filled' : ''}`} />
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })()}

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

        {/* ── Tactical Analysis ─────────────────────────────── */}
        <div className="defeat-analysis">
          <div className="defeat-analysis__header">TAKTIK-ANALYSE</div>

          {/* Damage progress bar */}
          <div className="defeat-analysis__prog-label">
            <span>Gegner-HP eliminiert</span>
            <span>{Math.round(dmgPct * 100)}%</span>
          </div>
          <div className="defeat-analysis__bar-track">
            <div
              className="defeat-analysis__bar-fill"
              style={{ width: `${dmgPct * 100}%`, background: barColor }}
            />
            {/* Threshold markers */}
            <div className="defeat-analysis__bar-mark" style={{ left: '80%' }} />
          </div>
          <div className="defeat-analysis__bar-legend">
            <span>0%</span><span>Sieg →</span><span>100%</span>
          </div>

          {/* Tips */}
          <div className="defeat-tips">
            {tips.map((tip, i) => (
              <div key={i} className={`defeat-tip defeat-tip--${tip.variant}`}>
                <span className="defeat-tip__icon">{tip.icon}</span>
                <span className="defeat-tip__text">{tip.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Deck-Verbesserung ── */}
        {upgradeSuggestion && (
          <div className="defeat-upgrade">
            <div className="defeat-upgrade__header">◆ NÄCHSTE VERBESSERUNG</div>
            <div className="defeat-upgrade__body">
              <span className="defeat-upgrade__icon">⚔</span>
              <span className="defeat-upgrade__text">
                <strong>{upgradeSuggestion.name}</strong>
                <span className="defeat-upgrade__atk"> ({upgradeSuggestion.atk.toLocaleString('de-DE')} ATK)</span>
                {' — '}
                {upgradeSuggestion.canLevel
                  ? 'Trainiere diese Karte für mehr Kampfstärke!'
                  : 'Fusioniere für die nächste Seltenheitsstufe!'}
              </span>
            </div>
          </div>
        )}

        {/* Pending rewards reminder */}
        {(() => {
          const pendingBounties  = BountyService.getAll().filter(b => !b.collected);
          const worldBossReward  = WorldBossService.canClaim();
          const hasShield        = WinStreakService.hasShield();
          const items: string[]  = [];
          if (pendingBounties.length > 0) {
            const total = pendingBounties.reduce((s, b) => s + b.crystals, 0);
            items.push(`🎯 ${pendingBounties.length} Kopfgeld${pendingBounties.length > 1 ? 'er' : ''} (${total} 💎)`);
          }
          if (worldBossReward) items.push(`💀 Weltboss-Belohnung (${WorldBossService.REWARD_CRYSTALS} 💎)`);
          if (hasShield)       items.push('🛡 Schutzschild aktiv — nächste Niederlage absorbiert!');
          if (items.length === 0) return null;
          return (
            <div className="defeat-pending-rewards">
              <div className="defeat-pending-rewards__title">⚠ Noch nicht eingesammelt:</div>
              {items.map((item, i) => (
                <div key={i} className="defeat-pending-rewards__item">{item}</div>
              ))}
            </div>
          );
        })()}

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
          {onRetry && (
            <button
              className={`defeat-btn defeat-btn--retry ${!canRetry ? 'defeat-btn--retry-disabled' : ''}`}
              onClick={canRetry ? onRetry : undefined}
              disabled={!canRetry}
              title={!canRetry ? 'Keine Energie' : undefined}
            >
              {canRetry ? '⚡ Nochmal!' : '⚡ Keine Energie'}
            </button>
          )}
          <button className="defeat-btn defeat-btn--return" onClick={onReturnToSelect}>
            ◀ Zurück
          </button>
        </div>

      </div>
    </div>
  );
};

export default DefeatScreen;
