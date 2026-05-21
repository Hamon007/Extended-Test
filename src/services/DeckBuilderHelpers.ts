/**
 * DeckBuilderHelpers.ts
 * ─────────────────────────────────────────────────────────────
 * Zustandslose Hilfsfunktionen die KEIN CardDatabase/SaveService
 * importieren — verhindert Zirkel-Importe.
 * ─────────────────────────────────────────────────────────────
 */

import type { Deck } from '../types/DeckTypes';

export function createEmptyDeck(name = 'Mein Deck'): Deck {
  return {
    id:      'deck_main',
    name,
    uuids:   [],
    savedAt: 0,
  };
}
