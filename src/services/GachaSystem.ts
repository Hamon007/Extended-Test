/**
 * GachaSystem.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Kernlogik des Gacha-Systems.
 * Rein funktional — kein State, kein React.
 * State-Verwaltung liegt im GachaStore (Zustand-Hook).
 *
 * Drop Rates:
 *   N:   60%  (kumulativ:  60%)
 *   R:   25%  (kumulativ:  85%)
 *   SR:  10%  (kumulativ:  95%)
 *   SSR:  4%  (kumulativ:  99%)
 *   MR:   1%  (kumulativ: 100%)
 *
 * Pity:
 *   - pityCounter steigt bei jedem Pull um 1
 *   - Erreicht er PITY_THRESHOLD (100), wird SSR erzwungen
 *   - Reset bei SSR- oder MR-Zug
 *   - MR hat kein eigenes Pity
 * ─────────────────────────────────────────────────────────────
 */

import type { Card, Rarity } from '../types/Card';
import type {
  CardInstance,
  GachaState,
  MultiPullResult,
  PullResult,
} from '../types/GachaTypes';
import {
  DROP_RATES,
  MULTI_PULL_COUNT,
  PITY_THRESHOLD,
  PULL_COST_MULTI,
  PULL_COST_SINGLE,
} from '../types/GachaTypes';
import { RARITY_ORDER } from '../types/Card';
import { CardDatabase } from './CardDatabase';

// ── UUID-Generierung ──────────────────────────────────────────
// crypto.randomUUID() ist in allen modernen Browsern verfügbar (ES2021).
// Fallback für ältere Umgebungen.

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: einfaches UUID-v4-artiges Format
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ── Seltenheit würfeln ────────────────────────────────────────

function rollRarity(forcePity: boolean): Rarity {
  if (forcePity) return 'SSR';

  const roll = Math.random() * 100;
  for (const entry of DROP_RATES) {
    if (roll < entry.cumulative) return entry.rarity;
  }
  return 'N'; // Fallback (sollte nie eintreten)
}

// ── Zufällige Karte einer Seltenheit auswählen ────────────────
// Wenn keine Karte der exakten Seltenheit existiert,
// wird zur nächstniedereren Seltenheit zurückgefallen.

function pickCard(rarity: Rarity): Card | null {
  let pool = CardDatabase.getByRarity(rarity);

  if (pool.length === 0) {
    // Fallback: nächstniedrigere verfügbare Seltenheit
    const idx = RARITY_ORDER.indexOf(rarity);
    for (let i = idx - 1; i >= 0; i--) {
      pool = CardDatabase.getByRarity(RARITY_ORDER[i]);
      if (pool.length > 0) break;
    }
  }

  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Einzelnen Pull berechnen ──────────────────────────────────

function executeSinglePull(state: GachaState): {
  result: PullResult;
  nextState: GachaState;
} {
  const pityAtPull  = state.pityCounter;
  const forcePity   = pityAtPull >= PITY_THRESHOLD - 1; // 0-indexed → bei 99 ist es Pull 100
  const rarity      = rollRarity(forcePity);
  const card        = pickCard(rarity);

  if (!card) {
    // Datenbank leer — darf im produktiven Betrieb nicht eintreten
    throw new Error('[GachaSystem] Keine Karten in der Datenbank gefunden.');
  }

  // Pity-Counter: Reset bei SSR oder MR, sonst +1
  const resetsRarity = rarity === 'SSR' || rarity === 'MR' || RARITY_ORDER.indexOf(rarity) > RARITY_ORDER.indexOf('SSR');
  const newPity      = resetsRarity ? 0 : pityAtPull + 1;
  const newTotal     = state.totalPulls + 1;

  const instance: CardInstance = {
    uuid:      generateUUID(),
    cardId:    card.id,
    rarity:    rarity,
    pulledAt:  Date.now(),
    pullIndex: newTotal,
    isNew:     true,
    level:     1,
    xp:        0,
  };

  const result: PullResult = {
    instance,
    wasPity:    forcePity,
    pityAtPull,
  };

  const nextState: GachaState = {
    ...state,
    pityCounter: newPity,
    totalPulls:  newTotal,
    inventory:   [...state.inventory, instance],
  };

  return { result, nextState };
}

// ── Höchste Seltenheit aus einem Ergebnisset ─────────────────

function highestRarity(results: PullResult[]): Rarity {
  let best = 0;
  for (const r of results) {
    const idx = RARITY_ORDER.indexOf(r.instance.rarity);
    if (idx > best) best = idx;
  }
  return RARITY_ORDER[best];
}

// ── Öffentliche API ───────────────────────────────────────────

export type PullError = 'NOT_ENOUGH_CRYSTALS' | 'DB_EMPTY';

export interface SinglePullOutcome {
  ok:        true;
  result:    PullResult;
  nextState: GachaState;
}

export interface MultiPullOutcome {
  ok:        true;
  result:    MultiPullResult;
  nextState: GachaState;
}

export interface PullFailure {
  ok:    false;
  error: PullError;
}

// Alpha: Kristalle werden nicht abgezogen — unbegrenzte Beschwörungen zum Testen
const ALPHA_CRYSTALS = 999_999;

function singlePull(state: GachaState): SinglePullOutcome | PullFailure {
  try {
    const stateForPull = { ...state, crystals: ALPHA_CRYSTALS };
    const { result, nextState } = executeSinglePull(stateForPull);
    return { ok: true, result, nextState: { ...nextState, crystals: ALPHA_CRYSTALS } };
  } catch {
    return { ok: false, error: 'DB_EMPTY' };
  }
}

function multiPull(state: GachaState): MultiPullOutcome | PullFailure {
  try {
    let current = { ...state, crystals: ALPHA_CRYSTALS };
    const results: PullResult[] = [];

    for (let i = 0; i < MULTI_PULL_COUNT; i++) {
      const { result, nextState } = executeSinglePull(current);
      results.push(result);
      current = nextState;
    }

    const multiResult: MultiPullResult = {
      results,
      totalSpent: PULL_COST_MULTI,
      bestRarity: highestRarity(results),
    };

    return { ok: true, result: multiResult, nextState: { ...current, crystals: ALPHA_CRYSTALS } };
  } catch {
    return { ok: false, error: 'DB_EMPTY' };
  }
}

// Hilfsfunktion: Kann ein Pull durchgeführt werden?
function canSinglePull(crystals: number): boolean {
  return crystals >= PULL_COST_SINGLE;
}

function canMultiPull(crystals: number): boolean {
  return crystals >= PULL_COST_MULTI;
}

export const GachaSystem = {
  singlePull,
  multiPull,
  canSinglePull,
  canMultiPull,
};
