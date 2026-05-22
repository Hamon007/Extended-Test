/**
 * AccountProgressionService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Reine Funktionen — kein State, kein React, kein localStorage.
 * Berechnet Account-Level, XP-Schwellen, Ausdauer- und Mana-Maximum.
 *
 * Account-Level ≠ Karten-Level. Völlig getrennte Systeme.
 * Kein Max-Level — theoretisch unbegrenzt.
 * ─────────────────────────────────────────────────────────────
 */

import type { AccountState, AccountLevelResult } from '../types/AccountTypes';

// ── Formeln ───────────────────────────────────────────────────

/** XP bis zum nächsten Level (Formel, keine feste Tabelle). */
export function xpToNextLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.35) + level * 50);
}

/** Maximale Ausdauer für ein gegebenes Account-Level. */
export function getMaxStamina(level: number): number {
  return 5 + Math.floor((level - 1) / 5);
}

/** Maximales Mana für ein gegebenes Account-Level. */
export function getMaxMana(level: number): number {
  return 500 + (level - 1) * 25;
}

// ── State-Verwaltung ──────────────────────────────────────────

export function createDefaultAccountState(): AccountState {
  const maxStamina = getMaxStamina(1);
  const maxMana    = getMaxMana(1);
  return {
    level:      1,
    xp:         0,
    totalXp:    0,
    stamina:    maxStamina,
    maxStamina,
    mana:       maxMana,
    maxMana,
  };
}

/** Repariert einen ggf. beschädigten/unvollständigen Account-State. */
export function normalizeAccountState(raw: Partial<AccountState>): AccountState {
  const level      = typeof raw.level === 'number' && raw.level >= 1
    ? Math.floor(raw.level) : 1;
  const maxStamina = getMaxStamina(level);
  const maxMana    = getMaxMana(level);
  return {
    level,
    xp:          typeof raw.xp      === 'number' ? Math.max(0, raw.xp)      : 0,
    totalXp:     typeof raw.totalXp === 'number' ? Math.max(0, raw.totalXp) : 0,
    stamina:     typeof raw.stamina === 'number'
      ? Math.min(raw.stamina, maxStamina) : maxStamina,
    maxStamina,
    mana:        typeof raw.mana    === 'number'
      ? Math.min(raw.mana, maxMana) : maxMana,
    maxMana,
    lastStaminaRefill: typeof raw.lastStaminaRefill === 'number'
      ? raw.lastStaminaRefill : undefined,
    lastManaRefill: typeof raw.lastManaRefill === 'number'
      ? raw.lastManaRefill : undefined,
  };
}

// ── XP hinzufügen + Level-Up ──────────────────────────────────

/**
 * Fügt amount XP zum Account-State hinzu.
 * Mehrfach-Level-Ups in einem Schritt werden vollständig abgewickelt.
 * Überschuss-XP bleibt erhalten.
 */
export function addAccountXp(state: AccountState, amount: number): AccountLevelResult {
  if (amount <= 0) {
    return { newState: state, leveledUp: false, levelsGained: 0, oldLevel: state.level, newLevel: state.level };
  }

  const oldLevel = state.level;
  let level      = state.level;
  let xp         = state.xp + amount;
  const totalXp  = state.totalXp + amount;
  let levelsGained = 0;

  while (xp >= xpToNextLevel(level)) {
    xp -= xpToNextLevel(level);
    level++;
    levelsGained++;
  }

  const maxStamina = getMaxStamina(level);
  const maxMana    = getMaxMana(level);

  const newState: AccountState = {
    ...state,
    level,
    xp,
    totalXp,
    maxStamina,
    maxMana,
    // Bei Level-Up: Ausdauer und Mana auf neues Maximum auffüllen
    stamina: levelsGained > 0 ? maxStamina : state.stamina,
    mana:    levelsGained > 0 ? maxMana    : state.mana,
  };

  return { newState, leveledUp: levelsGained > 0, levelsGained, oldLevel, newLevel: level };
}

// ── Export ────────────────────────────────────────────────────

export const AccountProgressionService = {
  createDefaultAccountState,
  normalizeAccountState,
  xpToNextLevel,
  getMaxStamina,
  getMaxMana,
  addAccountXp,
};
