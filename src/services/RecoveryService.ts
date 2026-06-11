/**
 * RecoveryService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * "Bounce-Back" mechanic: after a defeat the next victory
 * awards +50% crystals as a recovery bonus.
 * Clears automatically on the first post-defeat victory.
 * ─────────────────────────────────────────────────────────────
 */

const KEY   = 'ci_recovery_active';
const MULT  = 1.5;

function isActive(): boolean {
  return localStorage.getItem(KEY) === '1';
}

function activate(): void {
  localStorage.setItem(KEY, '1');
}

/** Call on victory. Returns the bonus crystal amount (0 if not active). */
function claim(baseCrystals: number): number {
  if (!isActive()) return 0;
  localStorage.removeItem(KEY);
  return Math.round(baseCrystals * (MULT - 1)); // extra crystals only
}

export const RecoveryService = {
  isActive,
  activate,
  claim,
  MULT,
};
