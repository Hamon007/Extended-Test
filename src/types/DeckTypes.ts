// ─────────────────────────────────────────────────────────────────────────────
// DeckTypes.ts  –  Codex Immortalis Deckbuilder
// ─────────────────────────────────────────────────────────────────────────────

import type { Card } from './Card';
import type { CardInstance } from './GachaTypes';

// ── Konstanten ────────────────────────────────────────────────────────────────

export const DECK_SIZE     = 10;
export const MAX_DECK_COST = 800;  // max. Gesamt-MP im Deck

// ── Deck-Struktur ─────────────────────────────────────────────────────────────

/** Das gespeicherte Deck — nur UUIDs, kein Inline-State. */
export interface Deck {
  id:      string;    // 'deck_main' (später mehrere Decks möglich)
  name:    string;
  uuids:   string[];  // geordnete Liste von CardInstance-UUIDs, max DECK_SIZE
  savedAt: number;    // Unix-Timestamp letzter Speicherung
}

// ── Aufgelöster Slot (UI-Verwendung) ─────────────────────────────────────────

/**
 * Ein Slot im aktuellen Deck, mit aufgelöster Instance und Karte.
 * Beide können null sein wenn Daten fehlen — kein Crash.
 */
export interface ResolvedSlot {
  uuid:     string;
  instance: CardInstance | null;  // null wenn UUID nicht mehr im Inventar
  card:     Card | null;          // null wenn cardId nicht in DB
  missing:  boolean;              // true wenn instance === null
}

// ── Regel-Fehler ──────────────────────────────────────────────────────────────

export type DeckRuleError =
  | 'DECK_FULL'             // bereits 10 Karten im Deck
  | 'COST_EXCEEDED'         // Deck-Gesamtkosten überschreiten MAX_DECK_COST
  | 'ALREADY_IN_DECK';      // exakt diese UUID ist bereits drin

// ── Validierungsergebnis ──────────────────────────────────────────────────────

export interface DeckValidation {
  isComplete:   boolean;       // genau DECK_SIZE Karten
  isValid:      boolean;       // kein Regelverstoß, kein fehlende Karte
  errors:       DeckRuleError[];
  missingCount: number;        // Slots deren UUID nicht im Inventar ist
  totalMP:      number;
  isOverBudget: boolean;       // totalMP > MAX_DECK_COST
}

// ── Ergebnis von addCard ──────────────────────────────────────────────────────

export type AddCardResult =
  | { ok: true;  deck: Deck }
  | { ok: false; error: DeckRuleError };
