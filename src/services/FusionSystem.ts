/**
 * FusionSystem.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Karten-Fusion / Rank-Up.
 * Rein funktional — kein State, kein React.
 *
 * Modell (gemäß Konzept "Karten-Progression"):
 *   Jede Hauptstufe hat Unterstufen: base → + → ++ → +++.
 *   Pro Fusionsschritt wird 1 Duplikat derselben Karte verbraucht
 *   und die Trägerkarte steigt eine Unterstufe.
 *   Nach +++ bringt das 4. Duplikat die Karte in die nächste
 *   Hauptstufe (Endform). Eine Karte kann maximal EINE Hauptstufe
 *   über ihre Basis aufsteigen:
 *     N→R, R→SR, SR→SSR, SSR→MR, MR→LR.
 *   LR-Basiskarten enden bei LR+++ (keine höhere Hauptstufe).
 *   Jede Stufe erhöht Stats und senkt MP-Kosten.
 * ─────────────────────────────────────────────────────────────
 */

import type { Card, CardStats, Rarity } from '../types/Card';
import { RARITY_ORDER, RARITY_MAJORS, rarityMajor } from '../types/Card';
import type { CardInstance, GachaState } from '../types/GachaTypes';
import { CardDatabase } from './CardDatabase';
import { levelMultiplier } from './LevelSystem';
import {
  DUPLICATES_PER_STEP,
  STEP_CRYSTAL_COST,
  FUSION_ATK_PER_RANK    as ATK_PER_RANK,
  FUSION_DEF_PER_RANK    as DEF_PER_RANK,
  FUSION_HP_PER_RANK     as HP_PER_RANK,
  FUSION_MP_CUT_PER_RANK as MP_CUT_PER_RANK,
  FUSION_CRIT_PER_RANK   as CRIT_PER_RANK,
} from '../config/GameConfig';

export { DUPLICATES_PER_STEP, STEP_CRYSTAL_COST };

// ── Reine Helfer ──────────────────────────────────────────────

/** Höchste erreichbare Rarität für eine Karte mit gegebener Basis-Hauptstufe. */
function ceilingRarity(baseRarity: Rarity): Rarity {
  const major = rarityMajor(baseRarity);
  const mi = RARITY_MAJORS.indexOf(major);
  if (mi < 0) return baseRarity;
  // Oberste Hauptstufe (LR): Decke ist +++ derselben Stufe.
  if (mi === RARITY_MAJORS.length - 1) {
    return `${major}+++` as Rarity;
  }
  // Sonst: Basis der nächsten Hauptstufe.
  return RARITY_MAJORS[mi + 1];
}

/** Nächste Rarität beim Fusionieren — null wenn Decke erreicht. */
function nextRarity(baseRarity: Rarity, current: Rarity): Rarity | null {
  const ceilingIdx = RARITY_ORDER.indexOf(ceilingRarity(baseRarity));
  const curIdx     = RARITY_ORDER.indexOf(current);
  if (curIdx < 0 || curIdx >= ceilingIdx) return null;
  return RARITY_ORDER[curIdx + 1];
}

/** Wie viele Unterstufen liegt die aktuelle Rarität über der Basis? */
function ranksAboveBase(baseRarity: Rarity, currentRarity: Rarity): number {
  return Math.max(0, RARITY_ORDER.indexOf(currentRarity) - RARITY_ORDER.indexOf(baseRarity));
}

/** Effektive Stats einer Karteninstanz unter Berücksichtigung von Fusion + Level. */
function getEffectiveStats(card: Card, currentRarity: Rarity, level = 1): CardStats {
  const ranks = ranksAboveBase(card.rarity, currentRarity);
  const s     = card.stats;
  const lvl   = levelMultiplier(level);

  const fusAtk = ranks === 0 ? s.atk : Math.round(s.atk * (1 + ATK_PER_RANK * ranks));
  const fusDef = ranks === 0 ? s.def : Math.round(s.def * (1 + DEF_PER_RANK * ranks));
  const fusHp  = ranks === 0 ? s.hp  : Math.round(s.hp  * (1 + HP_PER_RANK  * ranks));

  return {
    atk:    Math.round(fusAtk * lvl.atk),
    def:    Math.round(fusDef * lvl.def),
    hp:     Math.round(fusHp  * lvl.hp),
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
  nextRarity:          Rarity | null;  // null = Decke erreicht (Endform)
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
    const next    = nextRarity(card.rarity, carrier.rarity);
    const crystalCost = next ? (STEP_CRYSTAL_COST[rarityMajor(carrier.rarity)] ?? 0) : 0;

    groups.push({
      cardId,
      card,
      carrier,
      fodder,
      totalCopies:         insts.length,
      currentRarity:       carrier.rarity,
      nextRarity:          next,
      duplicatesNeeded:    DUPLICATES_PER_STEP,
      duplicatesAvailable: fodder.length,
      crystalCost,
      canFuse:             !!next && fodder.length >= DUPLICATES_PER_STEP,
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

  const consumed      = group.fodder.slice(0, group.duplicatesNeeded);
  const consumedUuids = new Set(consumed.map(c => c.uuid));
  const fromRarity    = group.carrier.rarity;
  const toRarity      = group.nextRarity;

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
  ceilingRarity,
  ranksAboveBase,
};
