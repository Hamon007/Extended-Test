// ─────────────────────────────────────────────────────────────────────────────
// AccountTypes.ts  –  Codex Immortalis Account-Level-System
//
// Account-Level und Karten-Level sind vollständig getrennte Systeme.
// Das Account-Level steuert maximale Ausdauer und maximales Mana.
// Es gibt kein Maximum — Level steigt theoretisch unbegrenzt.
// ─────────────────────────────────────────────────────────────────────────────

export interface AccountState {
  level:              number;   // aktuelles Account-Level (startet bei 1, kein Max)
  xp:                 number;   // XP auf der aktuellen Stufe (0 … xpToNextLevel-1)
  totalXp:            number;   // kumulierte Gesamt-XP (nie zurückgesetzt)
  stamina:            number;   // aktuelle Ausdauer (gespiegelt von EnergyService)
  maxStamina:         number;   // berechnetes Maximum (aus Level)
  mana:               number;   // aktuelles Mana (vorerst nicht verbraucht)
  maxMana:            number;   // berechnetes Maximum (aus Level)
  lastStaminaRefill?: number;   // Unix-Timestamp letzte Auffüllung (optional)
  lastManaRefill?:    number;   // Unix-Timestamp letzte Mana-Auffüllung (optional)
}

export interface AccountLevelResult {
  newState:     AccountState;
  leveledUp:    boolean;
  levelsGained: number;
  oldLevel:     number;
  newLevel:     number;
}
