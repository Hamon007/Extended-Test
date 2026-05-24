// ─────────────────────────────────────────────────────────────────────────────
// ComboTypes.ts  –  Codex Immortalis Combo-System
// ─────────────────────────────────────────────────────────────────────────────

import type { Element } from './Card';
import type { BattleCard } from './BattleTypes';

// ── Konstanten (Werte zentral in GameConfig.ts) ───────────────────────────────

export {
  COMBO_WINDOW_MS,
  SYNERGY_BONUS_MS,
  MAX_COMBO,
  COMBO_MULTIPLIERS,
  SYNERGY_DAMAGE_BONUS,
  ELEMENT_ADV_BONUS,
} from '../config/GameConfig';

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
  element?:    string;   // Karten-Element für Farb-Effekt
  isCrit?:     boolean;  // Kritischer Treffer (Combo ≥4 oder erwacht)
  yOffset?:    number;   // Zufälliger vertikaler Startversatz (0–30)
}
