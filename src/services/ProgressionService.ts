/**
 * ProgressionService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Wendet Belohnungen auf den lokalen Spielstand an.
 * Liest und schreibt ausschließlich über SaveService.
 * Keine Server-Zeit — alles lokale Gerätezeit.
 * ─────────────────────────────────────────────────────────────
 */

import type { BattleResult, EnemyData } from '../types/BattleTypes';
import type { CardInstance } from '../types/GachaTypes';
import type { DailyBonusResult, RewardDetails } from '../types/ProgressionTypes';
import { DAILY_BONUS_CRYSTALS, DEFEAT_CONSOLATION, POTION_DROP_CHANCE } from '../types/ProgressionTypes';
import { CRYSTAL_CARD_DROP_CHANCE, ACCOUNT_CONSOLATION_XP } from '../config/GameConfig';
import { CardDatabase } from './CardDatabase';
import { SaveService } from './SaveService';
import { EnergyService } from './EnergyService';
import { AccountProgressionService } from './AccountProgressionService';
import { ActivityFeedService } from './ActivityFeedService';
import { WinStreakService } from './WinStreakService';
import { RelicService } from './RelicService';

// ── UUID-Generierung (identisch zu GachaSystem) ───────────────

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ── Karten-Drop berechnen ─────────────────────────────────────

function rollRewardCards(enemy: EnemyData, totalPulls: number): CardInstance[] {
  const dropped: CardInstance[] = [];
  if (!enemy.rewardCards || enemy.rewardCards.length === 0) return dropped;

  for (const reward of enemy.rewardCards) {
    if (Math.random() < reward.chance) {
      const card = CardDatabase.getById(reward.cardId);
      if (!card) {
        console.warn(`[Progression] Reward-Karte nicht gefunden: ${reward.cardId}`);
        continue;
      }
      dropped.push({
        uuid:      generateUUID(),
        cardId:    card.id,
        rarity:    card.rarity,
        pulledAt:  Date.now(),
        pullIndex: totalPulls + dropped.length + 1,
        isNew:     true,
        level:     1,
        xp:        0,
      });
    }
  }
  return dropped;
}

// ── Belohnungen anwenden ──────────────────────────────────────

/**
 * Wertet das Battle-Ergebnis aus, speichert Kristalle + Karten
 * und gibt die Details für VictoryScreen/DefeatScreen zurück.
 *
 * Darf nur EINMAL pro Battle aufgerufen werden.
 */
function applyRewards(result: BattleResult, enemy: EnemyData): RewardDetails {
  const state = SaveService.loadGachaState();

  if (result.outcome === 'victory') {
    // Win-Streak vor Belohnungsberechnung erhöhen, damit der neue Multiplikator zählt
    const newStreak = WinStreakService.incrementOnVictory();
    const streakReward = WinStreakService.getRewardMultiplier(newStreak);
    const relicCrystalBonus = 1 + RelicService.totalCrystalBonus();
    const relicXpBonus      = 1 + RelicService.totalXpBonus();
    const boostedCrystals = Math.round(result.rewardCrystals * streakReward.multiplier * relicCrystalBonus);
    const boostedXp       = Math.round(result.rewardXp       * streakReward.multiplier * relicXpBonus);

    // Streak milestone bonus crystals (triggered exactly on milestone)
    const STREAK_MILESTONES: Record<number, number> = {
      3: 50, 5: 150, 10: 400, 15: 800, 20: 1500, 30: 3000, 50: 6000,
    };
    const streakBonus = STREAK_MILESTONES[newStreak] ?? 0;

    const newCards = rollRewardCards(enemy, state.totalPulls);

    // Kristalle + Karten zum Inventar hinzufügen (inkl. Streak-Meilenstein)
    const updatedState = {
      ...state,
      crystals:   state.crystals + boostedCrystals + streakBonus,
      inventory:  [...state.inventory, ...newCards],
      totalPulls: state.totalPulls + newCards.length,
    };
    SaveService.saveGachaState(updatedState);

    // Chance auf einen Ausdauertrank
    const potionsGained = Math.random() < POTION_DROP_CHANCE ? 1 : 0;
    if (potionsGained > 0) EnergyService.addPotions(potionsGained);

    // Chance auf eine kleine Kristallkarte (→ GameConfig.CRYSTAL_CARD_DROP_CHANCE)
    if (Math.random() < CRYSTAL_CARD_DROP_CHANCE) {
      const gs2 = SaveService.loadGachaState();
      SaveService.saveGachaState({
        ...gs2,
        crystalCards: { ...gs2.crystalCards, small: gs2.crystalCards.small + 1 },
      });
    }

    // Account-XP aus dem Battle-Sieg hinzufügen (Streak-Bonus angewandt)
    const accountResult = AccountProgressionService.addAccountXp(
      SaveService.loadAccountState(),
      boostedXp,
    );
    SaveService.saveAccountState(accountResult.newState);

    // Post level milestone events (every 10 levels)
    if (accountResult.leveledUp) {
      for (let lv = accountResult.oldLevel + 1; lv <= accountResult.newLevel; lv++) {
        if (lv % 10 === 0) ActivityFeedService.post('level_cap', { level: lv });
      }
    }

    console.log(
      `[Progression] Sieg: +${result.rewardCrystals} Kristalle,`,
      `${newCards.length} neue Karte(n), ${potionsGained} Trank,`,
      `+${result.rewardXp} Account-XP`,
      accountResult.leveledUp ? `→ Level ${accountResult.newLevel}!` : '',
    );

    return {
      isVictory:        true,
      crystalsGained:   boostedCrystals + streakBonus,
      xpGained:         boostedXp,
      newCards,
      potionsGained,
      accountXpGained:  boostedXp,
      accountLevelUp:   accountResult.leveledUp ? {
        newLevel:      accountResult.newLevel,
        levelsGained:  accountResult.levelsGained,
        newMaxStamina: accountResult.newState.maxStamina,
        newMaxMana:     accountResult.newState.maxMana,
      } : null,
      streakMilestoneBonus: streakBonus > 0 ? streakBonus : undefined,
      winStreak: newStreak,
    };
  }

  if (result.outcome === 'defeat') {
    WinStreakService.resetOnDefeat();
    const updatedState = {
      ...state,
      crystals: state.crystals + DEFEAT_CONSOLATION,
    };
    SaveService.saveGachaState(updatedState);

    // Trost-XP für Niederlage
    const accountResult = AccountProgressionService.addAccountXp(
      SaveService.loadAccountState(),
      ACCOUNT_CONSOLATION_XP,
    );
    SaveService.saveAccountState(accountResult.newState);

    if (accountResult.leveledUp) {
      for (let lv = accountResult.oldLevel + 1; lv <= accountResult.newLevel; lv++) {
        if (lv % 10 === 0) ActivityFeedService.post('level_cap', { level: lv });
      }
    }

    console.log(`[Progression] Niederlage: +${DEFEAT_CONSOLATION} Trost-Kristalle, +${ACCOUNT_CONSOLATION_XP} Trost-XP`);

    return {
      isVictory:       false,
      crystalsGained:  DEFEAT_CONSOLATION,
      xpGained:        0,
      newCards:        [],
      defeatReason:    result.reason,
      accountXpGained: ACCOUNT_CONSOLATION_XP,
      accountLevelUp:  accountResult.leveledUp ? {
        newLevel:      accountResult.newLevel,
        levelsGained:  accountResult.levelsGained,
        newMaxStamina: accountResult.newState.maxStamina,
        newMaxMana:     accountResult.newState.maxMana,
      } : null,
    };
  }

  // Draw (ungenutzt in dieser Phase)
  return {
    isVictory:      false,
    crystalsGained: 0,
    xpGained:       0,
    newCards:       [],
  };
}

// ── Daily Bonus ───────────────────────────────────────────────

const DAILY_KEY = 'ci_daily_bonus_date';

/**
 * Prüft ob der Tages-Bonus noch nicht gewährt wurde.
 * Vergleicht nur das lokale Datum (Gerätezeit, kein Server).
 * Gibt gewährte Kristalle zurück (0 wenn bereits gewährt).
 */
function checkAndApplyDailyBonus(): DailyBonusResult {
  // toDateString() → "Wed May 20 2026" — eindeutig pro Tag in lokaler Zeitzone
  const today    = new Date().toDateString();
  const lastDate = localStorage.getItem(DAILY_KEY);

  if (lastDate === today) {
    return { granted: false, crystals: 0 };
  }

  // Neuer Tag → Bonus gewähren
  localStorage.setItem(DAILY_KEY, today);

  const state = SaveService.loadGachaState();
  SaveService.saveGachaState({
    ...state,
    crystals: state.crystals + DAILY_BONUS_CRYSTALS,
  });

  console.log(`[Progression] Daily Bonus: +${DAILY_BONUS_CRYSTALS} Kristalle`);
  return { granted: true, crystals: DAILY_BONUS_CRYSTALS };
}

// ── Export ────────────────────────────────────────────────────

export const ProgressionService = {
  applyRewards,
  checkAndApplyDailyBonus,
};
