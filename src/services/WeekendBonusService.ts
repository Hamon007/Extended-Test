/**
 * WeekendBonusService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Saturday + Sunday bonus: +25% crystals on all battle victories.
 * Simple FOMO mechanic — gives players a reason to engage on weekends.
 * ─────────────────────────────────────────────────────────────
 */

const MULT  = 1.25;

function isActive(): boolean {
  const day = new Date().getDay(); // 0=Sun, 6=Sat
  return day === 0 || day === 6;
}

/** Returns bonus crystals (0 if not active). */
function applyBonus(baseCrystals: number): number {
  if (!isActive()) return 0;
  return Math.round(baseCrystals * (MULT - 1));
}

/** ms until bonus ends (end of Sunday 23:59:59 local) */
function msUntilEnd(): number {
  const now = new Date();
  const day = now.getDay();
  if (!isActive()) return 0;
  // End = this Sunday at 23:59:59
  const daysUntilEndOfSunday = day === 0 ? 0 : 1; // Sun=0 → ends today, Sat=6 → ends tomorrow
  const end = new Date(now);
  end.setDate(now.getDate() + daysUntilEndOfSunday);
  end.setHours(23, 59, 59, 999);
  return Math.max(0, end.getTime() - now.getTime());
}

export const WeekendBonusService = {
  isActive,
  applyBonus,
  msUntilEnd,
  MULT,
};
