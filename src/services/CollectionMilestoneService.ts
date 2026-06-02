/**
 * CollectionMilestoneService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Belohnungen für das Sammeln einzigartiger Karten.
 * Meilensteine bei 10 / 25 / 50 / 75 / 100 einzigartigen Karten.
 * Einmalig — wird nie zweimal ausgegeben.
 * ─────────────────────────────────────────────────────────────
 */

import { SaveService } from './SaveService';

const KEY = 'ci_collection_milestones';

export interface CollectionMilestone {
  uniqueCards: number;
  crystals:    number;
  label:       string;
  icon:        string;
}

export const COLLECTION_MILESTONES: CollectionMilestone[] = [
  { uniqueCards: 10,  crystals: 300,  icon: '📦', label: '10 einzigartige Karten' },
  { uniqueCards: 25,  crystals: 750,  icon: '📚', label: '25 einzigartige Karten' },
  { uniqueCards: 50,  crystals: 2000, icon: '🏛',  label: '50 einzigartige Karten' },
  { uniqueCards: 75,  crystals: 4000, icon: '👑', label: '75 einzigartige Karten' },
  { uniqueCards: 100, crystals: 10000,icon: '🔥', label: '100 einzigartige Karten — VOLLSTÄNDIG!' },
];

function loadClaimed(): number[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch {
    return [];
  }
}

function saveClaimed(claimed: number[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(claimed));
  } catch { /* ignore */ }
}

export interface MilestoneResult {
  milestone: CollectionMilestone;
  totalCrystalsAwarded: number;
}

/**
 * Prüft ob neue Meilensteine erreicht wurden.
 * Gibt Liste der neu ausgelösten Meilensteine zurück + wendet Belohnungen an.
 */
function checkAndClaim(uniqueCardCount: number): MilestoneResult[] {
  const claimed = loadClaimed();
  const results: MilestoneResult[] = [];

  for (const m of COLLECTION_MILESTONES) {
    if (uniqueCardCount >= m.uniqueCards && !claimed.includes(m.uniqueCards)) {
      claimed.push(m.uniqueCards);

      // Belohnung anwenden
      const gs = SaveService.loadGachaState();
      SaveService.saveGachaState({ ...gs, crystals: gs.crystals + m.crystals });

      results.push({ milestone: m, totalCrystalsAwarded: m.crystals });
    }
  }

  if (results.length > 0) saveClaimed(claimed);
  return results;
}

function getProgress(): { claimed: number[]; next: CollectionMilestone | null } {
  const claimed = loadClaimed();
  const next = COLLECTION_MILESTONES.find(m => !claimed.includes(m.uniqueCards)) ?? null;
  return { claimed, next };
}

export const CollectionMilestoneService = {
  checkAndClaim,
  getProgress,
  COLLECTION_MILESTONES,
};
