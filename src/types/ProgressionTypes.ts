// ─────────────────────────────────────────────────────────────────────────────
// ProgressionTypes.ts  –  Codex Immortalis Progression & Belohnungen
// ─────────────────────────────────────────────────────────────────────────────

import type { CardInstance } from './GachaTypes';

// ── Konstanten ────────────────────────────────────────────────────────────────

export const DEFEAT_CONSOLATION  = 10;   // Kristalle bei Niederlage
export const DAILY_BONUS_CRYSTALS = 200; // Tages-Login-Bonus
export const POTION_DROP_CHANCE = 0.35;  // Chance auf einen Ausdauertrank bei Sieg

// ── Belohnungs-Details (nach Battle) ─────────────────────────────────────────

export interface RewardDetails {
  isVictory:       boolean;
  crystalsGained:  number;       // 0 wenn Niederlage (außer Trost)
  xpGained:        number;
  newCards:        CardInstance[]; // tatsächlich gedropte Karten
  potionsGained?:  number;       // gedropte Ausdauertränke (Sieg)
  defeatReason?:   'hp' | 'rounds';
}

// ── Daily-Bonus-Ergebnis ──────────────────────────────────────────────────────

export interface DailyBonusResult {
  granted:  boolean;
  crystals: number;  // 0 wenn nicht gewährt
}
