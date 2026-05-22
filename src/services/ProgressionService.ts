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
import { CardDatabase } from './CardDatabase';
import { SaveService } from './SaveService';
import { EnergyService } from './EnergyService';

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
    const newCards = rollRewardCards(enemy, state.totalPulls);

    // Kristalle + Karten zum Inventar hinzufügen
    const updatedState = {
      ...state,
      crystals:   state.crystals + result.rewardCrystals,
      inventory:  [...state.inventory, ...newCards],
      totalPulls: state.totalPulls + newCards.length,
    };
    SaveService.saveGachaState(updatedState);

    // Chance auf einen Ausdauertrank
    const potionsGained = Math.random() < POTION_DROP_CHANCE ? 1 : 0;
    if (potionsGained > 0) EnergyService.addPotions(potionsGained);

    // 10 % Chance auf eine kleine Kristallkarte
    if (Math.random() < 0.10) {
      const gs2 = SaveService.loadGachaState();
      SaveService.saveGachaState({
        ...gs2,
        crystalCards: { ...gs2.crystalCards, small: gs2.crystalCards.small + 1 },
      });
    }

    console.log(
      `[Progression] Sieg: +${result.rewardCrystals} Kristalle,`,
      `${newCards.length} neue Karte(n), ${potionsGained} Trank`,
    );

    return {
      isVictory:      true,
      crystalsGained: result.rewardCrystals,
      xpGained:       result.rewardXp,
      newCards,
      potionsGained,
    };
  }

  if (result.outcome === 'defeat') {
    const updatedState = {
      ...state,
      crystals: state.crystals + DEFEAT_CONSOLATION,
    };
    SaveService.saveGachaState(updatedState);

    console.log(`[Progression] Niederlage: +${DEFEAT_CONSOLATION} Trost-Kristalle`);

    return {
      isVictory:     false,
      crystalsGained: DEFEAT_CONSOLATION,
      xpGained:       0,
      newCards:       [],
      defeatReason:   result.reason,
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
