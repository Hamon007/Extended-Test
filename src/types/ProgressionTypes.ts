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
  // Lucky 7: jackpot on every 7th daily victory
  luckySevenBonus?: number;
  // Lucky Floor: +30% crystals on today's 3 seeded floors
  luckyFloorBonus?: number;
  // Element Synergy Bonus: extra crystals when 3+ cards share the daily blessed element
  elementSynergyBonus?: number;
  elementSynergyCount?: number; // how many blessed-element cards triggered it
  // Floor Record Bonus: crystals for setting a new tower best (floor × 25)
  floorRecordBonus?: number;
  // Clutch Victory: bonus for winning with < 20% HP remaining (+150)
  clutchBonus?: number;
  // Daily Boss: large bonus for defeating today's powered-up boss
  dailyBossBonus?: number;
  // Combo Jackpot: +150 for hitting MAX_COMBO (5×) in a battle
  comboJackpotBonus?: number;
  // Perfect Victory: +100 for winning with ≥ 95% HP remaining
  perfectBonus?: number;
  // Rage Mode: 2× crystals after 3+ consecutive defeats
  rageModeBonus?: number;
  // Season SP earned this battle
  spEarned?: number;
  spTotal?: number;
  spRank?: string;
}

// ── Daily-Bonus-Ergebnis ──────────────────────────────────────────────────────

export interface DailyBonusResult {
  granted:  boolean;
  crystals: number;  // 0 wenn nicht gewährt
}
