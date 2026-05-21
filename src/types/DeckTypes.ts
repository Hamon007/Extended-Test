// ─────────────────────────────────────────────────────────────────────────────
// DeckTypes.ts  –  Codex Immortalis Deckbuilder
// ─────────────────────────────────────────────────────────────────────────────

import type { Card } from './Card';
import type { Rarity } from './Card';
import type { CardInstance } from './GachaTypes';

// ── Konstanten ────────────────────────────────────────────────────────────────

export const DECK_SIZE       = 5;
export const MAX_MR_PER_DECK = 1;

/** Alle Seltenheiten die auf das MR-Limit angerechnet werden (MR- und LR-Hauptstufe). */
export const MR_TIER: readonly Rarity[] = [
  'MR', 'MR+', 'MR++', 'MR+++',
  'LR', 'LR+', 'LR++', 'LR+++',
];

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
  | 'DECK_FULL'             // bereits 5 Karten im Deck
  | 'DUPLICATE_CARD_ID'     // gleiche card_id bereits im Deck
  | 'MR_LIMIT_EXCEEDED'     // bereits 1 MR-Tier-Karte im Deck
  | 'ALREADY_IN_DECK';      // exakt diese UUID ist bereits drin

// ── Validierungsergebnis ──────────────────────────────────────────────────────

export interface DeckValidation {
  isComplete:   boolean;       // genau DECK_SIZE Karten
  isValid:      boolean;       // kein Regelverstoß, kein fehlende Karte
  errors:       DeckRuleError[];
  missingCount: number;        // Slots deren UUID nicht im Inventar ist
  totalMP:      number;
  mrCount:      number;        // Anzahl MR-Tier-Karten im Deck
}

// ── Ergebnis von addCard ──────────────────────────────────────────────────────

export type AddCardResult =
  | { ok: true;  deck: Deck }
  | { ok: false; error: DeckRuleError };
