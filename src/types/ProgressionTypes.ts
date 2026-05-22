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
