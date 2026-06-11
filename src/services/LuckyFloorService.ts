/**
 * LuckyFloorService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Every UTC day, 3 "Lucky Floors" are seeded in the tower.
 * Clearing a lucky floor awards +30% bonus crystals.
 * The floors are distributed across low/mid/high ranges so all
 * players — regardless of progress — always have one nearby.
 * ─────────────────────────────────────────────────────────────
 */

export const LUCKY_FLOOR_BONUS = 0.30; // +30% crystals
const FLOOR_MAX = 100;

function todayHash(): number {
  const d = new Date();
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

function seeded(seed: number): number {
  let s = seed;
  s ^= s << 13; s ^= s >> 17; s ^= s << 5;
  return ((s >>> 0) / 0xFFFFFFFF);
}

/**
 * Returns today's 3 lucky floors, one from each tier:
 *  - floors 1-30   (early game)
 *  - floors 31-65  (mid game)
 *  - floors 66-100 (late game)
 */
function getLuckyFloors(): [number, number, number] {
  const h = todayHash();
  const f1 = 1  + Math.round(seeded(h * 17 + 1) * 29);        // 1-30
  const f2 = 31 + Math.round(seeded(h * 31 + 2) * 34);        // 31-65
  const f3 = 66 + Math.round(seeded(h * 53 + 3) * (FLOOR_MAX - 66)); // 66-100
  return [f1, f2, f3];
}

function isLucky(floor: number): boolean {
  return getLuckyFloors().includes(floor);
}

export const LuckyFloorService = {
  getLuckyFloors,
  isLucky,
  LUCKY_FLOOR_BONUS,
};
