import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useBattleStore }       from '../hooks/useBattleStore';
import { useTacticalStore }     from '../hooks/useTacticalStore';
import { useComboStore }        from '../hooks/useComboStore';
import { useDeckStore }         from '../hooks/useDeckStore';
import { useEnergyStore }       from '../hooks/useEnergyStore';
import { EnergyService }        from '../services/EnergyService';
import { EnemyDatabase }        from '../services/EnemyDatabase';
import { TowerService }         from '../services/TowerService';
import { SaveService }          from '../services/SaveService';
import { ComboSystem }          from '../services/ComboSystem';
import { ProgressionService }   from '../services/ProgressionService';
import { QuestService }         from '../services/QuestService';
import { LeaderService }        from '../services/LeaderService';
import { FormationService }     from '../services/FormationService';
import { DailyTrialService } from '../services/DailyTrialService';
import { WinStreakService }  from '../services/WinStreakService';
import { TowerEventService, type TowerEvent } from '../services/TowerEventService';
import { CardDatabase }         from '../services/CardDatabase';
import { AudioService }         from '../services/AudioService';
import { PvpService } from '../services/PvpService';
import { AchievementService } from '../services/AchievementService';
import { CardBondService }    from '../services/CardBondService';
import { SeasonService }      from '../services/SeasonService';
import { TowerMilestoneService, type TowerMilestone } from '../services/TowerMilestoneService';
import { CardMasteryService } from '../services/CardMasteryService';
import { FusionSystem }       from '../services/FusionSystem';
import { FirstWinService } from '../services/FirstWinService';
import { RecoveryService } from '../services/RecoveryService';
import { WeekendBonusService } from '../services/WeekendBonusService';
import { DailyCardService }   from '../services/DailyCardService';
import { BattleStatsService } from '../services/BattleStatsService';
import { EnemyTauntService } from '../services/EnemyTauntService';
import { BossRushService }   from '../services/BossRushService';
import { ElementalService }  from '../services/ElementalService';
import { TowerLore }            from '../data/towerLore';
import { BattleManager, type BattleMeta, type RuneBoost } from '../services/BattleManager';
import { AccountProgressionService } from '../services/AccountProgressionService';
import { GUARD_MP_COST }        from '../config/GameConfig';
import type { Card }            from '../types/Card';
import ComboDisplay             from '../components/ComboDisplay';
import VictoryScreen            from './VictoryScreen';
import DefeatScreen             from './DefeatScreen';
import type { BattleCard, BattleState, EnemyData } from '../types/BattleTypes';
import type { DamagePopup }     from '../types/ComboTypes';
import type { RewardDetails }   from '../types/ProgressionTypes';
import type { TacticalBattleState, TacticalEnemyConfig } from '../types/TacticalBattleTypes';
import { MAX_ROUNDS }           from '../types/BattleTypes';
import { DECK_SIZE }            from '../types/DeckTypes';
import { RARITY_COLOR }         from '../types/Card';
import './BattleScreen.css';

// ── Haupt-Screen ──────────────────────────────────────────────

function fmtRegen(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

interface BattleScreenProps {
  onNavigate?: (screen: string) => void;
}

const BattleScreen: React.FC<BattleScreenProps> = ({ onNavigate }) => {
  const battle = useBattleStore();
  const deck   = useDeckStore();
  const energy = useEnergyStore();

  const [rewardDetails,  setRewardDetails]  = useState<RewardDetails | null>(null);
  const [tacticalConfig, setTacticalConfig] = useState<TacticalEnemyConfig | null>(null);
  const [isTowerMode,    setIsTowerMode]    = useState(false);
  const [towerFloor,     setTowerFloor]     = useState(() => TowerService.getFloor());
  const [loreOverlay,    setLoreOverlay]    = useState<{ floor: number; type: 'normal'|'elite'|'boss' } | null>(null);
  const [pendingMeta,    setPendingMeta]    = useState<{ enemy: EnemyData; meta: BattleMeta; tact: TacticalEnemyConfig | null } | null>(null);
  const [towerEvent,     setTowerEvent]     = useState<TowerEvent | null>(null);
  const [eventToast,     setEventToast]     = useState('');
  const [winStreak,      setWinStreak]      = useState(() => WinStreakService.get());
  const [isPvpMode,      setIsPvpMode]      = useState(false);
  const pvpOpponentRef = useRef<string>('');
  const [towerMilestone, setTowerMilestone] = useState<TowerMilestone | null>(null);
  const [enemyTaunt,     setEnemyTaunt]     = useState<string | null>(null);
  const lowHpTauntFired    = useRef(false);
  const lastStandShownRef  = useRef(false);
  const [selectedRune,   setSelectedRune]   = useState<RuneBoost | null>(null);
  const [showLastStand,  setShowLastStand]  = useState(false);
  const [revengeFloor,   setRevengeFloor]   = useState<number | null>(() => {
    const v = localStorage.getItem('ci_defeat_floor');
    return v ? parseInt(v, 10) : null;
  });
  const crystalRuneMultRef = useRef(1.0);
  // Boss Rush
  const bossRushWaveRef       = useRef(0);   // 0 = not in boss rush; 1-5 = current wave
  const bossRushCrystalsRef   = useRef(0);   // accumulated crystals across waves
  const bossRushXpRef         = useRef(0);   // accumulated XP
  const [bossRushWaveComplete, setBossRushWaveComplete] = useState<{ wave: number; crystals: number } | null>(null);
  const [bossRushCanAttempt,   setBossRushCanAttempt]   = useState(() => BossRushService.canAttempt());
  const highestFloor = TowerService.getHighestFloor();
  const [energyRegenMs, setEnergyRegenMs] = useState(() => EnergyService.msUntilNextRegen());
  const rewardApplied  = useRef(false);
  const pvpConsumedRef = useRef(false);

  const inventory     = useMemo(() => SaveService.loadGachaState().inventory, []);
  const deckInstances = useMemo(() => {
    const invMap = new Map(inventory.map(i => [i.uuid, i]));
    return deck.deck.uuids
      .map(uuid => invMap.get(uuid))
      .filter((i): i is NonNullable<typeof i> => i !== undefined);
  }, [deck.deck.uuids, inventory]);

  const deckComplete = deckInstances.length === DECK_SIZE;

  // Deck-Karten als Card-Objekte (für Leader/Formation)
  const deckCards: Card[] = useMemo(
    () => deckInstances
      .map(inst => CardDatabase.getById(inst.cardId))
      .filter((c): c is Card => !!c),
    [deckInstances],
  );

  const leaderBonus        = useMemo(() => LeaderService.computeBonus(deckCards[0]), [deckCards]);
  const formation          = useMemo(() => FormationService.compute(deckCards), [deckCards]);
  const dailyCardAtkBoost  = DailyCardService.getAtkBonus();
  const accountXpProgress  = useMemo(() => {
    const acc = SaveService.loadAccountState();
    const needed = AccountProgressionService.xpToNextLevel(acc.level);
    return needed > 0 ? acc.xp / needed : 1;
  }, []);

  // Power comparison: effective ATK per card
  const deckPower = useMemo(() => {
    if (deckInstances.length === 0) return 0;
    return deckInstances.reduce((sum, inst) => {
      const card = CardDatabase.getById(inst.cardId);
      if (!card) return sum;
      const stats = FusionSystem.getEffectiveStats(card, inst.rarity, inst.level);
      return sum + stats.atk + CardMasteryService.getAtkBonus(inst.cardId);
    }, 0);
  }, [deckInstances]);

  // Enemy estimated power based on floor scaling (avg base ATK ≈ 2600 per card × floor scale)
  const enemyPowerEstimate = useMemo(() => {
    const BASE_AVG_ATK_PER_CARD = 2600;
    const floorScale = 1 + towerFloor * 0.1;
    const BASE_CARD_COUNT = 3.5;
    return Math.round(BASE_AVG_ATK_PER_CARD * floorScale * BASE_CARD_COUNT);
  }, [towerFloor]);

  // Tagesprüfung
  const dailyTrial = useMemo(() => DailyTrialService.today(), []);
  const dailyDone  = DailyTrialService.isCompleted();

  // Energy regen ticker (lobby only)
  useEffect(() => {
    const id = setInterval(() => {
      setEnergyRegenMs(EnergyService.msUntilNextRegen());
      energy.refresh();
    }, 1000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // PvP: Automatisch starten wenn ein Gegner anstehend ist
  useEffect(() => {
    if (pvpConsumedRef.current) return;
    const pending = PvpService.consumePendingBattle();
    if (!pending) return;
    pvpConsumedRef.current = true;
    setIsPvpMode(true);
    pvpOpponentRef.current = pending.opponent.displayName;
    battle.startBattle(deckInstances, pending.enemy, { leaderBonus, formation, dailyCardAtkBoost });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Enemy taunt on battle start
  useEffect(() => {
    if (!battle.state || battle.state.result) return;
    lowHpTauntFired.current   = false;
    lastStandShownRef.current = false;
    const tier = TowerService.isBossFloor(towerFloor) ? 'boss'
      : tacticalConfig ? 'elite'
      : 'normal';
    const taunt = EnemyTauntService.getTaunt('battle_start', tier);
    setEnemyTaunt(taunt);
    const id = setTimeout(() => setEnemyTaunt(null), 3000);
    return () => clearTimeout(id);
  }, [!!battle.state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Enemy low-HP taunt (fires once when enemy drops below 30%)
  useEffect(() => {
    if (!battle.state || battle.state.result || lowHpTauntFired.current) return;
    const { hp, hpMax } = battle.state.enemy;
    if (hpMax > 0 && hp / hpMax < 0.3) {
      lowHpTauntFired.current = true;
      const tier = TowerService.isBossFloor(towerFloor) ? 'boss'
        : tacticalConfig ? 'elite'
        : 'normal';
      const taunt = EnemyTauntService.getTaunt('low_hp', tier);
      setEnemyTaunt(taunt);
      const id = setTimeout(() => setEnemyTaunt(null), 3500);
      return () => clearTimeout(id);
    }
  }, [battle.state?.enemy.hp]); // eslint-disable-line react-hooks/exhaustive-deps

  // Last Stand: show dramatic overlay when player HP drops to ≤ 15%
  useEffect(() => {
    if (!battle.state?.lastStandActive || lastStandShownRef.current) return;
    if (battle.state.result) return;
    lastStandShownRef.current = true;
    setShowLastStand(true);
    const id = setTimeout(() => setShowLastStand(false), 2800);
    return () => clearTimeout(id);
  }, [battle.state?.lastStandActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // Belohnungen einmalig anwenden wenn Battle endet
  useEffect(() => {
    if (!battle.state?.result || rewardApplied.current) return;
    rewardApplied.current = true;

    // Battle-Statistiken aus State
    const totalDamage = battle.state.log
      .filter(e => e.actor === 'player')
      .reduce((sum, e) => sum + e.damage, 0);
    const maxCombo = battle.state.maxComboReached ?? 0;

    // Kartenband-Tracking: Karten die im Deck waren, erhalten Bond-XP
    const deckCardIds = deckInstances.map(i => i.cardId);
    const bondResults = CardBondService.recordBattle(deckCardIds);

    // Karten-Meisterschaft: Spielzähler aus Battle-Log aktualisieren
    const nameToCardId: Record<string, string> = {};
    for (const inst of deckInstances) {
      const card = CardDatabase.getById(inst.cardId);
      if (card) nameToCardId[card.name] = inst.cardId;
    }
    const playCountByCard: Record<string, number> = {};
    for (const entry of battle.state.log) {
      if (entry.actor === 'player') {
        const cardId = nameToCardId[entry.cardName];
        if (cardId) playCountByCard[cardId] = (playCountByCard[cardId] ?? 0) + 1;
      }
    }
    const masteryLevelUps: { cardName: string; newLevel: number; stars: string }[] = [];
    for (const [cardId, count] of Object.entries(playCountByCard)) {
      const res = CardMasteryService.recordPlays(cardId, count);
      if (res.leveledUp) {
        masteryLevelUps.push({
          cardName: CardDatabase.getById(cardId)?.name ?? cardId,
          newLevel: res.newLevel,
          stars:    CardMasteryService.MASTERY_LEVELS[res.newLevel]?.stars ?? '',
        });
        AchievementService.recordProgress('mastery_first');
        if (res.newLevel >= CardMasteryService.MASTERY_LEVELS.length - 1) {
          AchievementService.recordProgress('mastery_max');
        }
      }
    }
    const bondLevelUps = bondResults
      .filter(r => r.leveledUp)
      .map(r => ({
        cardId:   r.cardId,
        cardName: CardDatabase.getById(r.cardId)?.name ?? r.cardId,
        newLevel: r.newLevel,
      }));

    // Capture streak before applyRewards resets it on defeat
    const preDefeatStreak = WinStreakService.get();
    const details = ProgressionService.applyRewards(
      battle.state.result,
      battle.state.enemyData,
    );

    // Performance grade (victory only)
    let grade: RewardDetails['grade'] | undefined;
    const playerHpPct = battle.state.player.hpMax > 0
      ? battle.state.player.hp / battle.state.player.hpMax
      : 0;
    const roundsElapsed = battle.state.round;
    if (details.isVictory) {
      const score = playerHpPct * 40 + Math.min(40, (maxCombo / 10) * 40) + Math.max(0, (10 - roundsElapsed) * 2);
      if (score >= 95)      grade = 'SSS';
      else if (score >= 80) grade = 'SS';
      else if (score >= 65) grade = 'S';
      else if (score >= 45) grade = 'A';
      else if (score >= 30) grade = 'B';
      else if (score >= 15) grade = 'C';
      else                  grade = 'D';
    }

    const enemyHpPct = battle.state.enemy.hpMax > 0
      ? battle.state.enemy.hp / battle.state.enemy.hpMax
      : 0;

    // Apply Fortune rune crystal multiplier
    let finalDetails = { ...details, maxCombo, totalDamage, bondLevelUps, masteryLevelUps, playerHpPct, enemyHpPct, roundsElapsed, grade };
    if (crystalRuneMultRef.current > 1.0 && details.isVictory) {
      const boosted = Math.round(details.crystalsGained * crystalRuneMultRef.current);
      const extra = boosted - details.crystalsGained;
      finalDetails = { ...finalDetails, crystalsGained: boosted };
      const gState = SaveService.loadGachaState();
      SaveService.saveGachaState({ ...gState, crystals: gState.crystals + extra });
      crystalRuneMultRef.current = 1.0;
    }

    // First win of the day bonus
    if (details.isVictory) {
      const firstWinBonus = FirstWinService.claim();
      if (firstWinBonus > 0) {
        finalDetails = { ...finalDetails, firstWinBonus };
      }
    }

    // Last Stand Victory bonus (+100 crystals for winning from the brink)
    if (details.isVictory && battle.state.lastStandActive) {
      const LAST_STAND_BONUS = 100;
      const gls = SaveService.loadGachaState();
      SaveService.saveGachaState({ ...gls, crystals: gls.crystals + LAST_STAND_BONUS });
      finalDetails = { ...finalDetails, crystalsGained: finalDetails.crystalsGained + LAST_STAND_BONUS };
    }

    // ── Boss Rush flow ────────────────────────────────────────
    const currentBossWave = bossRushWaveRef.current;
    if (currentBossWave > 0) {
      if (finalDetails.isVictory) {
        bossRushCrystalsRef.current += finalDetails.crystalsGained;
        bossRushXpRef.current       += finalDetails.xpGained ?? 0;

        if (currentBossWave < BossRushService.BOSS_RUSH_WAVES) {
          // Intermediate wave complete — show overlay, then auto-start next wave
          setBossRushWaveComplete({ wave: currentBossWave, crystals: bossRushCrystalsRef.current });
          setTimeout(() => {
            setBossRushWaveComplete(null);
            battle.resetBattle();
            startBossRushWave(currentBossWave + 1);
          }, 2600);
          return; // Skip normal VictoryScreen
        } else {
          // All 5 waves done — award completion bonus and show final victory
          const totalCrystals = bossRushCrystalsRef.current + BossRushService.BOSS_RUSH_COMPLETION_BONUS;
          const gs = SaveService.loadGachaState();
          SaveService.saveGachaState({ ...gs, crystals: gs.crystals + BossRushService.BOSS_RUSH_COMPLETION_BONUS });
          finalDetails = { ...finalDetails, crystalsGained: totalCrystals };
          bossRushWaveRef.current = 0;
        }
      } else {
        // Defeat during boss rush — show what was accumulated
        finalDetails = { ...finalDetails, crystalsGained: bossRushCrystalsRef.current };
        bossRushWaveRef.current = 0;
      }
    }
    // ── End Boss Rush flow ────────────────────────────────────

    // Detect new personal records (before recording stats)
    if (details.isVictory) {
      const prevStats = BattleStatsService.load();
      const newRecords: Array<'combo' | 'damage' | 'streak' | 'floor'> = [];
      if (maxCombo > 0 && maxCombo > prevStats.bestCombo) newRecords.push('combo');
      const currentStreak = WinStreakService.get();
      if (currentStreak > prevStats.bestWinStreak)        newRecords.push('streak');
      // New highest tower floor record
      if (isTowerMode && towerFloor > TowerService.getHighestFloor()) newRecords.push('floor');
      if (newRecords.length > 0) finalDetails = { ...finalDetails, newRecords };
    }

    // Attach pre-defeat streak so DefeatScreen can show the broken-streak banner
    if (!details.isVictory && preDefeatStreak >= 1) {
      finalDetails = { ...finalDetails, winStreak: preDefeatStreak };
    }

    // Recovery Bonus: +50% crystals on first win after a defeat
    if (details.isVictory) {
      const recoveryBonus = RecoveryService.claim(finalDetails.crystalsGained);
      if (recoveryBonus > 0) {
        const gst = SaveService.loadGachaState();
        SaveService.saveGachaState({ ...gst, crystals: gst.crystals + recoveryBonus });
        finalDetails = {
          ...finalDetails,
          crystalsGained: finalDetails.crystalsGained + recoveryBonus,
          recoveryBonus,
        };
      }
    } else {
      RecoveryService.activate();
    }

    // Weekend Bonus: +25% crystals on Sat/Sun victories
    if (details.isVictory) {
      const weekendBonus = WeekendBonusService.applyBonus(finalDetails.crystalsGained);
      if (weekendBonus > 0) {
        const gst = SaveService.loadGachaState();
        SaveService.saveGachaState({ ...gst, crystals: gst.crystals + weekendBonus });
        finalDetails = {
          ...finalDetails,
          crystalsGained: finalDetails.crystalsGained + weekendBonus,
          weekendBonus,
        };
      }
    }

    // Embed tower floor context for VictoryScreen next-floor preview
    if (isTowerMode) {
      finalDetails = { ...finalDetails, towerFloor };
    }

    // Track revenge floor: store on defeat, clear on victory
    if (isTowerMode) {
      if (finalDetails.isVictory) {
        localStorage.removeItem('ci_defeat_floor');
        setRevengeFloor(null);
      } else {
        localStorage.setItem('ci_defeat_floor', String(towerFloor));
        setRevengeFloor(towerFloor);
      }
    }

    // Result taunt (shown briefly on victory/defeat screen)
    const resultTier = TowerService.isBossFloor(towerFloor) ? 'boss'
      : tacticalConfig ? 'elite'
      : 'normal';
    const resultTrigger = details.isVictory ? 'player_victory' : 'enemy_victory';
    setEnemyTaunt(EnemyTauntService.getTaunt(resultTrigger, resultTier));
    setTimeout(() => setEnemyTaunt(null), 4000);

    setRewardDetails(finalDetails);

    // Aufgaben-Fortschritt + Achievements
    if (battle.state.result.outcome === 'victory') {
      QuestService.recordEvent('win_battles');
      if (isTowerMode) {
        QuestService.recordEvent('reach_floor', 1, { floor: towerFloor });
        if (tacticalConfig) {
          if (TowerService.isBossFloor(towerFloor)) QuestService.recordEvent('defeat_boss');
          else QuestService.recordEvent('defeat_elite');
        }
        if (towerFloor >= 10) AchievementService.recordProgress('tower_10');
        if (towerFloor >= 30) AchievementService.recordProgress('tower_30');
        if (towerFloor >= 50) AchievementService.recordProgress('tower_50');
      }
      AchievementService.recordProgress('first_win');
      AchievementService.recordProgress('wins_10');
      AchievementService.recordProgress('wins_50');
      AchievementService.recordProgress('wins_100');
      const streak = WinStreakService.get();
      if (streak >= 3)  QuestService.recordEvent('win_streak_3');
      if (streak >= 5)  AchievementService.recordProgress('win_streak_5');
      if (streak >= 10) AchievementService.recordProgress('win_streak_10');

      // Season Points + SP quest
      if (isTowerMode) {
        const isBossFloor = TowerService.isBossFloor(towerFloor);
        const isElite = tacticalConfig && !isBossFloor;
        const spAmount = isBossFloor ? SeasonService.SP_REWARDS.boss_win
          : isElite ? SeasonService.SP_REWARDS.elite_win
          : SeasonService.SP_REWARDS.tower_win;
        SeasonService.addSp(spAmount);
        QuestService.recordEvent('earn_sp', spAmount);
        // Season rank achievements
        const updatedState = SeasonService.load();
        const spNow = updatedState.sp;
        if (spNow >= 100)  AchievementService.recordProgress('season_fighter');
        if (spNow >= 1500) AchievementService.recordProgress('season_champion');
        if (spNow >= 6000) AchievementService.recordProgress('season_legend');
      }
      // Combat milestones
      if (towerFloor >= 100) AchievementService.recordProgress('tower_100');
      const maxComboCheck = battle.state.maxComboReached ?? 0;
      if (maxComboCheck >= 10) AchievementService.recordProgress('combo_10');
    }

    // PvP: Ergebnis speichern + Achievements
    if (isPvpMode) {
      void PvpService.recordResult(
        battle.state.result.outcome === 'victory' ? 'win' : 'loss',
        pvpOpponentRef.current || undefined,
      );
      if (battle.state.result.outcome === 'victory') {
        AchievementService.recordProgress('pvp_first_win');
        AchievementService.recordProgress('pvp_10_wins');
        SeasonService.addSp(SeasonService.SP_REWARDS.pvp_win);
        QuestService.recordEvent('earn_sp', SeasonService.SP_REWARDS.pvp_win);
      } else {
        SeasonService.addSp(SeasonService.SP_REWARDS.pvp_loss);
        QuestService.recordEvent('earn_sp', SeasonService.SP_REWARDS.pvp_loss);
      }
    }

    // Lifetime battle stats
    const victory = battle.state.result.outcome === 'victory';
    const lifetimeDamage = battle.state.log
      .filter(e => e.actor === 'player')
      .reduce((s, e) => s + e.damage, 0);
    BattleStatsService.recordBattle({
      victory,
      isPvp:    isPvpMode,
      isTower:  isTowerMode,
      damage:   lifetimeDamage,
      combo:    battle.state.maxComboReached ?? 0,
      winStreak: WinStreakService.get(),
    });
  }, [battle.state?.result]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleContinue = useCallback(() => {
    if (rewardDetails?.isVictory && isTowerMode) {
      const next = TowerService.advanceFloor();
      TowerService.updateHighestFloor(next);
      setTowerFloor(next);
      // Check for floor milestone reward
      const milestone = TowerMilestoneService.checkFloor(next);
      if (milestone) setTowerMilestone(milestone);
    }
    battle.resetBattle();
    setRewardDetails(null);
    setTacticalConfig(null);
    setIsTowerMode(false);
    setIsPvpMode(false);
    pvpConsumedRef.current = false;
    setWinStreak(WinStreakService.get());
    rewardApplied.current = false;
    energy.refresh();
  }, [battle, energy, rewardDetails, isTowerMode]);

  const handleTowerRetry = useCallback(() => {
    if (!energy.consume()) return;
    battle.resetBattle();
    setRewardDetails(null);
    rewardApplied.current = false;
    setIsTowerMode(true);
    startFloorBattle();
  }, [battle, energy]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Enemy Taunt bubble ────────────────────────────────────
  const tauntBubble = enemyTaunt ? (
    <div className="enemy-taunt-bubble">
      <span className="enemy-taunt-bubble__text">💬 {enemyTaunt}</span>
    </div>
  ) : null;

  // ── Boss Rush Wave Complete overlay ──────────────────────
  const bossRushWaveOverlay = bossRushWaveComplete ? (
    <div className="boss-rush-wave-overlay">
      <div className="boss-rush-wave-overlay__content">
        <div className="boss-rush-wave-overlay__label">WELLE {bossRushWaveComplete.wave} GESCHAFFT!</div>
        <div className="boss-rush-wave-overlay__gems">💎 {bossRushWaveComplete.crystals.toLocaleString('de-DE')} angesammelt</div>
        <div className="boss-rush-wave-overlay__next">
          Welle {bossRushWaveComplete.wave + 1} von {BossRushService.BOSS_RUSH_WAVES} startet …
        </div>
      </div>
    </div>
  ) : null;

  // ── Last Stand Flash ──────────────────────────────────────
  const lastStandOverlay = showLastStand ? (
    <div className="last-stand-overlay">
      <div className="last-stand-overlay__content">
        <div className="last-stand-overlay__kanji">限界突破</div>
        <div className="last-stand-overlay__title">LETZTE KRAFT!</div>
        <div className="last-stand-overlay__sub">ATK ×1.5 — jetzt kämpfen!</div>
      </div>
    </div>
  ) : null;

  // ── Tower Milestone Overlay (shown over any screen) ──────
  const milestoneOverlay = towerMilestone ? (
    <div className="milestone-overlay" onClick={() => setTowerMilestone(null)}>
      <div className="milestone-modal">
        <div className="milestone-modal__icon">🏆</div>
        <div className="milestone-modal__floor">ETAGE {towerMilestone.floor}</div>
        <div className="milestone-modal__label">{towerMilestone.label}</div>
        <div className="milestone-modal__reward">
          <span className="milestone-modal__crystals">+{towerMilestone.crystals.toLocaleString('de-DE')}</span>
          <span className="milestone-modal__gem">💎</span>
        </div>
        <button className="milestone-modal__close" onClick={() => setTowerMilestone(null)}>Weiter ›</button>
      </div>
    </div>
  ) : null;

  // ── Victory / Defeat Screens ──────────────────────────────
  if (rewardDetails) {
    return (
      <>
        {rewardDetails.isVictory ? (
          <VictoryScreen details={rewardDetails} onContinue={handleContinue} onNavigate={onNavigate} />
        ) : (
          <DefeatScreen
            details={rewardDetails}
            onReturnToSelect={handleContinue}
            onRetry={isTowerMode ? handleTowerRetry : undefined}
            canRetry={isTowerMode && energy.energy > 0}
          />
        )}
        {milestoneOverlay}
        {tauntBubble}
      </>
    );
  }

  // ── Laufender Kampf ───────────────────────────────────────
  if (battle.state) {
    return (
      <>
        <BattleArena state={battle.state} battle={battle} tacticalConfig={tacticalConfig} />
        {tauntBubble}
        {lastStandOverlay}
        {bossRushWaveOverlay}
      </>
    );
  }

  // ── Turm-Start ────────────────────────────────────────────
  const noEnergy = energy.energy < 1;

  const isBoss = TowerService.isBossFloor(towerFloor);

  const buildTowerEnemy = (cursed: boolean, tripleReward: boolean): { enemy: EnemyData; tact: TacticalEnemyConfig | null } => {
    const tactEnemy = TowerService.getFloorEnemy(towerFloor);
    const cursedMult = cursed ? 1.5 : 1.0;
    const rewardMult = tripleReward ? 3.0 : cursed ? 2.5 : 1.0;
    if (tactEnemy) {
      const base = EnemyDatabase.getFirst() ?? EnemyDatabase.getAll()[0]!;
      const enemy: EnemyData = {
        ...base,
        id:    tactEnemy.id,
        name:  cursed ? `Verfluchter ${tactEnemy.name}` : tactEnemy.name,
        title: tactEnemy.title,
        stats: {
          hp:      Math.round(base.stats.hp * (1 + towerFloor * 0.15) * cursedMult),
          mpMax:   base.stats.mpMax,
          mpRegen: base.stats.mpRegen,
        },
        cards: base.cards.map(c => ({ ...c, atk: Math.round(c.atk * (1 + towerFloor * 0.1) * cursedMult) })),
        rewardXp:       Math.round(base.rewardXp      * (1 + towerFloor * 0.2) * rewardMult),
        rewardCrystals: Math.round(base.rewardCrystals * (1 + towerFloor * 0.2) * rewardMult),
      };
      return { enemy, tact: tactEnemy };
    }
    const all = EnemyDatabase.getAll();
    const r = all[Math.floor(Math.random() * all.length)]!;
    const enemy: EnemyData = cursed || tripleReward ? {
      ...r,
      name: cursed ? `Verfluchter ${r.name}` : r.name,
      stats: { ...r.stats, hp: Math.round(r.stats.hp * cursedMult) },
      cards: r.cards.map(c => ({ ...c, atk: Math.round(c.atk * cursedMult) })),
      rewardXp:       Math.round(r.rewardXp * rewardMult),
      rewardCrystals: Math.round(r.rewardCrystals * rewardMult),
    } : r;
    return { enemy, tact: null };
  };

  const startFloorBattle = (cursed = false, tripleReward = false) => {
    const { enemy, tact } = buildTowerEnemy(cursed, tripleReward);
    const meta: BattleMeta = { leaderBonus, formation, dailyCardAtkBoost };
    const type = isBoss ? 'boss' : tact ? 'elite' : 'normal';
    setPendingMeta({ enemy, meta, tact });
    setLoreOverlay({ floor: towerFloor, type });
  };

  const handleTowerStart = () => {
    if (!deckComplete) return;
    if (!energy.consume()) return;
    setIsTowerMode(true);

    // Würfle ein Zufalls-Ereignis
    const ev = TowerEventService.rollEvent();
    if (ev) {
      setTowerEvent(ev);
      return;
    }
    startFloorBattle();
  };

  const handleEventChoice = (kind: 'continue' | 'merchant_crystals' | 'merchant_potions' | 'merchant_card' | 'fight') => {
    if (!towerEvent) return;
    switch (towerEvent.kind) {
      case 'treasure': {
        const reward = TowerEventService.claimTreasure();
        setEventToast(`Truhe geöffnet: ${reward}`);
        setTimeout(() => setEventToast(''), 2800);
        setTowerEvent(null);
        startFloorBattle();
        break;
      }
      case 'merchant': {
        if (kind === 'merchant_crystals') {
          const r = TowerEventService.acceptMerchant('crystals');
          setEventToast(`Händler: ${r}`);
        } else if (kind === 'merchant_potions') {
          const r = TowerEventService.acceptMerchant('potions');
          setEventToast(`Händler: ${r}`);
        } else if (kind === 'merchant_card') {
          const r = TowerEventService.acceptMerchant('small_crystal_card');
          setEventToast(`Händler: ${r}`);
        }
        setTimeout(() => setEventToast(''), 2800);
        setTowerEvent(null);
        startFloorBattle();
        break;
      }
      case 'stranger': {
        setTowerEvent(null);
        startFloorBattle(false, true);
        break;
      }
      case 'cursed': {
        setTowerEvent(null);
        startFloorBattle(true, false);
        break;
      }
    }
    void kind;
  };

  const handleDailyTrialStart = () => {
    if (!deckComplete) return;
    if (dailyDone) return;
    if (!energy.consume()) return;
    setIsTowerMode(false);
    setTacticalConfig(null);

    const all = EnemyDatabase.getAll();
    let enemy = all[Math.floor(Math.random() * all.length)];
    if (!enemy) return;

    // Boost rewards for the daily trial
    enemy = {
      ...enemy,
      rewardXp:       Math.round(enemy.rewardXp       + dailyTrial.rewardXp),
      rewardCrystals: Math.round(enemy.rewardCrystals + dailyTrial.rewardCrystals),
    };

    const meta: BattleMeta = {
      leaderBonus,
      formation,
      dailyModifier:      dailyTrial.modifier,
      maxRounds:          dailyTrial.modifier.kind === 'time_trial' ? dailyTrial.modifier.maxRounds : undefined,
      dailyCardAtkBoost,
    };
    battle.startBattle(deckInstances, enemy, meta);
    DailyTrialService.markCompleted();
    // Season SP for daily trial (awarded on start, not win, to encourage attempts)
    SeasonService.addSp(SeasonService.SP_REWARDS.daily_trial);
    QuestService.recordEvent('earn_sp', SeasonService.SP_REWARDS.daily_trial);
  };

  const handleBossRushStart = () => {
    if (!deckComplete || !BossRushService.canAttempt()) return;
    const wave1 = BossRushService.getWave(1);
    if (!wave1) return;
    BossRushService.recordAttempt();
    setBossRushCanAttempt(false);
    bossRushWaveRef.current     = 1;
    bossRushCrystalsRef.current = 0;
    bossRushXpRef.current       = 0;
    lastStandShownRef.current   = false;
    rewardApplied.current       = false;
    setIsTowerMode(false);
    setTacticalConfig(null);
    const meta: BattleMeta = { leaderBonus, formation, dailyCardAtkBoost };
    battle.startBattle(deckInstances, wave1, meta);
  };

  const startBossRushWave = (wave: number) => {
    const enemy = BossRushService.getWave(wave);
    if (!enemy) return;
    lastStandShownRef.current = false;
    rewardApplied.current     = false;
    bossRushWaveRef.current   = wave;
    const meta: BattleMeta = { leaderBonus, formation, dailyCardAtkBoost };
    battle.startBattle(deckInstances, enemy, meta);
  };

  const RUNE_COSTS: Record<string, number> = { iron_shield: 80, blood_rage: 100, fortune: 60 };

  const confirmLore = () => {
    if (!pendingMeta) return;
    let meta = pendingMeta.meta;
    crystalRuneMultRef.current = 1.0;
    if (selectedRune) {
      const cost = RUNE_COSTS[selectedRune.type] ?? 0;
      const gSt = SaveService.loadGachaState();
      if (gSt.crystals >= cost) {
        SaveService.saveGachaState({ ...gSt, crystals: gSt.crystals - cost });
        meta = { ...meta, runeBoost: selectedRune };
        if (selectedRune.crystalMult) crystalRuneMultRef.current = selectedRune.crystalMult;
      }
      setSelectedRune(null);
    }
    setTacticalConfig(pendingMeta.tact);
    battle.startBattle(deckInstances, pendingMeta.enemy, meta);
    setLoreOverlay(null);
    setPendingMeta(null);
  };

  // ── Event-Overlay ──
  if (towerEvent) {
    return (
      <div className="lore-overlay">
        <div className="lore-overlay__box">
          <div className="event-overlay__icon">{towerEvent.icon}</div>
          <h2 className="lore-overlay__subtitle">{towerEvent.title}</h2>
          <p className="lore-overlay__text">{towerEvent.description}</p>

          {towerEvent.kind === 'merchant' && (
            <div className="event-overlay__choices">
              <button className="event-overlay__choice" onClick={() => handleEventChoice('merchant_crystals')}>+300 💎</button>
              <button className="event-overlay__choice" onClick={() => handleEventChoice('merchant_potions')}>+3 🧪 Tränke</button>
              <button className="event-overlay__choice" onClick={() => handleEventChoice('merchant_card')}>+1 💎 Karte (Klein)</button>
            </div>
          )}
          {towerEvent.kind === 'treasure' && (
            <button className="lore-overlay__btn" onClick={() => handleEventChoice('continue')}>▶ Truhe öffnen</button>
          )}
          {towerEvent.kind === 'stranger' && (
            <button className="lore-overlay__btn" onClick={() => handleEventChoice('fight')}>⚔ Herausforderung annehmen — Belohnung ×3</button>
          )}
          {towerEvent.kind === 'cursed' && (
            <button className="lore-overlay__btn" onClick={() => handleEventChoice('fight')}>⚔ Trotzdem kämpfen — Belohnung ×2,5</button>
          )}
        </div>
      </div>
    );
  }

  // ── Lore-Overlay ──
  if (loreOverlay) {
    const lore = TowerLore.forFloor(loreOverlay.floor, loreOverlay.type);
    const loreCrystals = SaveService.loadGachaState().crystals;
    const enemyElem = pendingMeta?.enemy.element ?? '';
    // Find which elements beat the enemy element
    const ELEMENT_ICON: Record<string, string> = {
      fire: '🔥', ice: '❄️', water: '💧', lightning: '⚡', wind: '🌪️',
      earth: '🌿', light: '☀️', dark: '🌑', void: '🔮', death: '💀', chaos: '🔱',
    };
    const advantageElements = Object.entries({
      fire: ['ice','earth','wind'], ice: ['wind','lightning'], water: ['fire','earth'],
      lightning: ['water','wind'], wind: ['earth','lightning'], earth: ['water','ice'],
      light: ['dark','void'], dark: ['light','void'], void: ['death','chaos'],
      death: ['void'], chaos: ['death','dark'],
    }).filter(([, victims]) => victims.includes(enemyElem)).map(([elem]) => elem);
    const RUNE_OPTIONS: { rune: RuneBoost; cost: number; label: string; desc: string }[] = [
      { rune: { type: 'iron_shield',  hpMult: 1.25 },    cost: 80,  label: '🛡 Eisenschild',  desc: 'HP +25%' },
      { rune: { type: 'blood_rage',   atkMult: 1.30 },   cost: 100, label: '🔥 Blutraserei',  desc: 'ATK +30%' },
      { rune: { type: 'fortune',      crystalMult: 1.5 }, cost: 60,  label: '🍀 Glücksauge',  desc: 'Kristalle ×1.5' },
    ];
    return (
      <div className="lore-overlay">
        <div className="lore-overlay__box">
          <div className="lore-overlay__floor">ETAGE {loreOverlay.floor}</div>
          <h2 className="lore-overlay__subtitle">{lore.subtitle}</h2>
          <p className="lore-overlay__text">{lore.text}</p>

          {/* Elemental strategy hint */}
          {enemyElem && (
            <div className="lore-elem-hint">
              <span className="lore-elem-hint__enemy">
                {ELEMENT_ICON[enemyElem] ?? '👹'} Gegner-Element: <strong>{enemyElem.toUpperCase()}</strong>
              </span>
              {advantageElements.length > 0 && (
                <span className="lore-elem-hint__adv">
                  ▲ Vorteilhaft: {advantageElements.map(e => `${ELEMENT_ICON[e] ?? ''}${e}`).join(', ')}
                </span>
              )}
            </div>
          )}

          <div className="rune-section">
            <div className="rune-section__title">Kampfrune wählen (optional)</div>
            <div className="rune-grid">
              {RUNE_OPTIONS.map(opt => {
                const canAfford = loreCrystals >= opt.cost;
                const isChosen  = selectedRune?.type === opt.rune.type;
                return (
                  <button
                    key={opt.rune.type}
                    className={`rune-btn ${isChosen ? 'rune-btn--active' : ''} ${!canAfford ? 'rune-btn--disabled' : ''}`}
                    disabled={!canAfford}
                    onClick={() => setSelectedRune(isChosen ? null : opt.rune)}
                  >
                    <span className="rune-btn__label">{opt.label}</span>
                    <span className="rune-btn__desc">{opt.desc}</span>
                    <span className="rune-btn__cost">💎 {opt.cost}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button className="lore-overlay__btn" onClick={confirmLore}>
            {selectedRune ? `▶ Mit Rune eintreten (−${RUNE_COSTS[selectedRune.type]} 💎)` : '▶ Etage betreten'}
          </button>
        </div>
      </div>
    );
  }

  const streakReward = WinStreakService.getRewardMultiplier(winStreak);
  const nextMilestone = TowerMilestoneService.getNextMilestone(towerFloor);

  // Enemy threat preview for the lobby (computed once per floor, not randomised)
  const enemyThreat = useMemo(() => {
    const base = EnemyDatabase.getFirst();
    if (!base) return null;
    const tactEnemy = TowerService.getFloorEnemy(towerFloor);
    const scaleMult = 1 + towerFloor * 0.15;
    const atkMult   = 1 + towerFloor * 0.1;
    return {
      name:  tactEnemy?.name ?? (isBoss ? 'Boss' : 'Turmwächter'),
      title: tactEnemy?.title ?? `Etage ${towerFloor}`,
      hp:    Math.round(base.stats.hp * scaleMult),
      atk:   Math.round((base.cards[0]?.atk ?? 500) * atkMult),
      isExact: !!tactEnemy,
    };
  }, [towerFloor, isBoss]);

  return (
    <div className="battle-screen--select">
      {eventToast && <div className="event-toast">{eventToast}</div>}

      <div className="battle-select-header">
        <h1 className="battle-select-title">🗼 TURM DER PRÜFUNG</h1>
        {winStreak >= 1 && (
          <div className={`battle-streak-chip ${winStreak >= 3 ? 'battle-streak-chip--hot' : ''}`}>
            🔥 {winStreak}{streakReward.multiplier > 1.0 && <> · ×{streakReward.multiplier.toFixed(1)}</>}
          </div>
        )}
      </div>

      {/* Revenge chip — appears when the player returns to their last defeat floor */}
      {revengeFloor === towerFloor && (
        <div className="battle-revenge-chip">
          <span className="battle-revenge-chip__icon">⚔</span>
          <span className="battle-revenge-chip__text">REVANCHE — Etage {towerFloor}</span>
          <span className="battle-revenge-chip__sub">Beweise dich!</span>
        </div>
      )}

      {/* Etagen-Info */}
      <div className="battle-tower-floor-banner">
        <div className="battle-tower-floor-banner__floor">
          <span className="battle-tower-floor-banner__num">{towerFloor}</span>
          <span className="battle-tower-floor-banner__label">ETAGE</span>
        </div>
        <div className="battle-tower-floor-banner__info">
          <div className="battle-tower-floor-banner__type">
            {isBoss ? '⚔ BOSS-ETAGE' : towerFloor % 5 === 0 ? '⚡ ELITE-ETAGE' : '◆ NORMAL-ETAGE'}
          </div>
          <div className="battle-tower-floor-banner__highest">Höchste erreicht: {highestFloor}</div>
          {(() => {
            const base = EnemyDatabase.getFirst();
            const baseCrystals = base?.rewardCrystals ?? 100;
            const est = Math.round(baseCrystals * (1 + towerFloor * 0.2));
            return (
              <div className="battle-tower-floor-banner__reward-hint">
                💎 ~{est.toLocaleString('de-DE')} Kristalle
              </div>
            );
          })()}
          <div className="battle-tower-floor-banner__hint">
            {isBoss
              ? 'Ein mächtiger Wächter versperrt den Weg. Taktik ist alles.'
              : 'Steige höher. Werde stärker. Bezwinge den Turm.'}
          </div>
        </div>
      </div>

      {/* Enemy threat preview */}
      {enemyThreat && (
        <div className={`battle-threat-panel ${isBoss ? 'battle-threat-panel--boss' : ''}`}>
          <div className="battle-threat-panel__name">
            {isBoss ? '💀' : towerFloor % 5 === 0 ? '⚡' : '⚔'} {enemyThreat.name}
            {enemyThreat.title && (
              <span className="battle-threat-panel__title"> · {enemyThreat.title}</span>
            )}
          </div>
          <div className="battle-threat-panel__stats">
            <span className="battle-threat-panel__stat">
              <span className="battle-threat-panel__stat-label">HP</span>
              <span className="battle-threat-panel__stat-val">
                ~{enemyThreat.hp.toLocaleString('de-DE')}
              </span>
            </span>
            <span className="battle-threat-panel__divider">·</span>
            <span className="battle-threat-panel__stat">
              <span className="battle-threat-panel__stat-label">ATK</span>
              <span className="battle-threat-panel__stat-val">
                ~{enemyThreat.atk.toLocaleString('de-DE')}
              </span>
            </span>
            {!enemyThreat.isExact && (
              <span className="battle-threat-panel__approx">Schätzwerte</span>
            )}
          </div>
        </div>
      )}

      {/* Win Probability Indicator */}
      {deckPower > 0 && enemyPowerEstimate > 0 && (() => {
        const ratio = deckPower / enemyPowerEstimate;
        const pct   = Math.min(100, Math.max(5, Math.round(ratio * 60)));
        const label =
          ratio >= 1.6 ? 'DOMINANZ' :
          ratio >= 1.1 ? 'VORTEIL'  :
          ratio >= 0.8 ? 'AUSGEGLICHEN' :
          ratio >= 0.5 ? 'NACHTEIL' : 'GEFAHR';
        const cls =
          ratio >= 1.1 ? 'battle-win-prob--strong' :
          ratio >= 0.8 ? 'battle-win-prob--even'   : 'battle-win-prob--weak';
        return (
          <div className={`battle-win-prob ${cls}`}>
            <div className="battle-win-prob__header">
              <span className="battle-win-prob__label">KAMPFSTÄRKE</span>
              <span className="battle-win-prob__verdict">{label}</span>
            </div>
            <div className="battle-win-prob__track">
              <div className="battle-win-prob__fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="battle-win-prob__sub">
              Deck {deckPower.toLocaleString('de-DE')} · Gegner ~{enemyPowerEstimate.toLocaleString('de-DE')}
            </div>
          </div>
        );
      })()}

      {/* Account Level-Up teaser (shown when ≥75% XP progress) */}
      {accountXpProgress >= 0.75 && accountXpProgress < 1 && (
        <div className="battle-levelup-tease">
          <span className="battle-levelup-tease__icon">✦</span>
          <div className="battle-levelup-tease__text">
            <span className="battle-levelup-tease__title">
              {accountXpProgress >= 0.9 ? 'FAST DA — Level-Up beim nächsten Sieg!' : 'Level-Up ist nah!'}
            </span>
            <div className="battle-levelup-tease__bar-track">
              <div className="battle-levelup-tease__bar-fill" style={{ width: `${Math.round(accountXpProgress * 100)}%` }} />
            </div>
          </div>
          <span className="battle-levelup-tease__pct">{Math.round(accountXpProgress * 100)}%</span>
        </div>
      )}

      {/* Nächster Meilenstein */}
      {nextMilestone && (
        <div className="battle-milestone-preview">
          <span className="battle-milestone-preview__icon">🏆</span>
          <span className="battle-milestone-preview__text">
            Nächster Meilenstein: <strong>Etage {nextMilestone.floor}</strong>
            {nextMilestone.floor > towerFloor && <> (noch {nextMilestone.floor - towerFloor})</>}
          </span>
          <span className="battle-milestone-preview__reward">+{nextMilestone.crystals.toLocaleString('de-DE')} 💎</span>
        </div>
      )}

      {/* Leader-Karte + Formation */}
      {leaderBonus && (
        <div className="battle-meta-box">
          <div className="battle-meta-box__title">⚜ Anführer & Formation</div>
          <div className="battle-meta-box__row">
            <span className="battle-meta-box__icon">👑</span>
            <span className="battle-meta-box__main">{leaderBonus.leaderName}</span>
            <span className="battle-meta-box__bonus">
              +{Math.round(leaderBonus.elementDamageBoost * 100)}% {leaderBonus.element}
            </span>
          </div>
          {formation.bonuses.length === 0 && (
            <div className="battle-meta-box__hint">Mind. 3 Karten mit gleichem Tag für eine Formation</div>
          )}
          {formation.bonuses.map(f => (
            <div key={f.tag} className="battle-meta-box__row">
              <span className="battle-meta-box__icon">✦</span>
              <span className="battle-meta-box__main">{f.label} ({f.count}×)</span>
              <span className="battle-meta-box__bonus">+{Math.round(f.damageBoost * 100)}% Schaden</span>
            </div>
          ))}
        </div>
      )}

      {/* Tages-Prüfung */}
      <div className={`battle-daily-trial ${dailyDone ? 'battle-daily-trial--done' : ''}`}>
        <div className="battle-daily-trial__header">
          <span className="battle-daily-trial__icon">☀️</span>
          <span className="battle-daily-trial__title">TAGESPRÜFUNG · {dailyTrial.title}</span>
          {dailyDone && <span className="battle-daily-trial__done-tag">✓</span>}
        </div>
        <div className="battle-daily-trial__desc">{dailyTrial.description}</div>
        <div className="battle-daily-trial__rewards">
          💎 +{dailyTrial.rewardCrystals} · ✦ +{dailyTrial.rewardXp} XP
        </div>
        <button
          className={`battle-daily-trial__btn ${dailyDone || !deckComplete || noEnergy ? 'battle-start-btn--disabled' : ''}`}
          disabled={dailyDone || !deckComplete || noEnergy}
          onClick={handleDailyTrialStart}
        >
          {dailyDone ? 'Heute bereits absolviert' : '⚔ Prüfung starten'}
        </button>
      </div>

      {/* ── Boss Rush ── */}
      <div className={`battle-boss-rush ${!bossRushCanAttempt ? 'battle-boss-rush--done' : ''}`}>
        <div className="battle-boss-rush__header">
          <span className="battle-boss-rush__icon">💀</span>
          <span className="battle-boss-rush__title">BOSS RUSH</span>
          {!bossRushCanAttempt && <span className="battle-boss-rush__done-tag">✓</span>}
        </div>
        <div className="battle-boss-rush__waves">
          {Array.from({ length: BossRushService.BOSS_RUSH_WAVES }).map((_, i) => (
            <span key={i} className="battle-boss-rush__wave-dot">
              {i < (bossRushWaveRef.current > 0 ? bossRushWaveRef.current - 1 : 0) ? '★' : '☆'}
            </span>
          ))}
        </div>
        <div className="battle-boss-rush__desc">
          5 Gegner-Wellen ohne Energie-Kosten — alle 5 besiegen für +{BossRushService.BOSS_RUSH_COMPLETION_BONUS.toLocaleString('de-DE')} 💎
        </div>
        <button
          className={`battle-boss-rush__btn ${!deckComplete || !bossRushCanAttempt ? 'battle-start-btn--disabled' : ''}`}
          disabled={!deckComplete || !bossRushCanAttempt}
          onClick={handleBossRushStart}
        >
          {!bossRushCanAttempt ? 'Heute bereits versucht' : '💀 Boss Rush starten'}
        </button>
      </div>

      {/* ── Daily Quest Compact ── */}
      {(() => {
        const dailyQ = QuestService.getDailyQuests().filter(q => !q.progress.claimed).slice(0, 3);
        if (dailyQ.length === 0) return null;
        return (
          <div className="battle-daily-quests">
            <div className="battle-daily-quests__title">📜 Tagesquests</div>
            {dailyQ.map(q => {
              const pct = q.def.target > 0
                ? Math.min(100, (q.progress.current / q.def.target) * 100)
                : 0;
              return (
                <div key={q.def.id} className="battle-dq">
                  <div className="battle-dq__header">
                    <span className="battle-dq__title">{q.def.title}</span>
                    <span className="battle-dq__crystals">💎{q.def.crystalReward}</span>
                  </div>
                  <div className="battle-dq__bar">
                    <div className="battle-dq__fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="battle-dq__count">
                    {q.progress.current}/{q.def.target}
                    {q.progress.completed && <span className="battle-dq__done"> ✓</span>}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Weekend Bonus chip */}
      {WeekendBonusService.isActive() && (
        <div className="battle-weekend-chip">
          <span className="battle-weekend-chip__icon">🎉</span>
          <span className="battle-weekend-chip__text">
            WOCHENEND-BONUS aktiv: <strong>+25% Kristalle</strong>
          </span>
        </div>
      )}

      {/* Recovery Bonus chip */}
      {RecoveryService.isActive() && (
        <div className="battle-recovery-chip">
          <span className="battle-recovery-chip__icon">⚡</span>
          <span className="battle-recovery-chip__text">
            Comeback-Bonus aktiv: <strong>nächster Sieg +50% 💎</strong>
          </span>
        </div>
      )}

      {/* First-Win-of-Day chip */}
      {FirstWinService.isAvailable() && (
        <div className="battle-firstwin-chip">
          <span className="battle-firstwin-chip__icon">🌅</span>
          <span className="battle-firstwin-chip__text">
            Erster Sieg heute: <strong>+{FirstWinService.FIRST_WIN_BONUS.toLocaleString('de-DE')} 💎</strong>
          </span>
        </div>
      )}

      {/* Pre-Boss Approach Warning: next floor is a boss */}
      {isTowerMode && !isBoss && TowerService.isBossFloor(towerFloor + 1) && (
        <div className="battle-boss-approach-chip">
          <span className="battle-boss-approach-chip__icon">💀</span>
          <span className="battle-boss-approach-chip__text">
            ACHTUNG — <strong>Etage {towerFloor + 1} ist eine BOSS-ETAGE!</strong>
          </span>
        </div>
      )}

      {/* Energie / Ausdauertränke */}
      <div className="battle-energy">
        <div className="battle-energy__pips" aria-label={`Energie ${energy.energy} von ${energy.max}`}>
          {Array.from({ length: energy.max }).map((_, i) => (
            <span key={i} className={`battle-energy__pip ${i < energy.energy ? 'battle-energy__pip--full' : ''}`}>
              ⚡
            </span>
          ))}
        </div>
        <div className="battle-energy__meta">
          <span className="battle-energy__count">
            {energy.energy}/{energy.max} Kämpfe
            {energy.energy < energy.max && energyRegenMs > 0 && (
              <span className="battle-energy__regen"> +1 in {fmtRegen(energyRegenMs)}</span>
            )}
          </span>
          <button
            className="battle-energy__potion"
            onClick={energy.usePotion}
            disabled={energy.potions < 1 || energy.energy >= energy.max}
            title="Ausdauertrank nutzen (+1 Energie)"
          >
            🧪 ×{energy.potions}
          </button>
        </div>
      </div>

      <div className={`battle-deck-status ${deckComplete ? 'battle-deck-status--ok' : 'battle-deck-status--warn'}`}>
        {deckComplete
          ? `✓ Deck bereit (${deckInstances.length}/${DECK_SIZE} Karten)`
          : `⚠ Deck unvollständig (${deckInstances.length}/${DECK_SIZE}) — Deckbuilder öffnen`}
      </div>

      {/* ── Power Comparison Widget ── */}
      {deckComplete && (() => {
        const ratio = enemyPowerEstimate > 0 ? deckPower / enemyPowerEstimate : 0;
        const playerPct = Math.min(100, Math.round(ratio * 50));
        const enemyPct  = Math.min(100, Math.round((1 / Math.max(ratio, 0.01)) * 50));
        const advantage = ratio >= 1.15 ? 'strong' : ratio >= 0.85 ? 'even' : 'weak';
        const labels: Record<string, string> = { strong: '▲ ÜBERLEGEN', even: '≈ AUSGEGLICHEN', weak: '▼ UNTERLEGEN' };
        return (
          <div className={`battle-power-cmp battle-power-cmp--${advantage}`}>
            <div className="battle-power-cmp__title">⚔ Kraftvergleich</div>
            <div className="battle-power-cmp__row">
              <div className="battle-power-cmp__side">
                <span className="battle-power-cmp__label">Dein Deck</span>
                <span className="battle-power-cmp__val">{deckPower.toLocaleString('de-DE')}</span>
              </div>
              <div className={`battle-power-cmp__verdict battle-power-cmp__verdict--${advantage}`}>{labels[advantage]}</div>
              <div className="battle-power-cmp__side battle-power-cmp__side--enemy">
                <span className="battle-power-cmp__label">Gegner ca.</span>
                <span className="battle-power-cmp__val">{enemyPowerEstimate.toLocaleString('de-DE')}</span>
              </div>
            </div>
            <div className="battle-power-cmp__bars">
              <div className="battle-power-cmp__bar-wrap">
                <div className="battle-power-cmp__bar-fill battle-power-cmp__bar-fill--player" style={{ width: `${playerPct}%` }} />
              </div>
              <div className="battle-power-cmp__bar-mid" />
              <div className="battle-power-cmp__bar-wrap battle-power-cmp__bar-wrap--enemy">
                <div className="battle-power-cmp__bar-fill battle-power-cmp__bar-fill--enemy" style={{ width: `${enemyPct}%` }} />
              </div>
            </div>
          </div>
        );
      })()}

      <div className="battle-tower-spacer" />

      <button
        className={`battle-tower-btn ${!deckComplete || noEnergy ? 'battle-start-btn--disabled' : ''}`}
        disabled={!deckComplete || noEnergy}
        onClick={handleTowerStart}
      >
        {!deckComplete ? '⚠ Deck unvollständig'
          : noEnergy ? '⚡ Keine Energie'
          : isBoss
            ? `⚔ Boss-Kampf — Etage ${towerFloor} betreten`
            : `▶ Etage ${towerFloor} betreten`}
      </button>
    </div>
  );
};

// ── Element-Daten ─────────────────────────────────────────────

const ELEMENT_META: Record<string, { color: string; glow: string; icon: string }> = {
  fire:      { color: '#ff5500', glow: 'rgba(255,85,0,0.45)',    icon: '🔥' },
  ice:       { color: '#00aaff', glow: 'rgba(0,170,255,0.35)',   icon: '❄️' },
  dark:      { color: '#9900ff', glow: 'rgba(153,0,255,0.4)',    icon: '🌑' },
  light:     { color: '#ffee00', glow: 'rgba(255,238,0,0.35)',   icon: '☀️' },
  earth:     { color: '#44aa22', glow: 'rgba(68,170,34,0.35)',   icon: '🌿' },
  water:     { color: '#0066ff', glow: 'rgba(0,102,255,0.35)',   icon: '💧' },
  lightning: { color: '#ffff00', glow: 'rgba(255,255,0,0.4)',    icon: '⚡' },
  wind:      { color: '#00ddaa', glow: 'rgba(0,221,170,0.35)',   icon: '🌪️' },
  void:      { color: '#cc00ff', glow: 'rgba(204,0,255,0.4)',    icon: '🔮' },
  death:     { color: '#888888', glow: 'rgba(136,136,136,0.3)',  icon: '💀' },
  chaos:     { color: '#ff0044', glow: 'rgba(255,0,68,0.45)',    icon: '🔱' },
};

// ── Gegner-Portrait ───────────────────────────────────────────

const EnemyPortrait: React.FC<{
  enemyData:   EnemyData;
  isHit:       boolean;
  isDead:      boolean;
  isAttacking: boolean;
}> = ({ enemyData, isHit, isDead, isAttacking }) => {
  const meta = ELEMENT_META[enemyData.element] ?? { color: '#888888', glow: 'rgba(136,136,136,0.3)', icon: '👹' };
  return (
    <div
      className={`enemy-portrait
        ${isHit                                    ? 'enemy-portrait--hit'       : ''}
        ${isDead                                   ? 'enemy-portrait--dead'      : ''}
        ${isAttacking && !isHit && !isDead ? 'enemy-portrait--attacking' : ''}
      `}
      style={{ '--elem-color': meta.color, '--elem-glow': meta.glow } as React.CSSProperties}
    >
      <div className="enemy-portrait__ring" />
      <div className="enemy-portrait__body">
        <span className="enemy-portrait__icon">{isDead ? '💀' : meta.icon}</span>
      </div>
    </div>
  );
};

// ── Schwimmende Schadenszahlen ─────────────────────────────────

const FloatDmgNumber: React.FC<{ popup: DamagePopup }> = ({ popup }) => {
  const tier     = popup.isCrit ? 'crit' : popup.damage >= 50_000 ? 'super' : popup.damage >= 10_000 ? 'high' : 'normal';
  const elemClass = popup.element ? `dmg-number--${popup.element}` : '';
  return (
    <div
      className={`dmg-number dmg-number--${tier} ${elemClass}`}
      style={{ left: `${popup.xPct}%`, bottom: `${20 + (popup.yOffset ?? 0)}px` }}
      aria-hidden="true"
    >
      {popup.damage.toLocaleString('de-DE')}
    </div>
  );
};

// ── Battle-Arena ──────────────────────────────────────────────

interface BattleArenaProps {
  state:         BattleState;
  battle:        ReturnType<typeof useBattleStore>;
  tacticalConfig?: TacticalEnemyConfig | null;
}

const BattleArena: React.FC<BattleArenaProps> = ({ state, battle, tacticalConfig }) => {
  const combo    = useComboStore();
  const tactical = useTacticalStore(tacticalConfig ?? null);
  const [popups,      setPopups]      = useState<DamagePopup[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [synergyToast, setSynergyToast] = useState<{ a: string; b: string; count: number } | null>(null);
  const [awakeningToast, setAwakeningToast] = useState<string | null>(null);
  const [superToast,     setSuperToast]     = useState<{ name: string; quote: string; damage: number } | null>(null);
  const [critFlash,      setCritFlash]      = useState(false);
  const [enemyHit,       setEnemyHit]       = useState(false);
  const [limitBreakUsed,   setLimitBreakUsed]   = useState(false);
  const [limitBreakAnim,   setLimitBreakAnim]   = useState(false);
  const [comboBurst,     setComboBurst]     = useState<'triple' | 'max' | null>(null);
  const lastComboBurstRef = useRef(0);
  const lastAwakenedCount = useRef(0);
  const lastLogId         = useRef(0);
  const lastEnemyHpRef    = useRef(state.enemy.hp);
  const lastPlayerHpRef   = useRef(state.player.hp);
  const wasBreakingRef    = useRef(false);
  const resultSoundRef    = useRef(false);
  const resolvingRef      = useRef(false);
  const arenaRef          = useRef<HTMLDivElement>(null);
  const popupId = React.useRef(0);

  // Screen-Shake via Web Animations API (retriggert zuverlässig).
  const triggerShake = useCallback((level: 1 | 2) => {
    const el = arenaRef.current;
    if (!el) return;
    const amp = level === 2 ? 8 : 3.5;
    el.animate(
      [
        { transform: 'translate(0,0)' },
        { transform: `translate(${amp}px, ${-amp * 0.7}px)` },
        { transform: `translate(${-amp * 0.8}px, ${amp * 0.6}px)` },
        { transform: `translate(${amp * 0.5}px, ${amp * 0.3}px)` },
        { transform: 'translate(0,0)' },
      ],
      { duration: level === 2 ? 340 : 170, easing: 'ease-out' },
    );
  }, []);

  // Gegner-Treffer-Reaktion (Portrait-Shake)
  useEffect(() => {
    if (state.enemy.hp < lastEnemyHpRef.current) {
      setEnemyHit(true);
      setTimeout(() => setEnemyHit(false), 460);
    }
    lastEnemyHpRef.current = state.enemy.hp;
  }, [state.enemy.hp]);

  // Spieler nimmt Schaden → Einschlag-Sound, Haptik, harter Shake
  useEffect(() => {
    if (state.player.hp < lastPlayerHpRef.current) {
      AudioService.enemyHit();
      AudioService.vibrate(40);
      triggerShake(2);
    }
    lastPlayerHpRef.current = state.player.hp;
  }, [state.player.hp, triggerShake]);

  // Combo gebrochen → dumpfer Sound + reset burst threshold
  useEffect(() => {
    if (combo.isBreaking && !wasBreakingRef.current) {
      AudioService.comboBreak();
      lastComboBurstRef.current = 0;
    }
    wasBreakingRef.current = combo.isBreaking;
  }, [combo.isBreaking]);

  // Combo milestone burst at 3× and MAX_COMBO
  useEffect(() => {
    const c = combo.count;
    if (c <= lastComboBurstRef.current) return;
    if (c >= 5 && lastComboBurstRef.current < 5) {
      lastComboBurstRef.current = c;
      setComboBurst('max');
      AudioService.vibrate([20, 40, 60, 80]);
      setTimeout(() => setComboBurst(null), 1200);
    } else if (c === 3 && lastComboBurstRef.current < 3) {
      lastComboBurstRef.current = c;
      setComboBurst('triple');
      AudioService.vibrate([20, 30]);
      setTimeout(() => setComboBurst(null), 800);
    } else {
      lastComboBurstRef.current = c;
    }
  }, [combo.count]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sieg / Niederlage → Fanfare
  useEffect(() => {
    if (state.result && !resultSoundRef.current) {
      resultSoundRef.current = true;
      if (state.result.outcome === 'victory') { AudioService.victory(); AudioService.vibrate([20, 40, 20, 40, 60]); }
      else AudioService.defeat();
    }
  }, [state.result]);

  // Super-Attack-Toast + Critical-Flash basierend auf neuestem Log-Eintrag
  useEffect(() => {
    const lastLog = state.log[state.log.length - 1];
    if (!lastLog || lastLog.id === lastLogId.current) return;
    lastLogId.current = lastLog.id;
    if (lastLog.isSuper && lastLog.quote) {
      setSuperToast({ name: lastLog.cardName, quote: lastLog.quote, damage: lastLog.damage });
      AudioService.super();
      AudioService.vibrate([30, 40, 60]);
      triggerShake(2);
      setTimeout(() => setSuperToast(null), 2800);
    }
    if (lastLog.actor === 'player' && lastLog.damage >= 10_000) {
      setCritFlash(true);
      setTimeout(() => setCritFlash(false), 600);
    }
  }, [state.log]);

  // Awakening-Toast wenn neue Karte erwacht
  useEffect(() => {
    const current = state.awakenedIds?.length ?? 0;
    if (current > lastAwakenedCount.current) {
      const newestId = state.awakenedIds?.[current - 1];
      const card = newestId ? state.player.hand.concat(state.player.deck).find(c => c.sourceId === newestId)?.card : null;
      if (card) {
        setAwakeningToast(`${card.name} ERWACHT!`);
        AudioService.awaken();
        AudioService.vibrate([20, 30, 40]);
        setTimeout(() => setAwakeningToast(null), 2400);
      }
    }
    lastAwakenedCount.current = current;
  }, [state.awakenedIds?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const { player, enemy, round, phase, log, result, enemyData } = state;
  const canPlay   = phase === 'player_turn' && !result;
  const allPlayed = player.hand.every(c => c.played);

  // Auswahl zurücksetzen wenn Phase wechselt
  useEffect(() => {
    setSelectedIds([]);
    if (phase !== 'player_turn') combo.reset();
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Popup hinzufügen + auto-entfernen
  const addPopup = useCallback((popup: Omit<DamagePopup, 'id'>) => {
    const id = ++popupId.current;
    setPopups(prev => [...prev, { ...popup, id }]);
    setTimeout(() => setPopups(prev => prev.filter(p => p.id !== id)), 1400);
  }, []);

  // Karte in Auswahl ein-/ausschalten
  const handleToggleCard = useCallback((card: BattleCard) => {
    if (!canPlay || card.played || card.destroyed || card.mpCost > player.mp) return;
    AudioService.tap();
    setSelectedIds(prev =>
      prev.includes(card.instanceId)
        ? prev.filter(id => id !== card.instanceId)
        : [...prev, card.instanceId]
    );
  }, [canPlay, player.mp]);

  // Ausgewählte Karten NACHEINANDER ausspielen — jede schlägt mit
  // eigenem Sound, Schadenszahl, Shake und Haptik ein (Combo-Flurry).
  const STAGGER_MS = 230;
  const handlePlaySelected = useCallback(() => {
    if (!canPlay || selectedIds.length === 0 || resolvingRef.current) return;

    // Karten zum Zeitpunkt des Klicks auflösen (Render-Hand)
    const queue = selectedIds
      .map(id => player.hand.find(c => c.instanceId === id))
      .filter((c): c is BattleCard => !!c && !c.played && !c.destroyed);
    if (queue.length === 0) { setSelectedIds([]); return; }

    resolvingRef.current = true;
    setSelectedIds([]);
    AudioService.unlock();

    let localComboCount = combo.isActive ? combo.count : 0;
    let lastCard: BattleCard | null = null;
    const synergyPairs: Array<{ a: string; b: string }> = [];

    const playOne = (idx: number) => {
      if (idx >= queue.length) {
        // Synergie-Toast nach Abschluss des Flurry
        if (synergyPairs.length > 0) {
          const count = synergyPairs.length;
          setSynergyToast({ a: synergyPairs[0].a, b: synergyPairs[count - 1].b, count });
          setTimeout(() => setSynergyToast(null), 2400);
          QuestService.recordEvent('use_synergy', count);
        }
        resolvingRef.current = false;
        return;
      }

      const card = queue[idx];
      localComboCount = Math.min(5, localComboCount + 1);
      const calc = ComboSystem.calculate(
        card.atk, localComboCount, lastCard, card, enemyData.element,
      );

      combo.onCardPlayed(card, calc.windowExtension);
      if (localComboCount >= 2) QuestService.recordEvent('play_combos');
      if (localComboCount >= 5) {
        AchievementService.recordProgress('combo_5');
        AchievementService.recordProgress('combo_master');
      }

      const damageMultiplier = (tacticalConfig && tactical.tactical)
        ? tactical.playTacticalCard(card, localComboCount)
        : calc.totalMultiplier;

      battle.playCard(card.instanceId, damageMultiplier, localComboCount);

      const dmg    = Math.max(1, Math.round(card.atk * damageMultiplier));
      const isCrit = localComboCount >= 4 || (state.awakenedIds?.includes(card.sourceId) ?? false);

      addPopup({
        damage:     dmg,
        combo:      localComboCount,
        multiplier: damageMultiplier,
        hasSynergy: calc.hasSynergy,
        hasElement: calc.hasElementAdv,
        xPct:       38 + Math.random() * 24,
        element:    card.card?.element,
        isCrit,
        yOffset:    idx * 6,
      });

      // ── Audio + Juice ──
      AudioService.cardPlay();
      AudioService.combo(localComboCount);
      if (isCrit) {
        AudioService.crit();
        AudioService.vibrate(28);
        triggerShake(2);
      } else {
        AudioService.hit(Math.min(1, dmg / 25_000));
        AudioService.vibrate(12);
        triggerShake(1);
      }
      if (calc.hasSynergy) AudioService.synergy();

      if (calc.hasSynergy && lastCard) synergyPairs.push({ a: lastCard.name, b: card.name });
      lastCard = card;

      setTimeout(() => playOne(idx + 1), STAGGER_MS);
    };

    playOne(0);
  }, [canPlay, selectedIds, player.hand, combo, enemyData.element, battle, tacticalConfig, tactical, addPopup, triggerShake, state.awakenedIds]);

  // Verteidigen: MP ausgeben, nächsten Gegnerschaden halbieren, Zug beenden
  const handleGuard = useCallback(() => {
    if (!canPlay || player.mp < GUARD_MP_COST || resolvingRef.current) return;
    AudioService.guard();
    AudioService.vibrate(20);
    battle.guard();
  }, [canPlay, player.mp, battle]);

  // LIMIT BREAK: vernichtender Angriff wenn Gegner-HP < 20%
  const enemyHpPct    = state.enemy.hpMax > 0 ? state.enemy.hp / state.enemy.hpMax : 1;
  const canLimitBreak = canPlay && !limitBreakUsed && enemyHpPct < 0.20 && player.mp >= 10 && !resolvingRef.current;

  const handleLimitBreak = useCallback(() => {
    if (!canLimitBreak) return;
    setLimitBreakUsed(true);
    setLimitBreakAnim(true);
    AudioService.super();
    AudioService.vibrate([30, 50, 80, 50, 30]);
    triggerShake(2);
    setTimeout(() => setLimitBreakAnim(false), 1800);

    // Schaden = (Summe aller Hand-ATK) × 4 × (MP-Verhältnis)
    const totalAtk = player.hand.reduce((s, c) => s + c.atk, 0);
    const mpRatio  = player.mp / player.mpMax;
    const damage   = Math.round(totalAtk * 4 * (0.5 + mpRatio));

    // Alle MP verbrauchen und Schaden setzen
    for (const card of player.hand.filter(c => !c.played)) {
      battle.playCard(card.instanceId, 0, 0); // MP-frei ausspielen (nullschaden aus playCard)
    }
    // Direkten Schaden über mehrere playCard-Calls simulieren wäre komplex.
    // Stattdessen: fake popup + manuell via state
    addPopup({
      damage,
      combo:      5,
      multiplier: 4,
      hasSynergy: true,
      hasElement: true,
      xPct:       50,
      isCrit:     true,
      yOffset:    0,
    });

    // Schaden auf Gegner anwenden über mehrfache playCard (wenig elegant aber sicher)
    // Der Trick: wir spielen alle Karten mit massivem Multiplikator
    const hand = [...player.hand];
    const perCard = hand.length > 0 ? damage / hand.length : damage;
    for (const card of hand) {
      if (!card.played) {
        const mult = perCard / Math.max(1, card.atk);
        battle.playCard(card.instanceId, mult, 5);
      }
    }
  }, [canLimitBreak, player.hand, player.mp, player.mpMax, battle, addPopup, triggerShake]);

  // Gegner-Absicht: vorhergesagter Schaden des nächsten Gegnerzugs
  const incomingDamage = canPlay ? BattleManager.forecastEnemyDamage(state) : 0;

  return (
    <div className="battle-arena" ref={arenaRef}>
      <div className="arena-bg-pulse" aria-hidden="true" />

      {/* Schwimmende Schadenszahlen — fixed über der Gegner-Zone */}
      <div className="damage-numbers-layer">
        {popups.map(p => <FloatDmgNumber key={p.id} popup={p} />)}
      </div>

      {/* Topbar */}
      <div className="arena-topbar">
        <span className="arena-round">Runde {round} / {MAX_ROUNDS}</span>
        <span className={`arena-phase arena-phase--${phase}`}>
          {phase === 'player_turn' && 'Dein Zug'}
          {phase === 'enemy_turn'  && '⚔ Gegnerzug …'}
          {phase === 'round_end'   && '⏱ Rundenende …'}
          {phase === 'ended'       && (result?.outcome === 'victory' ? '🏆 SIEG' : '💀 NIEDERLAGE')}
        </span>
        <button className="arena-flee-btn" onClick={battle.resetBattle}>✕</button>
      </div>

      {/* Synergie-Toast */}
      {synergyToast && (
        <div className="arena-synergy-toast">
          <span className="arena-synergy-toast__icon">{synergyToast.count > 1 ? '✨' : '⭐'}</span>
          <span className="arena-synergy-toast__text">
            {synergyToast.count > 1 ? `×${synergyToast.count} SYNERGIE` : 'SYNERGIE'}
          </span>
          <span className="arena-synergy-toast__cards">{synergyToast.a} + {synergyToast.b}</span>
        </div>
      )}

      {/* Awakening-Toast */}
      {awakeningToast && (
        <div className="arena-awakening-toast">
          <span className="arena-awakening-toast__icon">🔥</span>
          <span className="arena-awakening-toast__text">{awakeningToast}</span>
        </div>
      )}

      {/* Super-Attack-Overlay */}
      {superToast && (
        <div className="arena-super-overlay">
          <div className="arena-super-overlay__inner">
            <div className="arena-super-overlay__label">▼ SUPER-ANGRIFF ▼</div>
            <div className="arena-super-overlay__name">{superToast.name}</div>
            <div className="arena-super-overlay__quote">„{superToast.quote}"</div>
            <div className="arena-super-overlay__damage">{superToast.damage.toLocaleString('de-DE')} SCHADEN</div>
          </div>
        </div>
      )}

      {/* Critical Flash */}
      {critFlash && <div className="arena-crit-flash" />}

      {/* Combo Burst Overlay */}
      {comboBurst === 'triple' && (
        <div className="combo-burst combo-burst--triple" aria-hidden="true">
          <div className="combo-burst__ring" />
          <div className="combo-burst__text">3× COMBO!</div>
        </div>
      )}
      {comboBurst === 'max' && (
        <div className="combo-burst combo-burst--max" aria-hidden="true">
          <div className="combo-burst__ring" />
          <div className="combo-burst__ring combo-burst__ring--delay" />
          <div className="combo-burst__text">MAX COMBO!!</div>
        </div>
      )}

      {/* Limit Break Animation */}
      {limitBreakAnim && (
        <div className="arena-limit-overlay">
          <div className="arena-limit-overlay__text">⚡ LIMIT BREAK ⚡</div>
          <div className="arena-limit-overlay__sub">VERNICHTENDE KRAFT ENTFESSELT!</div>
        </div>
      )}

      {/* Gegner oben */}
      <div className="arena-enemy-zone">
        <EnemyPortrait
          enemyData={enemyData}
          isHit={enemyHit}
          isDead={enemy.hp <= 0}
          isAttacking={phase === 'enemy_turn'}
        />
        <div className="arena-enemy-info">
          <div className="arena-enemy-name">{enemyData.name}</div>
          <HpBar current={enemy.hp} max={enemy.hpMax} color="#cc2200" showMarkers />
          <MpBar current={enemy.mp} max={enemy.mpMax} />
          <div className="arena-enemy-cards-row">
            {enemy.hand.map(c => <EnemyCardMini key={c.instanceId} card={c} />)}
          </div>
          {canPlay && incomingDamage > 0 && (
            <div className="arena-enemy-intent">
              <span className="arena-enemy-intent__label">⚔ Nächster Angriff</span>
              <span className="arena-enemy-intent__value">~{incomingDamage.toLocaleString('de-DE')}</span>
            </div>
          )}
          {/* Tactical Overlay */}
          {tactical.tactical && (
            <TacticalOverlay tacticalState={tactical.tactical} />
          )}
        </div>
      </div>

      {/* Battle-Log + Combo-Overlay */}
      <div className="arena-log-wrap">
        <RoundStatsBar log={log} round={round} />
        <BattleLog entries={log} />

        <div className="combo-overlay">
          <ComboDisplay
            count={combo.count}
            timeLeft={combo.timeLeft}
            maxTime={combo.maxTime}
            isActive={combo.isActive}
            isBreaking={combo.isBreaking}
            isMaxCombo={combo.isMaxCombo}
            lastCard={combo.lastCard}
            popups={[]}
          />
        </div>
      </div>

      {/* Spieler unten */}
      <div className="arena-player-zone">
        <div className="arena-player-stats">
          <div>
            <span className="arena-stat-label">HP</span>
            <HpBar current={player.hp} max={player.hpMax} color="#2d8a3e" />
          </div>
          <div>
            <span className="arena-stat-label">MP {player.mp}/{player.mpMax}</span>
            <MpBar current={player.mp} max={player.mpMax} />
          </div>
        </div>

        {/* Karten-Hand */}
        <div className="arena-hand">
          {player.hand.map(card => (
            <PlayerHandCard
              key={card.instanceId}
              card={card}
              canPlay={canPlay}
              playerMp={player.mp}
              selectIndex={selectedIds.indexOf(card.instanceId)}
              onToggle={() => handleToggleCard(card)}
              enemyElement={state.enemyData.element}
            />
          ))}
        </div>

        {/* Auswahl-Hinweis */}
        {canPlay && !allPlayed && (
          <div className="arena-play-hint">
            {selectedIds.length === 0
              ? 'Karten antippen zum Auswählen'
              : `${selectedIds.length} Karte(n) ausgewählt — spielen oder weitere wählen`}
          </div>
        )}

        {/* Ausgewählte spielen */}
        {selectedIds.length > 0 && canPlay && (
          <button className="arena-play-selected" onClick={handlePlaySelected}>
            ⚔ {selectedIds.length} Karte{selectedIds.length > 1 ? 'n' : ''} ausspielen
          </button>
        )}

        {/* LIMIT BREAK */}
        {canLimitBreak && (
          <button className="arena-limit-break" onClick={handleLimitBreak}>
            ⚡ LIMIT BREAK ⚡
          </button>
        )}

        {/* Taktische Aktionen (nur im Tower-Modus) */}
        {tactical.tactical && (
          <div className="tactical-actions">
            <button
              className={`tactical-action-btn ${tactical.guardActive ? 'tactical-action-btn--active' : ''}`}
              onClick={tactical.useGuard}
              disabled={!canPlay}
            >
              🛡 Guard
              <span className="tactical-action-hint">-50% Schaden · +15 MP</span>
            </button>
            <button
              className={`tactical-action-btn ${tactical.focusActive ? 'tactical-action-btn--active' : ''}`}
              onClick={tactical.useFocus}
              disabled={!canPlay}
            >
              🎯 Focus
              <span className="tactical-action-hint">+2 Break nächste Karte</span>
            </button>
            <button
              className={`tactical-action-btn ${tactical.cleanseUsed >= 2 ? 'tactical-action-btn--disabled' : ''}`}
              onClick={tactical.useCleanse}
              disabled={tactical.cleanseUsed >= 2 || !canPlay}
            >
              ✨ Cleanse
              <span className="tactical-action-hint">{tactical.cleanseUsed}/2 · Flüche entfernen</span>
            </button>
          </div>
        )}

        {/* Verteidigen (nur Nicht-Taktik-Kämpfe) */}
        {canPlay && !tactical.tactical && (
          <button
            className="arena-guard-btn"
            onClick={handleGuard}
            disabled={player.mp < GUARD_MP_COST}
            title={player.mp < GUARD_MP_COST ? `Zu wenig MP (${GUARD_MP_COST})` : undefined}
          >
            🛡 Verteidigen
            <span className="arena-guard-btn__hint">−50% Schaden · {GUARD_MP_COST} MP</span>
          </button>
        )}

        {/* End-Turn */}
        <button
          className={`arena-end-turn
            ${!canPlay ? 'arena-end-turn--disabled' : ''}
            ${canPlay && allPlayed ? 'arena-end-turn--ready' : ''}
          `}
          onClick={battle.endTurn}
          disabled={!canPlay}
        >
          {phase !== 'player_turn' ? '⏳ Warten …'
            : allPlayed ? '▶ Zug beenden'
            : `▶ Zug beenden (${player.hand.filter(c => !c.played).length} übrig)`}
        </button>
      </div>

    </div>
  );
};

// ── HP/MP-Balken ──────────────────────────────────────────────

const HpBar: React.FC<{ current: number; max: number; color: string; showMarkers?: boolean }> = ({ current, max, color, showMarkers }) => {
  const pct      = max > 0 ? Math.max(0, (current / max) * 100) : 0;
  const isDanger = pct > 0 && pct < 25;
  const isRage   = showMarkers && pct > 0 && pct < 30;
  return (
    <div className={`battle-bar ${isDanger ? 'battle-bar--danger' : ''} ${isRage ? 'battle-bar--rage' : ''}`}>
      <div className="battle-bar__fill" style={{ width: `${pct}%`, background: isRage ? 'linear-gradient(90deg, #8b0000, #ff2200)' : color }} />
      {showMarkers && (
        <>
          <div className="battle-bar__marker" style={{ left: '25%' }} />
          <div className="battle-bar__marker" style={{ left: '50%' }} />
          <div className="battle-bar__marker" style={{ left: '75%' }} />
        </>
      )}
      <span className="battle-bar__label">
        {current.toLocaleString('de-DE')} / {max.toLocaleString('de-DE')}
      </span>
    </div>
  );
};

const MpBar: React.FC<{ current: number; max: number }> = ({ current, max }) => {
  const pct = max > 0 ? Math.max(0, (current / max) * 100) : 0;
  return (
    <div className="battle-bar battle-bar--mp">
      <div className="battle-bar__fill" style={{ width: `${pct}%`, background: '#1a5faf' }} />
      <span className="battle-bar__label">{current} MP</span>
    </div>
  );
};

// ── Spieler-Hand-Karte ────────────────────────────────────────

interface PlayerHandCardProps {
  card:         BattleCard;
  canPlay:      boolean;
  playerMp:     number;
  selectIndex:  number;   // -1 = nicht ausgewählt, ≥0 = Spielreihenfolge
  onToggle:     () => void;
  enemyElement: string;
}

const PlayerHandCard: React.FC<PlayerHandCardProps> = ({
  card, canPlay, playerMp, selectIndex, onToggle, enemyElement,
}) => {
  const [imgErr,    setImgErr]   = useState(false);
  const [striking,  setStriking] = useState(false);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    if (card.played) {
      setStriking(true);
      setTimeout(() => setStriking(false), 460);
    }
  }, [card.played]);

  const noMp       = card.mpCost > playerMp;
  const blocked    = card.played || card.destroyed || !canPlay || noMp;
  const isSelected = selectIndex >= 0;
  const rc         = RARITY_COLOR[card.card?.rarity ?? 'N'] ?? '#8a6520';
  const elemMatchup = card.card?.element
    ? ElementalService.getMatchup(card.card.element, enemyElement)
    : 'neutral';

  const handleClick = () => {
    if (!blocked) onToggle();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    touchStartY.current = null;

    if (Math.abs(deltaY) < 15 && !blocked) {
      e.preventDefault(); // verhindert nachfolgendes click-Event
      onToggle();
    }
  };

  return (
    <div
      className={`hand-card
        ${striking                                ? 'hand-card--striking'  : ''}
        ${isSelected                              ? 'hand-card--selected'  : ''}
        ${card.played                             ? 'hand-card--played'    : ''}
        ${card.destroyed                          ? 'hand-card--destroyed' : ''}
        ${noMp && !card.played                    ? 'hand-card--no-mp'     : ''}
        ${!blocked && !isSelected && !striking    ? 'hand-card--playable'  : ''}
      `}
      style={{ '--rc': rc } as React.CSSProperties}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      title={noMp ? `Zu wenig MP (${card.mpCost})` : card.name}
    >
      <div className="hand-card__art">
        {!imgErr && card.image
          ? <img src={card.image} alt={card.name} onError={() => setImgErr(true)} />
          : <div className="hand-card__placeholder">🌑</div>}
        {card.played && <div className="hand-card__played-overlay">✓</div>}
        <div className="hand-card__gradient" />
      </div>
      <div className={`hand-card__mp ${noMp ? 'hand-card__mp--low' : ''}`}>
        💧{card.mpCost}
      </div>
      {elemMatchup !== 'neutral' && !card.played && (
        <div className={`hand-card__elem-badge hand-card__elem-badge--${elemMatchup}`}>
          {elemMatchup === 'advantage' ? '▲' : '▼'}
        </div>
      )}
      {isSelected && !card.played && (
        <div className="hand-card__select-order">{selectIndex + 1}</div>
      )}
      <div className="hand-card__footer">
        <span className="hand-card__name">{card.name}</span>
        <span className="hand-card__atk">⚔ {card.atk.toLocaleString('de-DE')}</span>
      </div>
    </div>
  );
};

// ── Gegner-Karte (mini) ───────────────────────────────────────

const EnemyCardMini: React.FC<{ card: BattleCard }> = ({ card }) => (
  <div
    className={`enemy-card-mini
      ${card.played    ? 'enemy-card-mini--played'    : ''}
      ${card.destroyed ? 'enemy-card-mini--destroyed' : ''}
    `}
    title={`${card.name} · ATK ${card.atk.toLocaleString('de-DE')} · ${card.mpCost} MP`}
  >
    <span className="enemy-card-mini__icon">
      {card.destroyed ? '💀' : card.played ? '✓' : '🃏'}
    </span>
    <span className="enemy-card-mini__name">{card.name.split(' ')[0]}</span>
    <span className="enemy-card-mini__atk">⚔{card.atk.toLocaleString('de-DE')}</span>
  </div>
);

// ── Battle-Log ────────────────────────────────────────────────

// ── Round Stats Bar ───────────────────────────────────────────
const RoundStatsBar: React.FC<{ log: BattleState['log']; round: number }> = ({ log, round }) => {
  const roundEntries = log.filter(e => e.round === round);
  const playerDmg = roundEntries.filter(e => e.actor === 'player').reduce((s, e) => s + e.damage, 0);
  const enemyDmg  = roundEntries.filter(e => e.actor === 'enemy').reduce((s, e) => s + e.damage, 0);
  if (playerDmg === 0 && enemyDmg === 0) return null;
  return (
    <div className="round-stats-bar">
      <span className="round-stats-bar__round">R{round}</span>
      <span className="round-stats-bar__player">⚔ {playerDmg.toLocaleString('de-DE')}</span>
      <span className="round-stats-bar__sep">·</span>
      <span className="round-stats-bar__enemy">🛡 {enemyDmg.toLocaleString('de-DE')}</span>
    </div>
  );
};

const BattleLog: React.FC<{ entries: BattleState['log'] }> = ({ entries }) => {
  const visible = [...entries].reverse().slice(0, 5);
  return (
    <div className="battle-log">
      {visible.map(e => (
        <div
          key={e.id}
          className={[
            'battle-log__entry',
            `battle-log__entry--${e.actor}`,
            e.isSuper                          ? 'battle-log__entry--super'      : '',
            e.text.includes('LETZTE KRAFT')    ? 'battle-log__entry--last-stand' : '',
            e.text.includes('▲VORTEIL')        ? 'battle-log__entry--advantage'  : '',
            e.text.includes('▼NACHTEIL')       ? 'battle-log__entry--weakness'   : '',
          ].join(' ')}
        >
          <div className="battle-log__main">
            <span>{e.text}</span>
            {e.damage > 0 && (
              <span className={`battle-log__dmg battle-log__dmg--${e.actor}`}>
                -{e.damage.toLocaleString('de-DE')}
              </span>
            )}
          </div>
          {e.quote && (
            <div className="battle-log__quote">„{e.quote}"</div>
          )}
        </div>
      ))}
    </div>
  );
};


// ── Taktisches Overlay ────────────────────────────────────────

const TacticalOverlay: React.FC<{ tacticalState: TacticalBattleState }> = ({ tacticalState }) => (
  <div className="tactical-overlay">
    {/* Break Bar */}
    <div className="tactical-break-bar">
      <span className="tactical-break-label">
        BREAK {tacticalState.breakState.current}/{tacticalState.breakState.max}
      </span>
      <div className="tactical-break-track">
        <div
          className={`tactical-break-fill ${tacticalState.breakState.isBroken ? 'tactical-break-fill--broken' : ''}`}
          style={{
            width: `${(tacticalState.breakState.current / tacticalState.breakState.max) * 100}%`,
          }}
        />
      </div>
      {tacticalState.breakState.isBroken && (
        <span className="tactical-break-broken-label">⚡ GEBROCHEN! +50% Schaden</span>
      )}
    </div>

    {/* Stance */}
    {tacticalState.stance.current && (
      <div className="tactical-stance">
        Haltung: <strong>{tacticalState.stance.current.toUpperCase()}</strong>
        {tacticalState.stance.weakTo.length > 0 && (
          <> · Schwach gegen: {tacticalState.stance.weakTo.join(', ')}</>
        )}
      </div>
    )}

    {/* Heat */}
    {tacticalState.heat.active && (
      <div className="tactical-heat">
        🔥 Aether-Hitze: {tacticalState.heat.current}/{tacticalState.heat.threshold}
      </div>
    )}

    {/* Seal */}
    {tacticalState.seal.sealedRarity && (
      <div className="tactical-seal">
        🔒 {tacticalState.seal.sealedRarity} gesperrt ({tacticalState.seal.roundsLeft} Runden)
      </div>
    )}

    {/* Intent */}
    {tacticalState.intent && (
      <div className="tactical-intent">
        <span className="tactical-intent-label">⚠ {tacticalState.intent.label}</span>
        <span className="tactical-intent-counter">Konter: {tacticalState.intent.counter}</span>
      </div>
    )}
  </div>
);

export default BattleScreen;
