/**
 * TowerMilestoneService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Tracks tower floor milestones and awards one-time crystal
 * bonuses as the player climbs. Milestones are permanent
 * achievements (not reset between sessions).
 * ─────────────────────────────────────────────────────────────
 */

import { SaveService } from './SaveService';

const KEY = 'ci_tower_milestones';

export interface TowerMilestone {
  floor:    number;
  crystals: number;
  label:    string;
}

export const TOWER_MILESTONES: TowerMilestone[] = [
  { floor: 5,   crystals: 20,    label: 'Etage 5 Meister' },
  { floor: 10,  crystals: 80,    label: 'Etage 10 Bezwinger' },
  { floor: 25,  crystals: 250,   label: 'Etage 25 Held' },
  { floor: 50,  crystals: 800,   label: 'Etage 50 Legende' },
  { floor: 75,  crystals: 1500,  label: 'Etage 75 Titan' },
  { floor: 100, crystals: 3000,  label: 'Etage 100 Unsterblicher' },
  { floor: 150, crystals: 5000,  label: 'Etage 150 Gott' },
  { floor: 200, crystals: 8000,  label: 'Etage 200 Übermensch' },
  { floor: 300, crystals: 12000, label: 'Etage 300 Kodex-Meister' },
  { floor: 500, crystals: 25000, label: 'Etage 500 Ewiger Unsterblicher' },
];

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

function checkFloor(floor: number): TowerMilestone | null {
  const milestone = TOWER_MILESTONES.find(m => m.floor === floor);
  if (!milestone) return null;

  const claimed = loadClaimed();
  if (claimed.has(floor)) return null;

  // Award crystals
  const gs = SaveService.loadGachaState();
  SaveService.saveGachaState({ ...gs, crystals: gs.crystals + milestone.crystals });

  claimed.add(floor);
  saveClaimed(claimed);

  return milestone;
}

function getClaimed(): number[] {
  return [...loadClaimed()];
}

export const TowerMilestoneService = {
  checkFloor,
  getClaimed,
  TOWER_MILESTONES,
};
