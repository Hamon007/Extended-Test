/**
 * LevelSystem.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Karten-Level-System: Aufwertung durch Opfern von Karten
 * oder Einsatz von Kristallkarten.
 * ─────────────────────────────────────────────────────────────
 */

import type { Rarity } from '../types/Card';
import { rarityMajor } from '../types/Card';
import type { CardInstance } from '../types/GachaTypes';
import {
  LEVEL_CAP_BY_MAJOR,
  CRYSTAL_CARD_XP,
  XP_PER_LEVEL_FACTOR,
  LEVEL_ATK_BONUS_PER_LV,
  LEVEL_DEF_BONUS_PER_LV,
  LEVEL_HP_BONUS_PER_LV,
  SACRIFICE_XP_BASE,
  SACRIFICE_XP_PER_LEVEL,
} from '../config/GameConfig';

export { LEVEL_CAP_BY_MAJOR, CRYSTAL_CARD_XP };

export type CrystalCardSize = keyof typeof CRYSTAL_CARD_XP;

// ── Helfer ────────────────────────────────────────────────────

export function levelCap(rarity: Rarity): number {
  return LEVEL_CAP_BY_MAJOR[rarityMajor(rarity)] ?? 20;
}

/** XP-Kosten von Level L auf L+1 */
export function xpToNext(level: number): number {
  return level * XP_PER_LEVEL_FACTOR;
}

/** Gesamt-XP um Level `target` zu erreichen (ab Level 1) */
export function totalXpForLevel(target: number): number {
  let total = 0;
  for (let l = 1; l < target; l++) total += xpToNext(l);
  return total;
}

/** Stat-Multiplikator bei gegebenem Level */
export function levelMultiplier(level: number): { atk: number; def: number; hp: number } {
  const bonus = level - 1;
  return {
    atk: 1 + bonus * LEVEL_ATK_BONUS_PER_LV,
    def: 1 + bonus * LEVEL_DEF_BONUS_PER_LV,
    hp:  1 + bonus * LEVEL_HP_BONUS_PER_LV,
  };
}

/** XP-Wert einer geopferten Karten-Instanz */
export function sacrificeXp(inst: CardInstance): number {
  const base     = SACRIFICE_XP_BASE[rarityMajor(inst.rarity)] ?? SACRIFICE_XP_BASE['N'];
  const lvlBonus = ((inst.level ?? 1) - 1) * SACRIFICE_XP_PER_LEVEL;
  return base + lvlBonus;
}

/** Wendet XP auf eine Instanz an und gibt die aktualisierte zurück. */
export function applyXp(inst: CardInstance, xpGain: number): CardInstance {
  const cap = levelCap(inst.rarity);
  let level = inst.level ?? 1;
  let xp    = (inst.xp   ?? 0) + xpGain;

  while (level < cap) {
    const needed = xpToNext(level);
    if (xp >= needed) { xp -= needed; level++; }
    else break;
  }
  if (level >= cap) xp = 0;

  return { ...inst, level, xp };
}

export const LevelSystem = {
  levelCap,
  xpToNext,
  totalXpForLevel,
  levelMultiplier,
  sacrificeXp,
  applyXp,
};
