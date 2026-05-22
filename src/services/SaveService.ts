/**
 * SaveService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Zentraler localStorage-Wrapper.
 * Typisiert, fehlerresistent, leicht auf Server-API erweiterbar.
 * ─────────────────────────────────────────────────────────────
 */

import type { GachaState } from '../types/GachaTypes';
import { STARTING_CRYSTALS } from '../types/GachaTypes';
import type { Deck } from '../types/DeckTypes';
import { createEmptyDeck } from './DeckBuilderHelpers';
import { STARTING_CRYSTAL_CARDS } from '../config/GameConfig';
import type { AccountState } from '../types/AccountTypes';
import {
  createDefaultAccountState,
  normalizeAccountState,
} from './AccountProgressionService';

// ── Storage-Schlüssel ─────────────────────────────────────────

const KEYS = {
  gacha:    'ci_gacha_state',
  deck:     'ci_deck_main',
  settings: 'ci_settings',
  lastLogin:'ci_last_login',
  account:  'ci_account_state',
} as const;

// ── Generische Helfer ─────────────────────────────────────────

function persist<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('[SaveService] Schreiben fehlgeschlagen:', key, e);
  }
}

function retrieve<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.warn('[SaveService] Lesen fehlgeschlagen:', key, e);
    return null;
  }
}

// ── Standard-Gacha-State ──────────────────────────────────────

function defaultGachaState(): GachaState {
  return {
    crystals:     STARTING_CRYSTALS,
    pityCounter:  0,
    totalPulls:   0,
    inventory:    [],
    crystalCards: { ...STARTING_CRYSTAL_CARDS },
  };
}

// ── Gacha-State API ───────────────────────────────────────────

function loadGachaState(): GachaState {
  const saved = retrieve<GachaState>(KEYS.gacha);
  if (!saved) {
    const fresh = defaultGachaState();
    persist(KEYS.gacha, fresh);
    console.log('[SaveService] Neuen Gacha-State angelegt. Startkristalle:', STARTING_CRYSTALS);
    return fresh;
  }
  const inventory = Array.isArray(saved.inventory)
    ? saved.inventory.map(inst => ({
        ...inst,
        level: inst.level ?? 1,
        xp:    inst.xp    ?? 0,
      }))
    : [];

  return {
    crystals:     STARTING_CRYSTALS, // Alpha: immer volle Kristalle beim Laden
    pityCounter:  saved.pityCounter ?? 0,
    totalPulls:   saved.totalPulls  ?? 0,
    inventory,
    crystalCards: saved.crystalCards ?? { ...STARTING_CRYSTAL_CARDS },
  };
}

function saveGachaState(state: GachaState): void {
  persist(KEYS.gacha, state);
}

// ── Deck API ──────────────────────────────────────────────────

function loadDeck(): Deck {
  const saved = retrieve<Deck>(KEYS.deck);
  if (!saved) return createEmptyDeck();

  // Sanity-Check
  return {
    id:      saved.id      ?? 'deck_main',
    name:    saved.name    ?? 'Mein Deck',
    uuids:   Array.isArray(saved.uuids) ? saved.uuids.slice(0, 10) : [],
    savedAt: saved.savedAt ?? 0,
  };
}

function saveDeck(deck: Deck): void {
  persist(KEYS.deck, { ...deck, savedAt: Date.now() });
}

function deleteDeck(): void {
  localStorage.removeItem(KEYS.deck);
}

// ── Account-State API ─────────────────────────────────────────

function loadAccountState(): AccountState {
  try {
    const raw = localStorage.getItem(KEYS.account);
    if (!raw) {
      const fresh = createDefaultAccountState();
      persist(KEYS.account, fresh);
      return fresh;
    }
    return normalizeAccountState(JSON.parse(raw) as Partial<AccountState>);
  } catch (e) {
    console.warn('[SaveService] Account-State Lesen fehlgeschlagen:', e);
    return createDefaultAccountState();
  }
}

function saveAccountState(state: AccountState): void {
  persist(KEYS.account, state);
}

// ── Letzer Login ──────────────────────────────────────────────

function updateLastLogin(): void {
  persist(KEYS.lastLogin, Date.now());
}

// ── Debug: kompletten State zurücksetzen ──────────────────────

function resetAll(): void {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
  console.log('[SaveService] Alle Daten zurückgesetzt.');
}

// ── Export ────────────────────────────────────────────────────

export const SaveService = {
  loadGachaState,
  saveGachaState,
  loadDeck,
  saveDeck,
  deleteDeck,
  loadAccountState,
  saveAccountState,
  updateLastLogin,
  resetAll,
};
