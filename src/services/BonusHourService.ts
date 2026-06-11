/**
 * BonusHourService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Bonus Hour: the first 15 minutes of every even UTC hour
 * award double crystals from all battle victories.
 * Creates predictable urgency (12 chances per day) and rewards
 * players who check in frequently.
 * ─────────────────────────────────────────────────────────────
 */

const BONUS_MINUTES = 15;   // how long the bonus lasts
const BONUS_MULT    = 2.0;  // crystal multiplier during bonus

function nowUtc() {
  return new Date();
}

/** Whether Bonus Hour is active right now. */
function isActive(): boolean {
  const n = nowUtc();
  return n.getUTCHours() % 2 === 0 && n.getUTCMinutes() < BONUS_MINUTES;
}

/** Milliseconds remaining in the current bonus window (0 if not active). */
function msRemaining(): number {
  if (!isActive()) return 0;
  const n = nowUtc();
  const endMin = BONUS_MINUTES - n.getUTCMinutes();
  const endSec = 60 - n.getUTCSeconds();
  return (endMin * 60 + (endSec === 60 ? 0 : -n.getUTCSeconds())) * 1000
    + (60 - n.getUTCSeconds()) * 1000 - (endMin * 60 * 1000);
}

/** Milliseconds until the NEXT bonus hour begins (0 if currently active). */
function msUntilNext(): number {
  if (isActive()) return 0;
  const n = nowUtc();
  const h = n.getUTCHours();
  const m = n.getUTCMinutes();
  const s = n.getUTCSeconds();

  // Next even hour >= current
  let nextEvenHour = h % 2 === 0 ? h : h + 1;
  if (nextEvenHour === h && m >= BONUS_MINUTES) nextEvenHour = h + 2; // this window is past
  nextEvenHour = nextEvenHour % 24;

  const elapsedToday = h * 3600 + m * 60 + s;
  const targetSec    = nextEvenHour * 3600;
  let diffSec        = targetSec - elapsedToday;
  if (diffSec <= 0) diffSec += 24 * 3600;

  return diffSec * 1000;
}

/** Apply Bonus Hour multiplier to a crystal amount. Returns extra crystals earned. */
function getBonus(base: number): number {
  if (!isActive() || base <= 0) return 0;
  return Math.round(base * (BONUS_MULT - 1)); // extra on top
}

export const BonusHourService = {
  isActive,
  msRemaining,
  msUntilNext,
  getBonus,
  BONUS_MULT,
  BONUS_MINUTES,
};
