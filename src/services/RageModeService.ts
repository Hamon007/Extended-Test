/**
 * RageModeService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * "Rage Mode" retention mechanic: after 3+ consecutive defeats,
 * the next victory doubles all crystal rewards.
 * Resets immediately on any victory.
 * ─────────────────────────────────────────────────────────────
 */

const KEY            = 'ci_rage_mode';
export const RAGE_THRESHOLD  = 3;   // defeats before rage activates
export const RAGE_MULT       = 2.0; // crystal multiplier on rage victory

interface RageState {
  consecutiveLosses: number;
}

function load(): RageState {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RageState) : { consecutiveLosses: 0 };
  } catch { return { consecutiveLosses: 0 }; }
}

function save(st: RageState): void {
  try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* ignore */ }
}

/** Call on any defeat. Returns the new consecutive loss count. */
export function recordDefeat(): number {
  const st = load();
  st.consecutiveLosses += 1;
  save(st);
  return st.consecutiveLosses;
}

/** Call on any victory. Returns bonus crystals (equal to base if rage was active). */
export function recordVictory(baseCrystals: number): number {
  const st = load();
  const wasRage = st.consecutiveLosses >= RAGE_THRESHOLD;
  st.consecutiveLosses = 0;
  save(st);
  return wasRage ? baseCrystals : 0; // bonus = double base (full extra amount)
}

export function isActive(): boolean {
  return load().consecutiveLosses >= RAGE_THRESHOLD;
}

export function getLossCount(): number {
  return load().consecutiveLosses;
}

export const RageModeService = {
  recordDefeat,
  recordVictory,
  isActive,
  getLossCount,
  RAGE_THRESHOLD,
  RAGE_MULT,
};
