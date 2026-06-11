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

export interface BondLevelUp {
  cardId:   string;
  cardName: string;
  newLevel: number;
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
  // Battle-Statistiken
  maxCombo?:        number;
  totalDamage?:     number;
  bondLevelUps?:    BondLevelUp[];
  masteryLevelUps?: { cardName: string; newLevel: number; stars: string }[];
  // Performance grade
  playerHpPct?:     number;   // HP% remaining at battle end (0-1)
  enemyHpPct?:      number;   // Enemy HP% at battle end (defeat only)
  roundsElapsed?:   number;   // rounds used
  grade?:           'D' | 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS';
  // First win of the day
  firstWinBonus?:   number; // extra crystals from first daily win (0 = none)
  // Streak milestone
  streakMilestoneBonus?: number; // extra crystals from streak milestone (0 = none)
  winStreak?:       number;
  // New personal records
  newRecords?:      Array<'combo' | 'damage' | 'streak' | 'floor'>;
  // Tower context (set when in tower mode)
  towerFloor?:      number;
  // Recovery bonus (post-defeat bounce-back)
  recoveryBonus?:   number;
  // Weekend bonus (+25% on Sat/Sun)
  weekendBonus?:    number;
  // Active event crystal bonus
  eventBonus?:      number;
  eventName?:       string;
  // Nemesis revenge bonus (+50% crystals for defeating your nemesis)
  nemesisBonus?:    number;
  // Bonus Hour double crystals (active first 15 min of even UTC hours)
  bonusHourBonus?:  number;
  // Crystal Rain: rare 10% chance surprise bonus on victory
  crystalRainBonus?: number;
}

// ── Daily-Bonus-Ergebnis ──────────────────────────────────────────────────────

export interface DailyBonusResult {
  granted:  boolean;
  crystals: number;  // 0 wenn nicht gewährt
}
