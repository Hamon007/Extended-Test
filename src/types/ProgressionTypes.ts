// ─────────────────────────────────────────────────────────────────────────────
// ProgressionTypes.ts  –  Codex Immortalis Progression & Belohnungen
// ─────────────────────────────────────────────────────────────────────────────

import type { CardInstance } from './GachaTypes';

// ── Konstanten (Werte zentral in GameConfig.ts) ───────────────────────────────

export {
  DEFEAT_CONSOLATION,
  DAILY_BONUS_CRYSTALS,
  POTION_DROP_CHANCE,
} from '../config/GameConfig';

// ── Belohnungs-Details (nach Battle) ─────────────────────────────────────────

export interface AccountLevelUpInfo {
  newLevel:     number;
  levelsGained: number;
  newMaxStamina: number;
  newMaxMana:    number;
}

export interface RewardDetails {
  isVictory:        boolean;
  crystalsGained:   number;        // 0 wenn Niederlage (außer Trost)
  xpGained:         number;        // Karten-XP (für Anzeige)
  newCards:         CardInstance[]; // tatsächlich gedropte Karten
  potionsGained?:   number;        // gedropte Ausdauertränke (Sieg)
  defeatReason?:    'hp' | 'rounds';
  accountXpGained?: number;        // Account-XP aus diesem Battle
  accountLevelUp?:  AccountLevelUpInfo | null; // null = kein Level-Up
}

// ── Daily-Bonus-Ergebnis ──────────────────────────────────────────────────────

export interface DailyBonusResult {
  granted:  boolean;
  crystals: number;  // 0 wenn nicht gewährt
}
