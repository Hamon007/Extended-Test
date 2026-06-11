/**
 * BountyService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Daily Bounty Board: 3 enemy-kill bounties refresh every UTC day.
 * Defeating a bounty target awards a crystal bonus. Collected bounties
 * persist until the next daily reset.
 * ─────────────────────────────────────────────────────────────
 */

import { SaveService } from './SaveService';
import { EnemyDatabase } from './EnemyDatabase';

export interface Bounty {
  enemyId:   string;
  enemyName: string;
  crystals:  number;
  collected: boolean;
}

const KEY = 'ci_bounty_state';

interface BountyState {
  date:     string;
  bounties: Array<{ enemyId: string; crystals: number; collected: boolean }>;
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function seededIdx(seed: number, max: number): number {
  let s = seed;
  s ^= s << 13; s ^= s >> 17; s ^= s << 5;
  return ((s >>> 0) % max);
}

const BOUNTY_REWARDS = [200, 300, 500];

function buildBounties(date: string): BountyState {
  const allEnemies = EnemyDatabase.getAll();
  if (allEnemies.length === 0) return { date, bounties: [] };

  const seed = hashSeed(date);
  const chosen = new Set<number>();
  const bounties: BountyState['bounties'] = [];

  for (let i = 0; i < 3 && i < allEnemies.length; i++) {
    let idx = seededIdx(seed * (i + 7) + i * 13, allEnemies.length);
    while (chosen.has(idx)) {
      idx = (idx + 1) % allEnemies.length;
    }
    chosen.add(idx);
    bounties.push({
      enemyId:   allEnemies[idx]!.id,
      crystals:  BOUNTY_REWARDS[i] ?? 200,
      collected: false,
    });
  }

  return { date, bounties };
}

function loadState(): BountyState {
  const today = todayString();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as BountyState;
      if (parsed.date === today) return parsed;
    }
  } catch { /* ignore */ }
  return buildBounties(today);
}

function saveState(st: BountyState): void {
  try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* ignore */ }
}

export const BountyService = {
  /** Returns today's 3 bounties with enemy name resolved. */
  getAll(): Bounty[] {
    const st = loadState();
    return st.bounties.map(b => {
      const enemy = EnemyDatabase.getById(b.enemyId);
      return {
        enemyId:   b.enemyId,
        enemyName: enemy?.name ?? b.enemyId,
        crystals:  b.crystals,
        collected: b.collected,
      };
    });
  },

  /** Returns uncollected crystal reward if this enemy is a bounty target, else 0. */
  checkAndCollect(enemyId: string): number {
    const st = loadState();
    const target = st.bounties.find(b => b.enemyId === enemyId && !b.collected);
    if (!target) return 0;

    target.collected = true;
    saveState(st);

    const gs = SaveService.loadGachaState();
    SaveService.saveGachaState({ ...gs, crystals: gs.crystals + target.crystals });
    void SaveService.uploadSave();

    return target.crystals;
  },

  /** True if enemyId is an uncollected bounty today. */
  isTarget(enemyId: string): boolean {
    return loadState().bounties.some(b => b.enemyId === enemyId && !b.collected);
  },

  remainingCount(): number {
    return loadState().bounties.filter(b => !b.collected).length;
  },
};
