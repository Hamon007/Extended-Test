/**
 * DailyDuoService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Each day, two specific cards are chosen as the "Tages-Duo."
 * When both cards are in the active battle deck simultaneously,
 * every victory earns +100 bonus crystals.
 * Cards are seeded by date — same duo for all players.
 * Changes daily at UTC midnight.
 * ─────────────────────────────────────────────────────────────
 */

import { CardDatabase } from './CardDatabase';
import { SaveService } from './SaveService';
import type { Card } from '../types/Card';

export const DUO_BONUS = 100;

function utcDateSeed(): number {
  const d = new Date();
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

function seededPick(arr: string[], seed: number): string {
  let h = seed ^ 0x9e3779b9;
  h = Math.imul(h, 0x6c62272e);
  h = h ^ (h >>> 16);
  return arr[((h >>> 0) % arr.length)]!;
}

/** Returns the two Daily Duo card IDs for today (deterministic, seeded by UTC date). */
export function getDailyDuo(): [Card, Card] | null {
  const all = CardDatabase.getAll();
  if (all.length < 2) return null;
  const seed = utcDateSeed();
  const ids  = all.map(c => c.id);

  // Pick first card
  const id1  = seededPick(ids, seed);
  // Pick second card — different from first
  const ids2 = ids.filter(id => id !== id1);
  const id2  = seededPick(ids2, seed + 1);

  const c1 = CardDatabase.getById(id1);
  const c2 = CardDatabase.getById(id2);
  if (!c1 || !c2) return null;
  return [c1, c2];
}

/** Returns true if both duo cards are in the player's active deck. */
export function isDuoActive(deckCardIds: string[]): boolean {
  const duo = getDailyDuo();
  if (!duo) return false;
  return deckCardIds.includes(duo[0].id) && deckCardIds.includes(duo[1].id);
}

/** Returns true if the player owns both duo cards (in inventory). */
export function playerOwnsDuo(): { owns0: boolean; owns1: boolean } {
  const duo = getDailyDuo();
  if (!duo) return { owns0: false, owns1: false };
  const inv = SaveService.loadGachaState().inventory;
  const ownedIds = new Set(inv.map(i => i.cardId));
  return { owns0: ownedIds.has(duo[0].id), owns1: ownedIds.has(duo[1].id) };
}

/**
 * Apply Daily Duo bonus on victory.
 * Returns DUO_BONUS if active, 0 otherwise. Also credits crystals.
 */
export function applyBonus(deckCardIds: string[]): number {
  if (!isDuoActive(deckCardIds)) return 0;
  const gs = SaveService.loadGachaState();
  SaveService.saveGachaState({ ...gs, crystals: gs.crystals + DUO_BONUS });
  return DUO_BONUS;
}

export const DailyDuoService = {
  getDailyDuo,
  isDuoActive,
  playerOwnsDuo,
  applyBonus,
  DUO_BONUS,
};
