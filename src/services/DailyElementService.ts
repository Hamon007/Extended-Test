/**
 * DailyElementService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Each UTC day a single element receives a +15% ATK blessing.
 * Seeded from the date for determinism (same for all players).
 * Only the 7 "battleworthy" elements are candidates; exotic
 * ones (void, wind, death, chaos) are excluded.
 * ─────────────────────────────────────────────────────────────
 */

import type { Element } from '../types/Card';

// Only battleworthy elements — void/wind/death/chaos are too rare to be meaningful
const CANDIDATE_ELEMENTS = ['fire', 'ice', 'lightning', 'dark', 'light', 'water', 'earth'] as const;
type BlessElement = typeof CANDIDATE_ELEMENTS[number];

export const ELEMENT_LABELS: Partial<Record<Element, string>> = {
  fire:      '🔥 Feuer',
  ice:       '❄️ Eis',
  lightning: '⚡ Blitz',
  dark:      '🌑 Dunkel',
  light:     '✨ Licht',
  water:     '💧 Wasser',
  earth:     '🌿 Erde',
};

export const ELEMENT_COLORS: Partial<Record<Element, string>> = {
  fire:      '#ff5722',
  ice:       '#81d4fa',
  lightning: '#ffee58',
  dark:      '#ab47bc',
  light:     '#fff9c4',
  water:     '#29b6f6',
  earth:     '#8d6e63',
};

export const BLESSING_ATK_BONUS = 0.15;

function todayHash(): number {
  const d = new Date();
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

function seeded(seed: number): number {
  let s = seed;
  s ^= s << 13; s ^= s >> 17; s ^= s << 5;
  return ((s >>> 0) / 0xFFFFFFFF);
}

export function getBlessedElement(): BlessElement {
  const h = todayHash();
  return CANDIDATE_ELEMENTS[Math.floor(seeded(h * 9973) * CANDIDATE_ELEMENTS.length)]!;
}
