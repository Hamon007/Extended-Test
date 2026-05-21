/**
 * FusionSystem.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Karten-Fusion / Rank-Up.
 * Rein funktional — kein State, kein React.
 *
 * Prinzip (gemäß Konzept "Karten-Progression"):
 *   N → R → SR → SSR → MR → MR+ → MR++ → MR+++ → LR
 *   Duplikate derselben Karte werden verschmolzen, um die
 *   Trägerkarte eine Stufe aufsteigen zu lassen.
 *   Fusion erhöht Stats und senkt die MP-Kosten.
 *   Für LR werden so mehrere MR-Duplikate benötigt.
 * ─────────────────────────────────────────────────────────────
 */

import type { Card, CardStats, Rarity } from '../types/Card';
import { RARITY_ORDER } from '../types/Card';
import type { CardInstance, GachaState } from '../types/GachaTypes';
import { CardDatabase } from './CardDatabase';

// ── Fusions-Kosten ────────────────────────────────────────────
// Anzahl Duplikate (Fodder), um VON dieser Rarität eine Stufe aufzusteigen.

export const FUSION_DUPLICATES: Partial<Record<Rarity, number>> = {
  N:       1,
  R:       1,
  SR:      1,
  SSR:     2,
  MR:      2,
  'MR+':   2,
  'MR++':  3,
  'MR+++': 3,
  // LR: Maximum, keine weitere Stufe
};

// Kristallkosten pro Fusion (von dieser Rarität aufsteigend).
export const FUSION_CRYSTAL_COST: Partial<Record<Rarity, number>> = {
  N:       50,
  R:       100,
  SR:      250,
  SSR:     500,
  MR:      1000,
  'MR+':   2000,
  'MR++':  4000,
  'MR+++': 8000,
};

// ── Stat-Skalierung pro Rang über Basis ───────────────────────

const ATK_PER_RANK  = 0.20;  // +20 % ATK je Rang
const DEF_PER_RANK  = 0.20;  // +20 % DEF je Rang
const HP_PER_RANK   = 0.15;  // +15 % HP  je Rang
const MP_CUT_PER_RANK = 0.08; // −8 % MP-Kosten je Rang
const CRIT_PER_RANK = 2;     // +2 % Krit je Rang (falls vorhanden)

// ── Reine Helfer ──────────────────────────────────────────────

function nextRarity(r: Rarity): Rarity | null {
  const i = RARITY_ORDER.indexOf(r);
  if (i < 0 || i >= RARITY_ORDER.length - 1) return null;
  return RARITY_ORDER[i + 1];
}

/** Wie viele Ränge liegt die aktuelle Rarität über der Basis-Rarität der Karte? */
function ranksAboveBase(baseRarity: Rarity, currentRarity: Rarity): number {
  return Math.max(0, RARITY_ORDER.indexOf(currentRarity) - RARITY_ORDER.indexOf(baseRarity));
}

/** Effektive Stats einer Karteninstanz unter Berücksichtigung der Fusion. */
function getEffectiveStats(card: Card, currentRarity: Rarity): CardStats {
  const ranks = ranksAboveBase(card.rarity, currentRarity);
  const s = card.stats;
  if (ranks === 0) return { ...s };

  return {
    atk:    Math.round(s.atk * (1 + ATK_PER_RANK * ranks)),
    def:    Math.round(s.def * (1 + DEF_PER_RANK * ranks)),
    hp:     Math.round(s.hp  * (1 + HP_PER_RANK  * ranks)),
    mpCost: Math.max(1, Math.round(s.mpCost * (1 - MP_CUT_PER_RANK * ranks))),
    spd:    s.spd,
    crit:   s.crit !== undefined ? s.crit + CRIT_PER_RANK * ranks : undefined,
  };
}

// ── Fusions-Gruppen (pro Karten-ID) ───────────────────────────

export interface FusionGroup {
  cardId:              string;
  card:                Card;
  carrier:             CardInstance;   // höchste vorhandene Instanz (wird aufgewertet)
  fodder:              CardInstance[]; // übrige Instanzen (Verschmelzungs-Material)
  totalCopies:         number;
  currentRarity:       Rarity;
  nextRarity:          Rarity | null;  // null = bereits LR
  duplicatesNeeded:    number;
  duplicatesAvailable: number;
  crystalCost:         number;
  canFuse:             boolean;
}

function rarityRank(r: Rarity): number {
  return RARITY_ORDER.indexOf(r);
}

/** Inventar nach Karten-ID gruppieren und Fusions-Status berechnen. */
function buildGroups(inventory: CardInstance[]): FusionGroup[] {
  const byCard = new Map<string, CardInstance[]>();
  for (const inst of inventory) {
    const arr = byCard.get(inst.cardId);
    if (arr) arr.push(inst);
    else byCard.set(inst.cardId, [inst]);
  }

  const groups: FusionGroup[] = [];
  for (const [cardId, insts] of byCard) {
    const card = CardDatabase.getById(cardId);
    if (!card) continue;

    // Höchste Rarität zuerst; bei Gleichstand ältere Instanz als Träger (Stabilität).
    const sorted = [...insts].sort((a, b) => {
      const rd = rarityRank(b.rarity) - rarityRank(a.rarity);
      return rd !== 0 ? rd : a.pulledAt - b.pulledAt;
    });

    const carrier = sorted[0];
    const fodder  = sorted.slice(1);
    const next    = nextRarity(carrier.rarity);
    const dupNeeded   = next ? (FUSION_DUPLICATES[carrier.rarity] ?? 0) : 0;
    const crystalCost = next ? (FUSION_CRYSTAL_COST[carrier.rarity] ?? 0) : 0;

    groups.push({
      cardId,
      card,
      carrier,
      fodder,
      totalCopies:         insts.length,
      currentRarity:       carrier.rarity,
      nextRarity:          next,
      duplicatesNeeded:    dupNeeded,
      duplicatesAvailable: fodder.length,
      crystalCost,
      canFuse:             !!next && dupNeeded > 0 && fodder.length >= dupNeeded,
    });
  }

  // Fusionierbare zuerst, dann nach Rarität absteigend, dann nach Name.
  groups.sort((a, b) => {
    if (a.canFuse !== b.canFuse) return a.canFuse ? -1 : 1;
    const rd = rarityRank(b.currentRarity) - rarityRank(a.currentRarity);
    if (rd !== 0) return rd;
    return a.card.name.localeCompare(b.card.name, 'de');
  });

  return groups;
}

// ── Fusion durchführen ────────────────────────────────────────

export type FusionError =
  | 'MAXED'
  | 'NOT_ENOUGH_DUPLICATES'
  | 'NOT_ENOUGH_CRYSTALS'
  | 'NOT_FOUND';

export interface FusionSuccess {
  ok:               true;
  nextState:        GachaState;
  upgradedInstance: CardInstance;
  fromRarity:       Rarity;
  toRarity:         Rarity;
  consumed:         number;
}

export interface FusionFailure {
  ok:    false;
  error: FusionError;
}

function fuse(state: GachaState, cardId: string): FusionSuccess | FusionFailure {
  const group = buildGroups(state.inventory).find(g => g.cardId === cardId);
  if (!group)                                              return { ok: false, error: 'NOT_FOUND' };
  if (!group.nextRarity)                                   return { ok: false, error: 'MAXED' };
  if (group.duplicatesAvailable < group.duplicatesNeeded)  return { ok: false, error: 'NOT_ENOUGH_DUPLICATES' };
  if (state.crystals < group.crystalCost)                  return { ok: false, error: 'NOT_ENOUGH_CRYSTALS' };

  const consumed     = group.fodder.slice(0, group.duplicatesNeeded);
  const consumedUuids = new Set(consumed.map(c => c.uuid));
  const fromRarity   = group.carrier.rarity;
  const toRarity     = group.nextRarity;

  const newInventory = state.inventory
    .filter(inst => !consumedUuids.has(inst.uuid))
    .map(inst =>
      inst.uuid === group.carrier.uuid
        ? { ...inst, rarity: toRarity, isNew: true }
        : inst
    );

  const upgraded = newInventory.find(i => i.uuid === group.carrier.uuid)!;

  return {
    ok:               true,
    nextState:        { ...state, crystals: state.crystals - group.crystalCost, inventory: newInventory },
    upgradedInstance: upgraded,
    fromRarity,
    toRarity,
    consumed:         consumed.length,
  };
}

// ── Export ────────────────────────────────────────────────────

export const FusionSystem = {
  buildGroups,
  fuse,
  getEffectiveStats,
  nextRarity,
  ranksAboveBase,
};
