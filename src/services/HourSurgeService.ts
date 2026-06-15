/**
 * HourSurgeService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Every UTC hour, a seeded "element surge" activates.
 * Any card of that element in the active deck earns +50% crystals.
 * Different from the DailyElementService (ATK bonus) — this is
 * a per-hour crystal multiplier for engagement throughout the day.
 * ─────────────────────────────────────────────────────────────
 */

import { SaveService } from './SaveService';

export const SURGE_ELEMENTS = ['fire', 'water', 'earth', 'wind', 'light', 'dark'] as const;
export type SurgeElement = typeof SURGE_ELEMENTS[number];

export const SURGE_ELEMENT_NAMES: Record<SurgeElement, string> = {
  fire:  'Feuer',
  water: 'Wasser',
  earth: 'Erde',
  wind:  'Wind',
  light: 'Licht',
  dark:  'Dunkel',
};

export const SURGE_ELEMENT_ICONS: Record<SurgeElement, string> = {
  fire:  '🔥',
  water: '💧',
  earth: '🌿',
  wind:  '🌪',
  light: '☀️',
  dark:  '🌑',
};

export const SURGE_ELEMENT_COLORS: Record<SurgeElement, string> = {
  fire:  '#ff5020',
  water: '#2080ff',
  earth: '#60a020',
  wind:  '#40c0c0',
  light: '#ffd020',
  dark:  '#9040cc',
};

export const SURGE_BONUS = 0.5; // +50% crystals when matching deck element

function hourSeed(): number {
  const now = new Date();
  return now.getUTCFullYear() * 1000000 + (now.getUTCMonth() + 1) * 10000
    + now.getUTCDate() * 100 + now.getUTCHours();
}

function seededRand(seed: number): number {
  let h = seed ^ 0xdeadbeef;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
}

/** Get the currently active surge element (changes every UTC hour). */
export function getSurgeElement(): SurgeElement {
  const r = seededRand(hourSeed());
  return SURGE_ELEMENTS[Math.floor(r * SURGE_ELEMENTS.length)]!;
}

/** Ms remaining in current surge window. */
export function msRemaining(): number {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setUTCMinutes(0, 0, 0);
  nextHour.setUTCHours(nextHour.getUTCHours() + 1);
  return Math.max(0, nextHour.getTime() - Date.now());
}

/**
 * Apply surge bonus crystals for a victory.
 * @param baseCrystals - base crystal reward
 * @param deckElements - array of element strings from the player's active deck cards
 * @returns bonus crystals (0 if deck has no matching cards)
 */
export function applySurgeBonus(baseCrystals: number, deckElements: string[]): number {
  const surge = getSurgeElement();
  const matchCount = deckElements.filter(e => e === surge).length;
  if (matchCount === 0) return 0;
  const bonus = Math.round(baseCrystals * SURGE_BONUS * Math.min(matchCount / 3, 1));
  if (bonus > 0) {
    const gs = SaveService.loadGachaState();
    SaveService.saveGachaState({ ...gs, crystals: gs.crystals + bonus });
  }
  return bonus;
}

export const HourSurgeService = {
  getSurgeElement,
  msRemaining,
  applySurgeBonus,
  SURGE_BONUS,
  SURGE_ELEMENTS,
};
