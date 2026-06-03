/**
 * CollectionMilestoneService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Awards one-time crystal bonuses when the player reaches
 * collection-completion milestones (25%, 50%, 75%, 100%).
 * ─────────────────────────────────────────────────────────────
 */

import { SaveService } from './SaveService';
import { CardDatabase } from './CardDatabase';

const KEY = 'ci_collection_milestones';

export interface CollectionMilestone {
  pct:         number;
  crystals:    number;
  label:       string;
  icon:        string;
  uniqueCards: number;  // computed = Math.ceil(total * pct / 100)
}

const MILESTONE_DEFS = [
  { pct: 25,  crystals: 500,   label: '25% Sammlung',                 icon: '📦' },
  { pct: 50,  crystals: 1500,  label: '50% Sammlung',                 icon: '🎴' },
  { pct: 75,  crystals: 3000,  label: '75% Sammlung',                 icon: '📚' },
  { pct: 100, crystals: 10000, label: '100% Sammlung — VOLLSTÄNDIG!', icon: '🌟' },
];

function buildMilestones(): CollectionMilestone[] {
  const total = CardDatabase.count();
  return MILESTONE_DEFS.map(m => ({
    ...m,
    uniqueCards: Math.ceil(total * m.pct / 100),
  }));
}

export const COLLECTION_MILESTONES: CollectionMilestone[] = buildMilestones();

function loadClaimed(): Set<number> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as number[]);
  } catch {
    return new Set();
  }
}

function saveClaimed(claimed: Set<number>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...claimed]));
  } catch { /* ignore */ }
}

/**
 * Checks for newly reached milestones given the current owned count.
 * Returns list of awarded milestones wrapped as { milestone } objects.
 */
function checkAndClaim(ownedCount: number): Array<{ milestone: CollectionMilestone }> {
  const milestones = buildMilestones();
  const total      = CardDatabase.count();
  if (total === 0) return [];

  const pct     = (ownedCount / total) * 100;
  const claimed = loadClaimed();
  const awarded: Array<{ milestone: CollectionMilestone }> = [];

  for (const ms of milestones) {
    if (pct >= ms.pct && !claimed.has(ms.pct)) {
      const gs = SaveService.loadGachaState();
      SaveService.saveGachaState({ ...gs, crystals: gs.crystals + ms.crystals });
      claimed.add(ms.pct);
      awarded.push({ milestone: ms });
    }
  }

  if (awarded.length > 0) saveClaimed(claimed);
  return awarded;
}

/** Convenience: checks using current inventory. */
function checkAndAward(): CollectionMilestone[] {
  const inv   = SaveService.loadGachaState().inventory;
  const owned = new Set(inv.map(i => i.cardId)).size;
  return checkAndClaim(owned).map(r => r.milestone);
}

function getProgress(): {
  owned:         number;
  total:         number;
  pct:           number;
  next:          CollectionMilestone | null;
  nextMilestone: CollectionMilestone | null;
} {
  const milestones = buildMilestones();
  const inv        = SaveService.loadGachaState().inventory;
  const owned      = new Set(inv.map(i => i.cardId)).size;
  const total      = CardDatabase.count();
  const pct        = total > 0 ? (owned / total) * 100 : 0;

  const claimed = loadClaimed();
  const next    = milestones.find(m => !claimed.has(m.pct) && pct < m.pct) ?? null;

  return { owned, total, pct, next, nextMilestone: next };
}

export const CollectionMilestoneService = {
  checkAndClaim,
  checkAndAward,
  getProgress,
  COLLECTION_MILESTONES,
};
