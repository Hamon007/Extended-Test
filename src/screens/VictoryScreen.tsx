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
import { SeasonService } from '../services/SeasonService';
import { CardMasteryService } from '../services/CardMasteryService';
import { FusionSystem } from '../services/FusionSystem';
import { LevelSystem } from '../services/LevelSystem';
import { PULL_COST_MULTI } from '../config/GameConfig';
import { LuckyFloorService } from '../services/LuckyFloorService';
import { FloorTitleService } from '../services/FloorTitleService';
import { DailyLoginService } from '../services/DailyLoginService';
import { LuckySpinService } from '../services/LuckySpinService';
import { BattleStatsService } from '../services/BattleStatsService';
import { AudioService } from '../services/AudioService';
import './VictoryScreen.css';

interface Props {
  details:    RewardDetails;
  onContinue: () => void;
  onNavigate?: (screen: string) => void;
  onQuickFight?: () => void; // skip lobby, start next floor immediately
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

const VictoryScreen: React.FC<Props> = ({ details, onContinue, onNavigate, onQuickFight }) => {
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

  // Victory counter — total wins for "SIEG #N" display
  const totalWins = useMemo(() => BattleStatsService.load().totalWins, []);
  const VICTORY_MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2500];
  const isVictoryMilestone = VICTORY_MILESTONES.includes(totalWins);

  // Dynamic battle highlight chips based on performance metrics
  const highlights = useMemo(() => {
    const chips: Array<{ icon: string; label: string; variant: string }> = [];
    if (roundsElapsed > 0 && roundsElapsed <= 3) chips.push({ icon: '⚡', label: 'BLITZSIEG', variant: 'speed' });
    if (roundsElapsed >= 9)                       chips.push({ icon: '🛡', label: 'MARATHONKAMPF', variant: 'endure' });
    if (playerHpPct >= 1.0)                       chips.push({ icon: '💎', label: 'UNBERÜHRT', variant: 'pristine' });
    if (maxCombo >= 5)                            chips.push({ icon: '🌪', label: `MEISTERKOMBO ×${maxCombo}`, variant: 'combo' });
    else if (maxCombo >= 3)                       chips.push({ icon: '🔥', label: `KOMBO ×${maxCombo}`, variant: 'combo-sm' });
    if (totalDamage >= 15000)                     chips.push({ icon: '💥', label: 'VERNICHTEND', variant: 'power' });
    if (playerHpPct > 0 && playerHpPct < 0.15)   chips.push({ icon: '❤', label: 'AUF DER KIPPE!', variant: 'clutch' });
    if (grade === 'SSS')                          chips.push({ icon: '👑', label: 'SSS RANG!', variant: 'sss' });
    else if (grade === 'SS')                      chips.push({ icon: '⭐', label: 'SS RANG!', variant: 'ss' });
    if (winStreak >= 7)                           chips.push({ icon: '🔥', label: `${winStreak}× SERIE!`, variant: 'streak' });
    return chips.slice(0, 5);
  }, [roundsElapsed, playerHpPct, maxCombo, totalDamage, grade, winStreak]);

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

  // MVP card training nudge — look up the MVP card to check trainability
  const mvpTrainable = useMemo(() => {
    if (!details.mvpCardName || !onNavigate) return null;
    const gState = SaveService.loadGachaState();
    const inst = gState.inventory.find(i => {
      const c = CardDatabase.getById(i.cardId);
      return c?.name === details.mvpCardName;
    });
    if (!inst) return null;
    const cap = LevelSystem.levelCap(inst.rarity);
    if ((inst.level ?? 1) >= cap) return null; // already max level
    return { name: details.mvpCardName, level: inst.level ?? 1, cap };
  }, [details.mvpCardName, onNavigate]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Level-up overlay state: show the dramatic overlay, auto-dismiss after 3.5s
  const [showLevelUp, setShowLevelUp] = useState(() => !!(details.accountLevelUp));
  useEffect(() => {
    if (!showLevelUp) return;
    const id = setTimeout(() => setShowLevelUp(false), 3500);
    return () => clearTimeout(id);
  }, [showLevelUp]);

  // Entry audio: level-up > SSS > milestone > normal
  useEffect(() => {
    if (details.accountLevelUp) {
      AudioService.super();
      AudioService.vibrate([20, 30, 60, 30, 80]);
    } else if (grade === 'SSS') {
      AudioService.synergy();
      AudioService.vibrate([20, 20, 40]);
    } else if (isVictoryMilestone) {
      AudioService.reward();
      AudioService.vibrate([20, 30, 40]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Next floor preview (tower mode only)
  const currentFloor   = details.towerFloor;
  const nextFloor      = currentFloor !== undefined ? currentFloor + 1 : undefined;
  const nextIsBoss     = nextFloor !== undefined && TowerService.isBossFloor(nextFloor);
  const nextIsMile     = nextFloor !== undefined && nextFloor % 5 === 0 && !nextIsBoss;
  const nextIsLucky    = nextFloor !== undefined && LuckyFloorService.isLucky(nextFloor);
  const nextTitleUnlock = nextFloor !== undefined
    ? FloorTitleService.checkTitleUnlock(nextFloor - 1, nextFloor)
    : null;

  return (
    <div className="victory-screen">

      {/* ── Account Level-Up Overlay ── */}
      {showLevelUp && details.accountLevelUp && (
        <div
          className="victory-levelup-overlay"
          onClick={() => setShowLevelUp(false)}
          aria-label="Level-Up"
        >
          <div className="victory-levelup-overlay__burst" aria-hidden="true">
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className={`vlu-burst vlu-burst--${i % 4}`} style={{ '--i': i } as React.CSSProperties} />
            ))}
          </div>
          <div className="victory-levelup-overlay__card">
            <div className="vlu-eyebrow">LEVEL UP!</div>
            <div className="vlu-level">
              <span className="vlu-level__num">{details.accountLevelUp.newLevel}</span>
            </div>
            <div className="vlu-stats">
              <div className="vlu-stat">
                <span className="vlu-stat__icon">⚡</span>
                <span className="vlu-stat__label">Ausdauer</span>
                <span className="vlu-stat__val">{details.accountLevelUp.newMaxStamina}</span>
              </div>
              <div className="vlu-stat">
                <span className="vlu-stat__icon">💧</span>
                <span className="vlu-stat__label">Mana</span>
                <span className="vlu-stat__val">{details.accountLevelUp.newMaxMana.toLocaleString('de-DE')}</span>
              </div>
            </div>
            <div className="vlu-dismiss">Tippe zum Fortfahren</div>
          </div>
        </div>
      )}

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

        {/* Victory Counter */}
        {totalWins > 0 && (
          <div className={`victory-counter${isVictoryMilestone ? ' victory-counter--milestone' : ''}`}>
            {isVictoryMilestone ? (
              <>
                <span className="victory-counter__milestone-icon">🏆</span>
                <span className="victory-counter__num">{totalWins}. SIEG</span>
                <span className="victory-counter__milestone-label">MEILENSTEIN!</span>
              </>
            ) : (
              <span className="victory-counter__num">Sieg #{totalWins}</span>
            )}
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

        {/* Session Bonus milestone banner */}
        {details.sessionBonus && details.sessionBonus > 0 && (
          <div className="victory-session-bonus">
            <span className="victory-session-bonus__icon">{details.sessionBonusIcon ?? '🏆'}</span>
            <div className="victory-session-bonus__text">
              <span className="victory-session-bonus__label">{details.sessionBonusLabel ?? 'SESSION-BONUS'}</span>
              <span className="victory-session-bonus__sub">{details.sessionWins} Siege in dieser Sitzung</span>
            </div>
            <span className="victory-session-bonus__reward">+{details.sessionBonus.toLocaleString('de-DE')} 💎</span>
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

        {/* Battle Highlight Chips */}
        {highlights.length > 0 && (
          <div className="victory-highlights">
            {highlights.map((h, i) => (
              <div key={i} className={`victory-highlight-chip victory-highlight-chip--${h.variant}`}
                style={{ animationDelay: `${0.2 + i * 0.1}s` }}>
                <span className="victory-highlight-chip__icon">{h.icon}</span>
                <span className="victory-highlight-chip__label">{h.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Floor Title Unlock — shown when a new title tier is crossed */}
        {details.titleUnlocked && (
          <div
            className="victory-title-unlock"
            style={{ '--title-color': details.titleUnlocked.color } as React.CSSProperties}
          >
            <div className="victory-title-unlock__eyebrow">🏆 NEUER RANG FREIGESCHALTEN</div>
            <div className="victory-title-unlock__badge">
              <span className="victory-title-unlock__icon">{details.titleUnlocked.icon}</span>
              <span className="victory-title-unlock__name">{details.titleUnlocked.title}</span>
            </div>
          </div>
        )}

        {/* Card Performance — top damage dealers this battle */}
        {details.cardPerformance && details.cardPerformance.length > 0 && (
          <div className="victory-card-perf">
            <div className="victory-card-perf__title">⚔ Kampf-Bestleister</div>
            {details.cardPerformance.map((c, i) => {
              const maxDmg = details.cardPerformance![0]!.totalDamage;
              const barPct = maxDmg > 0 ? Math.round((c.totalDamage / maxDmg) * 100) : 0;
              return (
                <div key={i} className={`victory-card-perf__row ${i === 0 ? 'victory-card-perf__row--mvp' : ''}`}>
                  <span className="victory-card-perf__rank">{i === 0 ? '👑' : i === 1 ? '🥈' : '🥉'}</span>
                  <div className="victory-card-perf__info">
                    <div className="victory-card-perf__name">{c.cardName}</div>
                    <div className="victory-card-perf__bar-track">
                      <div className="victory-card-perf__bar-fill" style={{ width: `${barPct}%` }} />
                    </div>
                  </div>
                  <span className="victory-card-perf__dmg">{c.totalDamage.toLocaleString('de-DE')}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Season SP Progress */}
        {details.spEarned && details.spEarned > 0 && details.spTotal !== undefined && details.spRank && (
          <div className="victory-season-sp">
            <div className="victory-season-sp__header">
              <span className="victory-season-sp__icon">{SeasonService.RANK_ICONS[details.spRank as keyof typeof SeasonService.RANK_ICONS] ?? '◆'}</span>
              <span className="victory-season-sp__rank" style={{ color: SeasonService.RANK_COLORS[details.spRank as keyof typeof SeasonService.RANK_COLORS] ?? '#aaa' }}>
                {details.spRank}
              </span>
              <span className="victory-season-sp__earned">+{details.spEarned} SP</span>
              <span className="victory-season-sp__total">{details.spTotal} SP gesamt</span>
            </div>
            {(() => {
              const { progress, nextRank } = SeasonService.progressToNext(details.spTotal ?? 0);
              return nextRank ? (
                <div className="victory-season-sp__bar-wrap">
                  <div className="victory-season-sp__bar-fill" style={{
                    width: `${Math.round(progress * 100)}%`,
                    background: SeasonService.RANK_COLORS[details.spRank as keyof typeof SeasonService.RANK_COLORS] ?? '#7060c0',
                  }} />
                </div>
              ) : null;
            })()}
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
              <div key={i} className={`victory-bond-row${m.isDailyCard ? ' victory-mastery-row--daily' : ''}`}>
                <span className="victory-mastery-row__stars">{m.stars}</span>
                <span className="victory-bond-row__name">
                  {m.cardName}
                  {m.isDailyCard && <span className="victory-mastery-row__daily-tag">⭐ ×2</span>}
                </span>
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

          {/* Rage Mode ×2 */}
          {details.rageModeBonus && details.rageModeBonus > 0 && (
            <div className="reward-row reward-row--ragemode">
              <span className="reward-row__label">😡 RAGE MODE! ×2 KRISTALLE!</span>
              <span className="reward-row__value reward-row__value--ragemode">
                +<CountUp target={details.rageModeBonus} />
              </span>
            </div>
          )}

          {/* Daily Boss Victory Bonus */}
          {details.dailyBossBonus && details.dailyBossBonus > 0 && (
            <div className="reward-row reward-row--dailyboss">
              <span className="reward-row__label">👹 TAGES-BOSS BEZWUNGEN!</span>
              <span className="reward-row__value reward-row__value--dailyboss">
                +<CountUp target={details.dailyBossBonus} />
              </span>
            </div>
          )}

          {/* Element Synergy Bonus */}
          {details.elementSynergyBonus && details.elementSynergyBonus > 0 && (
            <div className="reward-row reward-row--elemsynergy">
              <span className="reward-row__label">
                ✨ ELEMENT-SYNERGIE! {details.elementSynergyCount}× Karten
              </span>
              <span className="reward-row__value reward-row__value--elemsynergy">
                +<CountUp target={details.elementSynergyBonus} />
              </span>
            </div>
          )}

          {/* Floor Record Bonus */}
          {details.floorRecordBonus && details.floorRecordBonus > 0 && (
            <div className="reward-row reward-row--floorrecord">
              <span className="reward-row__label">🏆 ETAGEN-REKORD! Etage {details.towerFloor}</span>
              <span className="reward-row__value reward-row__value--floorrecord">
                +<CountUp target={details.floorRecordBonus} />
              </span>
            </div>
          )}

          {/* Perfect Victory — won with ≥ 95% HP */}
          {details.perfectBonus && details.perfectBonus > 0 && (
            <div className="reward-row reward-row--perfect">
              <span className="reward-row__label">✨ PERFEKTER SIEG! +100</span>
              <span className="reward-row__value reward-row__value--perfect">
                +<CountUp target={details.perfectBonus} />
              </span>
            </div>
          )}

          {/* Combo Jackpot — hit MAX combo 5× */}
          {details.comboJackpotBonus && details.comboJackpotBonus > 0 && (
            <div className="reward-row reward-row--combojackpot">
              <span className="reward-row__label">🌪️ KOMBO ×5 JACKPOT! +150</span>
              <span className="reward-row__value reward-row__value--combojackpot">
                +<CountUp target={details.comboJackpotBonus} />
              </span>
            </div>
          )}

          {/* Clutch Victory — won with < 20% HP */}
          {details.clutchBonus && details.clutchBonus > 0 && (
            <div className="reward-row reward-row--clutch">
              <span className="reward-row__label">💥 LETZTE KRAFT! +150</span>
              <span className="reward-row__value reward-row__value--clutch">
                +<CountUp target={details.clutchBonus} />
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

          {/* Bounty Board reward */}
          {details.bountyBonus && details.bountyBonus > 0 && (
            <div className="reward-row reward-row--bounty">
              <span className="reward-row__label">🎯 KOPFGELD: {details.bountyEnemyName}</span>
              <span className="reward-row__value reward-row__value--bounty">
                +<CountUp target={details.bountyBonus} />
              </span>
            </div>
          )}

          {/* Daily Crystal Goal reached this battle */}
          {details.dailyGoalBonus && details.dailyGoalBonus > 0 && (
            <div className="reward-row reward-row--daily-goal">
              <span className="reward-row__label">🎯 TAGESZIEL ERREICHT!</span>
              <span className="reward-row__value reward-row__value--daily-goal">
                +<CountUp target={details.dailyGoalBonus} />
              </span>
            </div>
          )}

          {/* New daily crystal record */}
          {details.newDailyRecord && details.newDailyRecord > 0 && (
            <div className="reward-row reward-row--daily-record">
              <span className="reward-row__label">🏅 NEUER TAGESREKORD!</span>
              <span className="reward-row__value reward-row__value--daily-record">
                <CountUp target={details.newDailyRecord} /> 💎
              </span>
            </div>
          )}

          {/* Daily Duo bonus */}
          {details.dailyDuoBonus && details.dailyDuoBonus > 0 && (
            <div className="reward-row reward-row--dailyduo">
              <span className="reward-row__label">💞 TAGES-DUO BONUS!</span>
              <span className="reward-row__value reward-row__value--dailyduo">
                +<CountUp target={details.dailyDuoBonus} />
              </span>
            </div>
          )}

          {/* Hourly First Win bonus */}
          {details.hourlyFirstWinBonus && details.hourlyFirstWinBonus > 0 && (
            <div className="reward-row reward-row--hourly">
              <span className="reward-row__label">⏰ Erster Sieg dieser Stunde!</span>
              <span className="reward-row__value">+{details.hourlyFirstWinBonus} 💎</span>
            </div>
          )}

          {/* Hour Surge bonus */}
          {details.hourSurgeBonus && details.hourSurgeBonus > 0 && (
            <div className="reward-row reward-row--hoursurge">
              <span className="reward-row__label">⚡ STUNDEN-SURGE! +50%</span>
              <span className="reward-row__value reward-row__value--hoursurge">
                +<CountUp target={details.hourSurgeBonus} />
              </span>
            </div>
          )}

          {/* Lucky Day +10% */}
          {details.luckyDayBonus && details.luckyDayBonus > 0 && (
            <div className="reward-row reward-row--luckyday">
              <span className="reward-row__label">🍀 LUCKY DAY! +10%</span>
              <span className="reward-row__value reward-row__value--luckyday">
                +<CountUp target={details.luckyDayBonus} />
              </span>
            </div>
          )}

          {/* Battle Contract fulfilled */}
          {details.contractBonus && details.contractBonus > 0 && (
            <div className="reward-row reward-row--contract">
              <span className="reward-row__label">
                {details.contractIcon ?? '📜'} VERTRAG ERFÜLLT: {details.contractLabel}
              </span>
              <span className="reward-row__value reward-row__value--contract">
                +<CountUp target={details.contractBonus} />
              </span>
            </div>
          )}

          {/* Quest Completions triggered by this battle */}
          {details.questsCompleted && details.questsCompleted.length > 0 && (
            <div className="victory-quest-completions">
              <div className="victory-quest-completions__title">📜 Quest abgeschlossen!</div>
              {details.questsCompleted.map((q, i) => (
                <div key={i} className="reward-row reward-row--questdone">
                  <span className="reward-row__label">✓ {q.title}</span>
                  <span className="reward-row__value reward-row__value--questdone">
                    +<CountUp target={q.crystals} />
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Weekly Pass — newly reached milestones */}
          {details.passNewMilestones && details.passNewMilestones.length > 0 && (
            <div className="victory-quest-completions">
              <div className="victory-quest-completions__title">🗓 Wöchentlicher Pass</div>
              {details.passNewMilestones.map((m, i) => (
                <div key={i} className="reward-row reward-row--passmilestone">
                  <span className="reward-row__label">{m.icon} {m.label} erreicht!</span>
                  <span className="reward-row__value reward-row__value--passmilestone">
                    +{m.crystals.toLocaleString('de-DE')} 💎 abrufbar
                  </span>
                </div>
              ))}
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
          {details.newCards.length > 0 && (() => {
            // Find weakest deck card ATK for comparison
            const gs = SaveService.loadGachaState();
            const deck = SaveService.loadDeck();
            let weakestAtk = 0;
            let weakestName = '';
            for (const uuid of deck.uuids) {
              const inst = gs.inventory.find(i => i.uuid === uuid);
              if (!inst) continue;
              const c = CardDatabase.getById(inst.cardId);
              if (!c) continue;
              const stats = FusionSystem.getEffectiveStats(c, inst.rarity, inst.level ?? 1);
              if (weakestAtk === 0 || stats.atk < weakestAtk) {
                weakestAtk = stats.atk;
                weakestName = c.name;
              }
            }
            return (
              <div className="victory-cards">
                <div className="victory-cards__title">🃏 Neue Karten erhalten!</div>
                <div className="victory-cards__grid">
                  {details.newCards.map(inst => (
                    <RewardCardItem key={inst.uuid} cardId={inst.cardId} weakestDeckAtk={weakestAtk} weakestDeckName={weakestName} />
                  ))}
                </div>
              </div>
            );
          })()}

          {details.newCards.length === 0 && (
            <div className="victory-no-drop">
              Kein Karten-Drop dieses Mal.
            </div>
          )}
        </div>

        {/* Next floor preview */}
        {nextFloor !== undefined && (
          <div className={`victory-next-floor${nextIsBoss ? ' victory-next-floor--boss' : nextIsMile ? ' victory-next-floor--elite' : ''}${nextIsLucky ? ' victory-next-floor--lucky' : ''}`}>
            <div className="victory-next-floor__label">NÄCHSTE ETAGE</div>
            <div className="victory-next-floor__num">{nextFloor}</div>
            <div className="victory-next-floor__tags">
              {nextIsBoss && (
                <div className="victory-next-floor__tag victory-next-floor__tag--boss">⚔ BOSS-ETAGE</div>
              )}
              {nextIsLucky && (
                <div className="victory-next-floor__tag victory-next-floor__tag--lucky">⭐ GLÜCKSETAGE +30%</div>
              )}
              {nextIsMile && !nextIsLucky && (
                <div className="victory-next-floor__tag victory-next-floor__tag--elite">⚡ ELITE-CHANCE</div>
              )}
              {!nextIsBoss && !nextIsMile && !nextIsLucky && (
                <div className="victory-next-floor__tag">◆ Normale Etage</div>
              )}
              {nextTitleUnlock && (
                <div
                  className="victory-next-floor__tag victory-next-floor__tag--title"
                  style={{ '--title-color': nextTitleUnlock.color } as React.CSSProperties}
                >
                  {nextTitleUnlock.icon} RANG: {nextTitleUnlock.title}
                </div>
              )}
            </div>
            {(() => {
              const base = EnemyDatabase.getFirst();
              const mult = nextIsLucky ? 1.3 : 1;
              const est = Math.round((base?.rewardCrystals ?? 100) * (1 + nextFloor * 0.2) * mult);
              return (
                <div className={`victory-next-floor__reward${nextIsLucky ? ' victory-next-floor__reward--lucky' : ''}`}>
                  💎 ~{est.toLocaleString('de-DE')} Kristalle
                  {nextIsLucky && <span className="victory-next-floor__reward-bonus"> (+30%)</span>}
                </div>
              );
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

        {/* MVP card training nudge */}
        {mvpTrainable && (
          <div
            className="victory-mvp-nudge"
            onClick={() => { onContinue(); onNavigate?.('training'); }}
            role="button"
            tabIndex={0}
          >
            <span className="victory-mvp-nudge__icon">⭐</span>
            <div className="victory-mvp-nudge__body">
              <span className="victory-mvp-nudge__title">MVP: {mvpTrainable.name}</span>
              <span className="victory-mvp-nudge__sub">
                Lv {mvpTrainable.level} → {mvpTrainable.level + 1} — stärke deinen besten Kämpfer!
              </span>
            </div>
            <span className="victory-mvp-nudge__cta">TRAINIEREN ▶</span>
          </div>
        )}

        {/* Gacha pull progress nudge */}
        {(() => {
          const gs       = SaveService.loadGachaState();
          const crystals = gs.crystals;
          const needed   = PULL_COST_MULTI - (crystals % PULL_COST_MULTI);
          const base     = EnemyDatabase.getFirst();
          const estPer   = Math.round((base?.rewardCrystals ?? 150) * (1 + (details.towerFloor ?? 1) * 0.2));
          const battlesLeft = estPer > 0 ? Math.max(1, Math.ceil(needed / estPer)) : null;
          if (crystals < 200 || needed > PULL_COST_MULTI * 0.9) return null;
          return (
            <div className="victory-pull-nudge" onClick={() => { onContinue(); onNavigate?.('gacha'); }}>
              <span className="victory-pull-nudge__icon">✨</span>
              <div className="victory-pull-nudge__text">
                <span className="victory-pull-nudge__label">
                  {needed <= 0
                    ? 'Genug für eine 10er-Beschwörung!'
                    : `Noch ${needed.toLocaleString('de-DE')} 💎 zur nächsten Beschwörung`}
                </span>
                {battlesLeft !== null && needed > 0 && (
                  <span className="victory-pull-nudge__battles">
                    ≈ {battlesLeft} {battlesLeft === 1 ? 'weiterer Kampf' : 'weitere Kämpfe'}
                  </span>
                )}
              </div>
              <span className="victory-pull-nudge__crystals">{crystals.toLocaleString('de-DE')} 💎</span>
            </div>
          );
        })()}

        {/* Tomorrow's Rewards preview — retention hook */}
        {(() => {
          const currentDay   = DailyLoginService.getStreakDay();
          const tomorrowDay  = currentDay >= 7 ? 1 : currentDay + 1;
          const tomorrowRew  = DailyLoginService.DAY_REWARDS[tomorrowDay - 1];
          const spinReady    = LuckySpinService.canSpin();
          if (!tomorrowRew) return null;
          return (
            <div className="victory-tomorrow">
              <div className="victory-tomorrow__header">🌙 Morgen wartet auf dich</div>
              <div className="victory-tomorrow__row">
                <span className="victory-tomorrow__icon">📅</span>
                <span className="victory-tomorrow__label">Login-Bonus Tag {tomorrowDay}</span>
                <span className="victory-tomorrow__value">
                  +{tomorrowRew.crystals.toLocaleString('de-DE')} 💎
                  {tomorrowRew.potions > 0 && ` + ${tomorrowRew.potions}🧪`}
                </span>
              </div>
              {spinReady && (
                <div className="victory-tomorrow__row">
                  <span className="victory-tomorrow__icon">🎡</span>
                  <span className="victory-tomorrow__label">Glücksrad</span>
                  <span className="victory-tomorrow__value victory-tomorrow__value--available">BEREIT!</span>
                </div>
              )}
            </div>
          );
        })()}

        {/* Quick Fight — skip lobby, start next floor */}
        {onQuickFight && details.towerFloor && (
          <button className="victory-quickfight-btn" onClick={onQuickFight}>
            ⚔ ETAGE {details.towerFloor + 1} ANGREIFEN!
          </button>
        )}

        {/* Weiter-Button */}
        <button className={`victory-btn${onQuickFight ? ' victory-btn--secondary' : ''}`} onClick={onContinue}>
          ◀ Zurück zur Auswahl
        </button>

      </div>
    </div>
  );
};

// ── Einzelne Belohnungs-Karte ─────────────────────────────────

const RewardCardItem: React.FC<{ cardId: string; weakestDeckAtk?: number; weakestDeckName?: string }> = ({ cardId, weakestDeckAtk, weakestDeckName }) => {
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
  const newCardAtk = FusionSystem.getEffectiveStats(card, card.rarity, 1).atk;
  const isUpgrade = weakestDeckAtk !== undefined && weakestDeckAtk > 0 && newCardAtk > weakestDeckAtk;

  return (
    <div
      className={`reward-card${isUpgrade ? ' reward-card--upgrade' : ''}`}
      style={{ '--rc': rc } as React.CSSProperties}
    >
      {isUpgrade && (
        <div className="reward-card__upgrade-badge">
          ⬆ UPGRADE
          {weakestDeckName && <span className="reward-card__upgrade-vs"> vs {weakestDeckName}</span>}
        </div>
      )}
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
      <div className="reward-card__atk">ATK {newCardAtk.toLocaleString('de-DE')}</div>
    </div>
  );
};

export default VictoryScreen;
