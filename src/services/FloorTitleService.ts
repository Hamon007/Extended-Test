/**
 * FloorTitleService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Players earn prestige Titles as they advance through the Tower.
 * Each title tier has a minimum floor requirement, display name,
 * icon and color. Titles are displayed in the battle lobby and on
 * MainScreen — giving players a strong identity and clear micro-goals.
 * ─────────────────────────────────────────────────────────────
 */

import { TowerService } from './TowerService';

export interface FloorTitle {
  minFloor: number;
  title:    string;
  icon:     string;
  color:    string;
}

export const FLOOR_TITLES: FloorTitle[] = [
  { minFloor: 1,   title: 'Neuankömmling',  icon: '🔰', color: '#7daa5e' },
  { minFloor: 5,   title: 'Lehrling',        icon: '⚔',  color: '#5588cc' },
  { minFloor: 10,  title: 'Krieger',          icon: '🗡',  color: '#4477aa' },
  { minFloor: 20,  title: 'Veteran',          icon: '🛡',  color: '#cc8833' },
  { minFloor: 35,  title: 'Elite',            icon: '⚡',  color: '#cc5533' },
  { minFloor: 50,  title: 'Meister',          icon: '👑',  color: '#cc44aa' },
  { minFloor: 75,  title: 'Großmeister',      icon: '💫',  color: '#9933cc' },
  { minFloor: 100, title: 'Legende',          icon: '🌟',  color: '#ff9900' },
  { minFloor: 150, title: 'Unsterblicher',    icon: '🔥',  color: '#ff3300' },
];

function getTitleForFloor(floor: number): FloorTitle {
  let result = FLOOR_TITLES[0]!;
  for (const t of FLOOR_TITLES) {
    if (floor >= t.minFloor) result = t;
  }
  return result;
}

/** Returns the new title if advancing from oldFloor to newFloor crosses a title boundary. */
function checkTitleUnlock(oldFloor: number, newFloor: number): FloorTitle | null {
  const oldTitle = getTitleForFloor(oldFloor);
  const newTitle = getTitleForFloor(newFloor);
  return oldTitle.minFloor !== newTitle.minFloor ? newTitle : null;
}

/** Current player title based on their highest tower floor. */
function getPlayerTitle(): FloorTitle {
  return getTitleForFloor(TowerService.getHighestFloor());
}

/** Next title tier the player is working toward, or null if at max. */
function getNextTitle(currentFloor: number): FloorTitle | null {
  const current = getTitleForFloor(currentFloor);
  const idx = FLOOR_TITLES.findIndex(t => t.minFloor === current.minFloor);
  return FLOOR_TITLES[idx + 1] ?? null;
}

export const FloorTitleService = {
  getTitleForFloor,
  checkTitleUnlock,
  getPlayerTitle,
  getNextTitle,
  FLOOR_TITLES,
};
