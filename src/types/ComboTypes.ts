// ─────────────────────────────────────────────────────────────────────────────
// ComboTypes.ts  –  Codex Immortalis Combo-System
// ─────────────────────────────────────────────────────────────────────────────

import type { Element } from './Card';
import type { BattleCard } from './BattleTypes';

// ── Konstanten ────────────────────────────────────────────────────────────────

export const COMBO_WINDOW_MS   = 1500;  // Basis-Fenster in ms
export const SYNERGY_BONUS_MS  = 300;   // Fenster-Verlängerung bei Synergy-Tag
export const MAX_COMBO         = 5;

/** Schaden-Multiplikatoren je Combo-Stufe (Index = Combo-Count) */
export const COMBO_MULTIPLIERS: readonly number[] = [
  0,    // Index 0 (ungenutzt)
  1.0,  // Combo 1
  1.3,  // Combo 2
  1.7,  // Combo 3
  2.2,  // Combo 4
  3.0,  // Combo 5
];

/** Synergy-Schadens-Bonus (additiv auf Gesamtmultiplikator) */
export const SYNERGY_DAMAGE_BONUS = 0.15;   // +15%

/** Element-Vorteil-Bonus (additiv) */
export const ELEMENT_ADV_BONUS    = 0.20;   // +20%

// ── Element-Vorteil-Kette ─────────────────────────────────────────────────────
// key schlägt value

export const ELEMENT_BEATS: Partial<Record<Element, string>> = {
  fire:      'wind',
  wind:      'earth',
  earth:     'water',
  water:     'fire',
  light:     'dark',
  dark:      'light',
};

// ── Berechnungsergebnis ───────────────────────────────────────────────────────

export interface ComboCalcResult {
  baseDamage:       number;
  comboMultiplier:  number;   // aus COMBO_MULTIPLIERS[count]
  synergyBonus:     number;   // 0 oder SYNERGY_DAMAGE_BONUS
  elementBonus:     number;   // 0 oder ELEMENT_ADV_BONUS
  totalMultiplier:  number;   // comboMult × (1 + syn + elem)
  finalDamage:      number;   // Math.round(base × total)
  windowExtension:  number;   // 0 oder SYNERGY_BONUS_MS
  hasSynergy:       boolean;
  hasElementAdv:    boolean;
}

// ── Combo-Hook-State (für useComboStore) ──────────────────────────────────────

export interface ComboState {
  count:      number;           // 0 = kein aktiver Combo, 1–5 = aktiv
  timeLeft:   number;           // ms verbleibend (0 wenn inaktiv)
  maxTime:    number;           // aktuelles Fenster (1500 oder 1800 bei Synergy)
  isActive:   boolean;          // Timer läuft
  isBreaking: boolean;          // Break-Animation aktiv (600ms)
  isMaxCombo: boolean;          // count === MAX_COMBO
  lastCard:   BattleCard | null;
}

// ── Damage-Popup (für BattleScreen) ──────────────────────────────────────────

export interface DamagePopup {
  id:          number;
  damage:      number;
  combo:       number;
  multiplier:  number;
  hasSynergy:  boolean;
  hasElement:  boolean;
  xPct:        number;   // horizontale Position in % (20–80)
}
