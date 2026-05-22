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

// ── Level-Obergrenzen ─────────────────────────────────────────

export const LEVEL_CAP_BY_MAJOR: Record<string, number> = {
  N: 20, R: 30, SR: 40, SSR: 50, MR: 60, LR: 70,
};

// ── Kristallkarten ────────────────────────────────────────────

export const CRYSTAL_CARD_XP = {
  small:  500,
  medium: 2_000,
  large:  5_000,
} as const;

export type CrystalCardSize = keyof typeof CRYSTAL_CARD_XP;

// ── Helfer ────────────────────────────────────────────────────

export function levelCap(rarity: Rarity): number {
  return LEVEL_CAP_BY_MAJOR[rarityMajor(rarity)] ?? 20;
}

/** XP-Kosten von Level L auf L+1 */
export function xpToNext(level: number): number {
  return level * 100;
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
    atk: 1 + bonus * 0.005,  // +0,5 % je Level über 1
    def: 1 + bonus * 0.005,
    hp:  1 + bonus * 0.003,  // +0,3 % je Level über 1
  };
}

/** XP-Wert einer geopferten Karten-Instanz */
export function sacrificeXp(inst: CardInstance): number {
  const BASE: Record<string, number> = {
    N:   300,
    R:   600,
    SR:  1_200,
    SSR: 2_500,
    MR:  5_000,
    LR:  10_000,
  };
  const base     = BASE[rarityMajor(inst.rarity)] ?? 300;
  const lvlBonus = ((inst.level ?? 1) - 1) * 50;
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
