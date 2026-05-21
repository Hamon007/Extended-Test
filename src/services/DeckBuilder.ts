/**
 * DeckBuilder.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Reine Regellogik für den Deckbuilder.
 * Kein State, kein React, kein localStorage.
 * ─────────────────────────────────────────────────────────────
 */

import type { CardInstance } from '../types/GachaTypes';
import type {
  AddCardResult,
  Deck,
  DeckRuleError,
  DeckValidation,
  ResolvedSlot,
} from '../types/DeckTypes';
import { DECK_SIZE, MAX_DECK_COST } from '../types/DeckTypes';
import { CardDatabase } from './CardDatabase';
import { FusionSystem } from './FusionSystem';
import { createEmptyDeck } from './DeckBuilderHelpers';

// ── Hilfsfunktionen (privat) ──────────────────────────────────

function buildInvMap(inventory: CardInstance[]): Map<string, CardInstance> {
  const m = new Map<string, CardInstance>();
  for (const inst of inventory) m.set(inst.uuid, inst);
  return m;
}

function deckCardIds(uuids: string[], invMap: Map<string, CardInstance>): string[] {
  return uuids
    .map(u => invMap.get(u)?.cardId)
    .filter((id): id is string => id !== undefined);
}

function computeTotalMP(uuids: string[], invMap: Map<string, CardInstance>): number {
  return uuids.reduce((sum, uuid) => {
    const inst = invMap.get(uuid);
    if (!inst) return sum;
    const card = CardDatabase.getById(inst.cardId);
    if (!card) return sum;
    return sum + FusionSystem.getEffectiveStats(card, inst.rarity).mpCost;
  }, 0);
}

// ── Öffentliche API ───────────────────────────────────────────

function resolveSlots(deck: Deck, inventory: CardInstance[]): ResolvedSlot[] {
  const invMap = buildInvMap(inventory);
  return deck.uuids.map(uuid => {
    const instance = invMap.get(uuid) ?? null;
    const card     = instance ? (CardDatabase.getById(instance.cardId) ?? null) : null;
    return { uuid, instance, card, missing: instance === null };
  });
}

function canAdd(
  uuid:      string,
  cardId:    string,
  rarity:    import('../types/Card').Rarity,
  deck:      Deck,
  inventory: CardInstance[],
): AddCardResult {
  if (deck.uuids.includes(uuid))          return { ok: false, error: 'ALREADY_IN_DECK' };
  if (deck.uuids.length >= DECK_SIZE)     return { ok: false, error: 'DECK_FULL' };

  const invMap = buildInvMap(inventory);

  if (deckCardIds(deck.uuids, invMap).includes(cardId)) {
    return { ok: false, error: 'DUPLICATE_CARD_ID' };
  }

  // Kosten-Budget prüfen
  const newCard = CardDatabase.getById(cardId);
  if (newCard) {
    const newCost      = FusionSystem.getEffectiveStats(newCard, rarity).mpCost;
    const existingCost = computeTotalMP(deck.uuids, invMap);
    if (existingCost + newCost > MAX_DECK_COST) {
      return { ok: false, error: 'COST_EXCEEDED' };
    }
  }

  return { ok: true, deck: { ...deck, uuids: [...deck.uuids, uuid] } };
}

function removeCard(uuid: string, deck: Deck): Deck {
  return { ...deck, uuids: deck.uuids.filter(u => u !== uuid) };
}

function validateDeck(deck: Deck, inventory: CardInstance[]): DeckValidation {
  const resolved     = resolveSlots(deck, inventory);
  const missingCount = resolved.filter(s => s.missing).length;
  const invMap       = buildInvMap(inventory);
  const totalMP      = computeTotalMP(deck.uuids, invMap);
  const isOverBudget = totalMP > MAX_DECK_COST;

  // Duplikat-Prüfung
  const seen = new Set<string>();
  const hasDupes = resolved.some(s => {
    if (!s.instance) return false;
    if (seen.has(s.instance.cardId)) return true;
    seen.add(s.instance.cardId);
    return false;
  });

  const errors: DeckRuleError[] = [];
  if (hasDupes)     errors.push('DUPLICATE_CARD_ID');
  if (isOverBudget) errors.push('COST_EXCEEDED');

  const isComplete = deck.uuids.length === DECK_SIZE;
  const isValid    = isComplete && missingCount === 0 && errors.length === 0;

  return { isComplete, isValid, errors, missingCount, totalMP, isOverBudget };
}

function previewAdd(
  uuid:      string,
  cardId:    string,
  rarity:    import('../types/Card').Rarity,
  deck:      Deck,
  inventory: CardInstance[],
): { blocked: boolean; reason: DeckRuleError | null } {
  const r = canAdd(uuid, cardId, rarity, deck, inventory);
  return r.ok ? { blocked: false, reason: null } : { blocked: true, reason: r.error };
}

export const DeckBuilder = {
  resolveSlots,
  canAdd,
  removeCard,
  validateDeck,
  createEmptyDeck,
  previewAdd,
};
