/**
 * LuckyDayService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Lucky Day: a seeded daily random event that triggers ~20% of
 * days. On a lucky day, all crystal rewards earn a +10% bonus
 * for a rolling 2-hour window (changes every 2 hours with the
 * UTC date seed so it feels different each day).
 *
 * Seed = UTC date string → deterministic per player, no backend
 * needed. Creates login anticipation: "is today my lucky day?"
 * ─────────────────────────────────────────────────────────────
 */

const LUCKY_CHANCE   = 0.20;   // 20% of days are lucky
const BONUS_PCT      = 0.10;   // +10% crystal bonus
const WINDOW_HOURS   = 2;      // active window in hours

function dateKey(): string {
  const n = new Date();
  return `${n.getUTCFullYear()}-${n.getUTCMonth()}-${n.getUTCDate()}`;
}

/** Simple seeded random from a string. Returns [0,1). */
function seededRandom(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) / 0xffffffff);
}

/** Whether today is a lucky day. Stable for the entire UTC calendar day. */
function isLuckyDay(): boolean {
  return seededRandom('luckyDay:' + dateKey()) < LUCKY_CHANCE;
}

/**
 * Which UTC hour the lucky window starts on today.
 * Seed picks one of the 12 even hours so it varies each day.
 */
function getLuckyWindowStart(): number {
  if (!isLuckyDay()) return -1;
  const idx = Math.floor(seededRandom('luckyHour:' + dateKey()) * 12);
  return idx * 2; // 0, 2, 4, ..., 22
}

/** Whether the lucky window is currently active (is lucky day + within window). */
function isActive(): boolean {
  if (!isLuckyDay()) return false;
  const startH = getLuckyWindowStart();
  const h = new Date().getUTCHours();
  return h >= startH && h < startH + WINDOW_HOURS;
}

/** Milliseconds until the lucky window begins today. -1 if not a lucky day or window already passed. */
function msUntilWindow(): number {
  if (!isLuckyDay()) return -1;
  const startH = getLuckyWindowStart();
  const n = new Date();
  const h = n.getUTCHours();
  if (h >= startH + WINDOW_HOURS) return -1; // already over
  if (h >= startH) return 0; // active now
  const diffSec = (startH - h) * 3600 - n.getUTCMinutes() * 60 - n.getUTCSeconds();
  return diffSec * 1000;
}

/** Milliseconds remaining in the active window. 0 if not active. */
function msRemaining(): number {
  if (!isActive()) return 0;
  const startH = getLuckyWindowStart();
  const n = new Date();
  const endSec = (startH + WINDOW_HOURS) * 3600;
  const nowSec = n.getUTCHours() * 3600 + n.getUTCMinutes() * 60 + n.getUTCSeconds();
  return Math.max(0, (endSec - nowSec) * 1000);
}

/** Extra crystals from the Lucky Day bonus (0 if not active). */
function getBonus(base: number): number {
  if (!isActive() || base <= 0) return 0;
  return Math.round(base * BONUS_PCT);
}

/** Human-readable start time for the lucky window, e.g. "14:00 UTC". */
function getWindowLabel(): string {
  const h = getLuckyWindowStart();
  if (h < 0) return '';
  const end = h + WINDOW_HOURS;
  return `${String(h).padStart(2, '0')}:00–${String(end).padStart(2, '0')}:00 UTC`;
}

export const LuckyDayService = {
  isLuckyDay,
  isActive,
  msUntilWindow,
  msRemaining,
  getBonus,
  getWindowLabel,
  BONUS_PCT,
  WINDOW_HOURS,
};
