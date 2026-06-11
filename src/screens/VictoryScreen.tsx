import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { RewardDetails } from '../types/ProgressionTypes';
import { CardDatabase } from '../services/CardDatabase';
import { EnemyDatabase } from '../services/EnemyDatabase';
import { TowerService } from '../services/TowerService';
import { SaveService } from '../services/SaveService';
import { AccountProgressionService } from '../services/AccountProgressionService';
import { RARITY_COLOR } from '../types/Card';
import { BOND_ICONS, BOND_NAMES } from '../services/CardBondService';
import { WinStreakService } from '../services/WinStreakService';
import { CardMasteryService } from '../services/CardMasteryService';
import { FusionSystem } from '../services/FusionSystem';
import { LevelSystem } from '../services/LevelSystem';
import { PULL_COST_MULTI } from '../config/GameConfig';
import './VictoryScreen.css';

interface Props {
  details:    RewardDetails;
  onContinue: () => void;
  onNavigate?: (screen: string) => void;
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

const VictoryScreen: React.FC<Props> = ({ details, onContinue, onNavigate }) => {
  // Post-battle account state for XP progress bar
  const accountAfter = useMemo(() => SaveService.loadAccountState(), []);
  const xpToNext     = AccountProgressionService.xpToNextLevel(accountAfter.level);
  const xpPct        = xpToNext > 0 ? Math.min(100, Math.round((accountAfter.xp / xpToNext) * 100)) : 100;

  const maxCombo      = details.maxCombo    ?? 0;
  const totalDamage   = details.totalDamage ?? 0;
  const bondUps       = details.bondLevelUps ?? [];
  const masteryUps    = details.masteryLevelUps ?? [];
  const grade         = details.grade;
  const gradeColor    = grade ? GRADE_COLORS[grade] : undefined;
  const playerHpPct   = details.playerHpPct ?? 1;
  const roundsElapsed = details.roundsElapsed ?? 0;
  const isFlawless    = playerHpPct >= 0.9 && roundsElapsed <= 5;
  const isNearMiss    = playerHpPct <= 0.15;
  const newRecords    = details.newRecords ?? [];

  const streakReward  = WinStreakService.getRewardMultiplier(details.winStreak ?? 0);
  const hasMultiplier = streakReward.multiplier > 1.0;
  const winStreak     = details.winStreak ?? 0;
  const showStreakFlash = winStreak >= 5;

  // Cards close to next mastery level (75%+), excluding ones that just leveled up
  const nearMastery = useMemo(() => {
    const deck = SaveService.loadDeck();
    const inv  = SaveService.loadGachaState().inventory;
    return deck.uuids
      .map(uuid => {
        const inst = inv.find(i => i.uuid === uuid);
        if (!inst) return null;
        const info = CardMasteryService.getMasteryInfo(inst.cardId);
        if (info.nextThreshold === null) return null;
        const pct = info.nextThreshold > 0 ? info.plays / info.nextThreshold : 0;
        if (pct < 0.75) return null;
        const card = CardDatabase.getById(inst.cardId);
        const remaining = info.nextThreshold - info.plays;
        return { name: card?.name ?? inst.cardId, pct, remaining, stars: info.stars, level: info.level };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .filter(x => !masteryUps.some(m => m.cardName === x.name))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 3);
  }, [masteryUps]);

  // Post-battle quick actions (only shown if onNavigate is available)
  const quickActions = useMemo(() => {
    if (!onNavigate) return [];
    const actions: { icon: string; label: string; screen: string }[] = [];
    const gState = SaveService.loadGachaState();
    const fusionReady = FusionSystem.buildGroups(gState.inventory).some(g => g.canFuse);
    if (fusionReady) actions.push({ icon: '🔮', label: 'FUSION', screen: 'fusion' });
    const deck = SaveService.loadDeck();
    const canTrain = deck.uuids.some(uuid => {
      const inst = gState.inventory.find(i => i.uuid === uuid);
      return inst ? (inst.level ?? 1) < LevelSystem.levelCap(inst.rarity) : false;
    });
    if (canTrain) actions.push({ icon: '⚔', label: 'TRAINIEREN', screen: 'training' });
    if (gState.crystals >= PULL_COST_MULTI) actions.push({ icon: '✨', label: '10× ZIEHEN', screen: 'gacha' });
    return actions.slice(0, 3);
  }, [onNavigate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Next floor preview (tower mode only)
  const currentFloor = details.towerFloor;
  const nextFloor    = currentFloor !== undefined ? currentFloor + 1 : undefined;
  const nextIsBoss   = nextFloor !== undefined && TowerService.isBossFloor(nextFloor);
  const nextIsMile   = nextFloor !== undefined && nextFloor % 5 === 0 && !nextIsBoss;

  return (
    <div className="victory-screen">
      {/* Hintergrund-Partikel */}
      <div className="victory-particles" aria-hidden="true">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className={`vp vp--${i % 4}`} />
        ))}
      </div>

      {/* Crystal Rain particle overlay */}
      {details.crystalRainBonus && details.crystalRainBonus > 0 && (
        <div className="crystal-rain-overlay" aria-hidden="true">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className={`crystal-drop crystal-drop--${i % 5}`}>💎</div>
          ))}
        </div>
      )}

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

        {/* Special victory badges */}
        {(isFlawless || isNearMiss) && (
          <div className="victory-badge-row">
            {isFlawless && (
              <div className="victory-badge victory-badge--flawless">
                <span>✨</span> MAKELLOS
              </div>
            )}
            {isNearMiss && (
              <div className="victory-badge victory-badge--near-miss">
                <span>💥</span> LETZTE KRAFT!
              </div>
            )}
          </div>
        )}

        {/* New personal record banners */}
        {newRecords.length > 0 && (
          <div className="victory-records">
            {newRecords.includes('floor') && (
              <div className="victory-record victory-record--floor">
                🏆 NEUER ETAGEN-REKORD — ETAGE {details.towerFloor}!
              </div>
            )}
            {newRecords.includes('combo') && (
              <div className="victory-record victory-record--combo">
                🌀 NEUE BESTMARKE — MAX COMBO!
              </div>
            )}
            {newRecords.includes('streak') && (
              <div className="victory-record victory-record--streak">
                🔥 NEUE BESTMARKE — SIEG-SERIE!
              </div>
            )}
          </div>
        )}

        {/* Streak Flash — shown for 5+ win streaks */}
        {showStreakFlash && (
          <div className={`victory-streak-flash${winStreak >= 10 ? ' victory-streak-flash--mega' : ''}`}>
            <span className="victory-streak-flash__fire">🔥</span>
            <span className="victory-streak-flash__text">
              {winStreak >= 10 ? 'LEGENDS-SERIE' : 'SERIE LÄUFT!'} · <strong>{winStreak}× IN FOLGE</strong>
            </span>
            {winStreak < 10 && (
              <span className="victory-streak-flash__hint">noch {10 - winStreak} bis LEGENDS</span>
            )}
          </div>
        )}

        <div className="victory-divider" />

        {/* Battle-Stats */}
        {(totalDamage > 0 || maxCombo > 0 || playerHpPct > 0) && (
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
            {playerHpPct > 0 && (
              <div className={`victory-stat ${playerHpPct >= 0.9 ? 'victory-stat--max' : ''}`}>
                <span className="victory-stat__icon">❤️</span>
                <span className="victory-stat__value">{Math.round(playerHpPct * 100)}%</span>
                <span className="victory-stat__label">HP übrig</span>
              </div>
            )}
            {roundsElapsed > 0 && (
              <div className="victory-stat">
                <span className="victory-stat__icon">⏱</span>
                <span className="victory-stat__value">{roundsElapsed}</span>
                <span className="victory-stat__label">Runden</span>
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

        {/* Near-Mastery hints */}
        {nearMastery.length > 0 && (
          <div className="victory-near-mastery">
            <div className="victory-near-mastery__title">⚔ Fast Meisterschaft!</div>
            {nearMastery.map((m, i) => (
              <div key={i} className="victory-near-mastery__row">
                <span className="victory-near-mastery__stars">{m.stars}</span>
                <span className="victory-near-mastery__name">{m.name}</span>
                <div className="victory-near-mastery__bar">
                  <div
                    className="victory-near-mastery__bar-fill"
                    style={{ width: `${Math.round(m.pct * 100)}%` }}
                  />
                </div>
                <span className="victory-near-mastery__hint">
                  noch {m.remaining}×
                </span>
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

          {/* Account XP progress bar (post-battle state) */}
          {(details.accountXpGained ?? 0) > 0 && !details.accountLevelUp && (
            <div className="victory-xp-bar">
              <div className="victory-xp-bar__labels">
                <span>Lv.{accountAfter.level}</span>
                <span className="victory-xp-bar__pct">{xpPct}%</span>
                <span>Lv.{accountAfter.level + 1}</span>
              </div>
              <div className="victory-xp-bar__track">
                <div className="victory-xp-bar__fill" style={{ width: `${xpPct}%` }} />
              </div>
              <div className="victory-xp-bar__note">
                {accountAfter.xp.toLocaleString('de-DE')} / {xpToNext.toLocaleString('de-DE')} XP
                {xpPct >= 85 && <span className="victory-xp-bar__almost"> · Fast Level Up!</span>}
              </div>
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

          {/* Aktiver Streak-Multiplikator */}
          {hasMultiplier && (
            <div className="reward-row reward-row--streak-mult">
              <span className="reward-row__label">🔥 {streakReward.label}</span>
              <span className="reward-row__value reward-row__value--mult">×{streakReward.multiplier.toFixed(1)}</span>
            </div>
          )}

          {/* Weekend Bonus (+25% on Sat/Sun) */}
          {details.weekendBonus && details.weekendBonus > 0 && (
            <div className="reward-row reward-row--weekend">
              <span className="reward-row__label">🎉 Wochenend-Bonus!</span>
              <span className="reward-row__value">
                +<CountUp target={details.weekendBonus} />
              </span>
            </div>
          )}

          {/* Active Event Bonus */}
          {details.eventBonus && details.eventBonus > 0 && (
            <div className="reward-row reward-row--event">
              <span className="reward-row__label">🌟 {details.eventName ?? 'Event-Bonus'}!</span>
              <span className="reward-row__value reward-row__value--event">
                +<CountUp target={details.eventBonus} />
              </span>
            </div>
          )}

          {/* Lucky Floor +30% bonus */}
          {details.luckyFloorBonus && details.luckyFloorBonus > 0 && (
            <div className="reward-row reward-row--luckyfloor">
              <span className="reward-row__label">⭐ GLÜCKSETAGE! +30%</span>
              <span className="reward-row__value reward-row__value--luckyfloor">
                +<CountUp target={details.luckyFloorBonus} />
              </span>
            </div>
          )}

          {/* Lucky 7 jackpot */}
          {details.luckySevenBonus && details.luckySevenBonus > 0 && (
            <div className="reward-row reward-row--lucky7">
              <span className="reward-row__label">🎰 LUCKY 7! JACKPOT!</span>
              <span className="reward-row__value reward-row__value--lucky7">
                +<CountUp target={details.luckySevenBonus} />
              </span>
            </div>
          )}

          {/* Crystal Rain surprise bonus */}
          {details.crystalRainBonus && details.crystalRainBonus > 0 && (
            <div className="reward-row reward-row--crystalrain">
              <span className="reward-row__label">💎 KRISTALL-REGEN! 🎊</span>
              <span className="reward-row__value reward-row__value--crystalrain">
                +<CountUp target={details.crystalRainBonus} />
              </span>
            </div>
          )}

          {/* Bonus Hour ×2 */}
          {details.bonusHourBonus && details.bonusHourBonus > 0 && (
            <div className="reward-row reward-row--bonushour">
              <span className="reward-row__label">⚡ BONUS-STUNDE! ×2</span>
              <span className="reward-row__value reward-row__value--bonushour">
                +<CountUp target={details.bonusHourBonus} />
              </span>
            </div>
          )}

          {/* Nemesis Revenge Bonus */}
          {details.nemesisBonus && details.nemesisBonus > 0 && (
            <div className="reward-row reward-row--nemesis">
              <span className="reward-row__label">💀 NEMESIS BEZWUNGEN! ×1.5</span>
              <span className="reward-row__value reward-row__value--nemesis">
                +<CountUp target={details.nemesisBonus} />
              </span>
            </div>
          )}

          {/* Recovery Bonus (Comeback-Bonus nach Niederlage) */}
          {details.recoveryBonus && details.recoveryBonus > 0 && (
            <div className="reward-row reward-row--recovery">
              <span className="reward-row__label">⚡ Comeback-Bonus!</span>
              <span className="reward-row__value">
                +<CountUp target={details.recoveryBonus} />
              </span>
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

        {/* Next floor preview */}
        {nextFloor !== undefined && (
          <div className={`victory-next-floor ${nextIsBoss ? 'victory-next-floor--boss' : nextIsMile ? 'victory-next-floor--elite' : ''}`}>
            <div className="victory-next-floor__label">NÄCHSTE ETAGE</div>
            <div className="victory-next-floor__num">{nextFloor}</div>
            {nextIsBoss ? (
              <div className="victory-next-floor__tag victory-next-floor__tag--boss">⚔ BOSS-ETAGE</div>
            ) : nextIsMile ? (
              <div className="victory-next-floor__tag victory-next-floor__tag--elite">⚡ ELITE-CHANCE</div>
            ) : (
              <div className="victory-next-floor__tag">◆ Normale Etage</div>
            )}
            {(() => {
              const base = EnemyDatabase.getFirst();
              const est = Math.round((base?.rewardCrystals ?? 100) * (1 + nextFloor * 0.2));
              return <div className="victory-next-floor__reward">💎 ~{est.toLocaleString('de-DE')} Kristalle</div>;
            })()}
          </div>
        )}

        {/* Quick Actions — one-tap navigation to next activity */}
        {quickActions.length > 0 && (
          <div className="victory-quick-actions">
            {quickActions.map(a => (
              <button
                key={a.screen}
                className="victory-quick-btn"
                onClick={() => { onContinue(); onNavigate?.(a.screen); }}
              >
                <span className="victory-quick-btn__icon">{a.icon}</span>
                <span className="victory-quick-btn__label">{a.label}</span>
              </button>
            ))}
          </div>
        )}

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
