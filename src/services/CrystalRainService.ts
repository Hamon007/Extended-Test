/**
 * CrystalRainService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Rare surprise bonus: 10% chance of a "Crystal Rain" event
 * on any battle victory, awarding 50-200 bonus crystals.
 * The unpredictable reward creates variable-ratio reinforcement —
 * the strongest driver of habitual play.
 * ─────────────────────────────────────────────────────────────
 */

const TRIGGER_CHANCE = 0.10;  // 10% per victory
const MIN_CRYSTALS   = 50;
const MAX_CRYSTALS   = 200;

/** Roll for crystal rain. Returns bonus amount (>0) or 0 if no rain. */
function roll(): number {
  if (Math.random() >= TRIGGER_CHANCE) return 0;
  return Math.floor(Math.random() * (MAX_CRYSTALS - MIN_CRYSTALS + 1)) + MIN_CRYSTALS;
}

export const CrystalRainService = { roll };
