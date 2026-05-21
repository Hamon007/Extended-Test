/**
 * DeckBuilder.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Reine Regellogik für den Deckbuilder.
 * Kein State, kein React, kein localStorage.
 * ─────────────────────────────────────────────────────────────
 */

import type { Rarity } from '../types/Card';
import type { CardInstance } from '../types/GachaTypes';
import type {
  AddCardResult,
  Deck,
  DeckRuleError,
  DeckValidation,
  ResolvedSlot,
} from '../types/DeckTypes';
import { DECK_SIZE, MAX_MR_PER_DECK, MR_TIER } from '../types/DeckTypes';
import { CardDatabase } from './CardDatabase';
import { createEmptyDeck } from './DeckBuilderHelpers';

// ── Hilfsfunktionen (privat) ──────────────────────────────────

function isMRTier(rarity: Rarity): boolean {
  return (MR_TIER as readonly string[]).includes(rarity);
}

function buildInvMap(inventory: CardInstance[]): Map<string, CardInstance> {
  const m = new Map<string, CardInstance>();
  for (const inst of inventory) m.set(inst.uuid, inst);
  return m;
}

function deckMRCount(uuids: string[], invMap: Map<string, CardInstance>): number {
  return uuids.filter(u => {
    const inst = invMap.get(u);
    return inst ? isMRTier(inst.rarity) : false;
  }).length;
}

function deckCardIds(uuids: string[], invMap: Map<string, CardInstance>): string[] {
  return uuids
    .map(u => invMap.get(u)?.cardId)
    .filter((id): id is string => id !== undefined);
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
  rarity:    Rarity,
  deck:      Deck,
  inventory: CardInstance[],
): AddCardResult {
  if (deck.uuids.includes(uuid))          return { ok: false, error: 'ALREADY_IN_DECK' };
  if (deck.uuids.length >= DECK_SIZE)     return { ok: false, error: 'DECK_FULL' };

  const invMap = buildInvMap(inventory);

  if (deckCardIds(deck.uuids, invMap).includes(cardId)) {
    return { ok: false, error: 'DUPLICATE_CARD_ID' };
  }

  if (isMRTier(rarity) && deckMRCount(deck.uuids, invMap) >= MAX_MR_PER_DECK) {
    return { ok: false, error: 'MR_LIMIT_EXCEEDED' };
  }

  return { ok: true, deck: { ...deck, uuids: [...deck.uuids, uuid] } };
}

function removeCard(uuid: string, deck: Deck): Deck {
  return { ...deck, uuids: deck.uuids.filter(u => u !== uuid) };
}

function validateDeck(deck: Deck, inventory: CardInstance[]): DeckValidation {
  const resolved    = resolveSlots(deck, inventory);
  const missingCount = resolved.filter(s => s.missing).length;
  const mrCount     = resolved.filter(s => s.instance && isMRTier(s.instance.rarity)).length;
  const totalMP     = resolved.reduce((sum, s) => sum + (s.card?.stats.mpCost ?? 0), 0);

  // Duplikat-Prüfung
  const seen = new Set<string>();
  const hasDupes = resolved.some(s => {
    if (!s.instance) return false;
    if (seen.has(s.instance.cardId)) return true;
    seen.add(s.instance.cardId);
    return false;
  });

  const errors: DeckRuleError[] = [];
  if (hasDupes)                    errors.push('DUPLICATE_CARD_ID');
  if (mrCount > MAX_MR_PER_DECK)   errors.push('MR_LIMIT_EXCEEDED');

  const isComplete = deck.uuids.length === DECK_SIZE;
  const isValid    = isComplete && missingCount === 0 && errors.length === 0;

  return { isComplete, isValid, errors, missingCount, totalMP, mrCount };
}

function previewAdd(
  uuid:      string,
  cardId:    string,
  rarity:    Rarity,
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
  isMRTier,
};
