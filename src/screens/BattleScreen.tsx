import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useBattleStore }       from '../hooks/useBattleStore';
import { useTacticalStore }     from '../hooks/useTacticalStore';
import { useComboStore }        from '../hooks/useComboStore';
import { useDeckStore }         from '../hooks/useDeckStore';
import { useEnergyStore }       from '../hooks/useEnergyStore';
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
import { FirstWinService } from '../services/FirstWinService';
import { BattleStatsService } from '../services/BattleStatsService';
import { EnemyTauntService } from '../services/EnemyTauntService';
import { BossRushService }   from '../services/BossRushService';
import { ElementalService }  from '../services/ElementalService';
import { TowerLore }            from '../data/towerLore';
import { BattleManager, type BattleMeta, type RuneBoost } from '../services/BattleManager';
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

const BattleScreen: React.FC = () => {
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
  const [towerMilestone, setTowerMilestone] = useState<TowerMilestone | null>(null);
  const [enemyTaunt,     setEnemyTaunt]     = useState<string | null>(null);
  const lowHpTauntFired    = useRef(false);
  const lastStandShownRef  = useRef(false);
  const [selectedRune,   setSelectedRune]   = useState<RuneBoost | null>(null);
  const [showLastStand,  setShowLastStand]  = useState(false);
  const crystalRuneMultRef = useRef(1.0);
  // Boss Rush
  const bossRushWaveRef       = useRef(0);   // 0 = not in boss rush; 1-5 = current wave
  const bossRushCrystalsRef   = useRef(0);   // accumulated crystals across waves
  const bossRushXpRef         = useRef(0);   // accumulated XP
  const [bossRushWaveComplete, setBossRushWaveComplete] = useState<{ wave: number; crystals: number } | null>(null);
  const [bossRushCanAttempt,   setBossRushCanAttempt]   = useState(() => BossRushService.canAttempt());
  const highestFloor = TowerService.getHighestFloor();
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

  const leaderBonus = useMemo(() => LeaderService.computeBonus(deckCards[0]), [deckCards]);
  const formation   = useMemo(() => FormationService.compute(deckCards), [deckCards]);

  // Tagesprüfung
  const dailyTrial = useMemo(() => DailyTrialService.today(), []);
  const dailyDone  = DailyTrialService.isCompleted();

  // PvP: Automatisch starten wenn ein Gegner anstehend ist
  useEffect(() => {
    if (pvpConsumedRef.current) return;
    const pending = PvpService.consumePendingBattle();
    if (!pending) return;
    pvpConsumedRef.current = true;
    setIsPvpMode(true);
    battle.startBattle(deckInstances, pending.enemy, { leaderBonus, formation });
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
        battle.state.result.outcome === 'victory' ? 'win' : 'loss'
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
          <VictoryScreen details={rewardDetails} onContinue={handleContinue} />
        ) : (
          <DefeatScreen details={rewardDetails} onReturnToSelect={handleContinue} />
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
    const meta: BattleMeta = { leaderBonus, formation };
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
      dailyModifier: dailyTrial.modifier,
      maxRounds:     dailyTrial.modifier.kind === 'time_trial' ? dailyTrial.modifier.maxRounds : undefined,
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
    const meta: BattleMeta = { leaderBonus, formation };
    battle.startBattle(deckInstances, wave1, meta);
  };

  const startBossRushWave = (wave: number) => {
    const enemy = BossRushService.getWave(wave);
    if (!enemy) return;
    lastStandShownRef.current = false;
    rewardApplied.current     = false;
    bossRushWaveRef.current   = wave;
    const meta: BattleMeta = { leaderBonus, formation };
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

  return (
    <div className="battle-screen--select">
      {eventToast && <div className="event-toast">{eventToast}</div>}

      <div className="battle-select-header">
        <h1 className="battle-select-title">🗼 TURM DER PRÜFUNG</h1>
        {winStreak >= 1 && (
          <div className={`battle-streak-chip ${winStreak >= 5 ? 'battle-streak-chip--hot' : ''}`}>
            🔥 {winStreak}{streakReward.multiplier > 1.0 && <> · ×{streakReward.multiplier.toFixed(1)}</>}
          </div>
        )}
      </div>

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
          <div className="battle-tower-floor-banner__hint">
            {isBoss
              ? 'Ein mächtiger Wächter versperrt den Weg. Taktik ist alles.'
              : 'Steige höher. Werde stärker. Bezwinge den Turm.'}
          </div>
        </div>
      </div>

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
          <span className="battle-energy__count">{energy.energy}/{energy.max} Kämpfe</span>
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

  // Combo gebrochen → dumpfer Sound
  useEffect(() => {
    if (combo.isBreaking && !wasBreakingRef.current) AudioService.comboBreak();
    wasBreakingRef.current = combo.isBreaking;
  }, [combo.isBreaking]);

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
          <HpBar current={enemy.hp} max={enemy.hpMax} color="#cc2200" />
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

const HpBar: React.FC<{ current: number; max: number; color: string }> = ({ current, max, color }) => {
  const pct      = max > 0 ? Math.max(0, (current / max) * 100) : 0;
  const isDanger = pct > 0 && pct < 25;
  return (
    <div className={`battle-bar ${isDanger ? 'battle-bar--danger' : ''}`}>
      <div className="battle-bar__fill" style={{ width: `${pct}%`, background: color }} />
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
