// ─────────────────────────────────────────────────────────────────────────────
// TacticalBattleManager.ts  –  Codex Immortalis
// Taktische Modifikatoren auf BattleManager aufgesetzt
// ─────────────────────────────────────────────────────────────────────────────

import type { BattleCard } from '../types/BattleTypes';
import type {
  TacticalBattleState,
  TacticalEnemyConfig,
  BreakState,
  RarityHeatState,
  ElementStanceState,
} from '../types/TacticalBattleTypes';
import type { Rarity, Element } from '../types/Card';
import { rarityMajor } from '../types/Card';

const RARITY_HEAT: Record<string, number> = { N: 0, R: 1, SR: 2, SSR: 3, MR: 5, LR: 8 };

function getHeat(rarity: Rarity): number {
  return RARITY_HEAT[rarityMajor(rarity)] ?? 0;
}

function getBreakBonus(
  card: BattleCard,
  stance: ElementStanceState | null,
  comboCount: number,
): number {
  let bonus = 0;
  const rarity = rarityMajor((card.card?.rarity ?? 'N') as Rarity);
  // N/R cards give +1 break
  if (rarity === 'N' || rarity === 'R') bonus += 1;
  // Combo 3+ gives +2 break
  if (comboCount >= 3) bonus += 2;
  // Element matching stance weakness
  if (stance && card.card?.element) {
    const el = card.card.element as Element;
    if (stance.weakTo.includes(el)) bonus += 3;
    else if (el !== stance.current) bonus += 1;
  }
  return Math.max(1, bonus);
}

/** Apply tactical modifiers to player card play. Returns damageMultiplier, breakGain, heatGain */
export function tacticalCardModifiers(
  card: BattleCard,
  tacticalState: TacticalBattleState,
  comboCount: number,
): { damageMultiplier: number; breakGain: number; heatGain: number; isCursed: boolean } {
  const isCursed = tacticalState.cursedCardIds.includes(card.instanceId);

  // Damage multiplier: reduced by shield unless broken
  let damageMultiplier = 1.0;
  if (!tacticalState.breakState.isBroken) {
    damageMultiplier =
      1.0 -
      (tacticalState.enemyType === 'boss'
        ? 0.55
        : tacticalState.enemyType === 'elite'
          ? 0.4
          : 0.1);
  } else {
    damageMultiplier = 1.5; // bonus damage during break window
  }

  const breakGain = getBreakBonus(card, tacticalState.stance, comboCount);
  const rarity = (card.card?.rarity ?? 'N') as Rarity;
  let heatGain = getHeat(rarity);

  // Aether-Fresser: double heat for high rarities
  if (tacticalState.mechanic === 'rarityHeat') {
    const major = rarityMajor(rarity);
    if (major === 'SSR' || major === 'MR' || major === 'LR') heatGain *= 2;
  }

  return { damageMultiplier, breakGain, heatGain, isCursed };
}

/** Update break state after gaining break points */
export function applyBreak(breakState: BreakState, gain: number): BreakState {
  const newCurrent = breakState.current + gain;
  if (!breakState.isBroken && newCurrent >= breakState.max) {
    return { ...breakState, current: breakState.max, isBroken: true, brokenRoundsLeft: 2 };
  }
  return { ...breakState, current: Math.min(breakState.max, newCurrent) };
}

/** Tick break state at round end */
export function tickBreakState(breakState: BreakState): BreakState {
  if (!breakState.isBroken) return breakState;
  const left = breakState.brokenRoundsLeft - 1;
  if (left <= 0) return { ...breakState, current: 0, isBroken: false, brokenRoundsLeft: 0 };
  return { ...breakState, brokenRoundsLeft: left };
}

/** Apply heat punishment */
export function applyHeatPunish(
  heat: RarityHeatState,
): { heat: RarityHeatState; manaLoss: number } {
  if (heat.current < heat.threshold) return { heat, manaLoss: 0 };
  return { heat: { ...heat, current: 0 }, manaLoss: 20 };
}

/** Build initial TacticalBattleState from config */
export function initTacticalState(config: TacticalEnemyConfig): TacticalBattleState {
  const firstStance = config.stances[0] ?? null;
  return {
    enemyType: config.enemyType,
    mechanic: config.mechanic,
    breakState: { current: 0, max: config.breakMax, isBroken: false, brokenRoundsLeft: 0 },
    heat: { current: 0, threshold: config.heatThreshold, active: config.mechanic === 'rarityHeat' },
    stance: {
      current: firstStance,
      resistsOwn: true,
      weakTo: getStanceWeakness(firstStance),
      roundsLeft: config.stanceChangeInterval,
    },
    seal: { sealedRarity: null, roundsLeft: 0 },
    intent: config.intentSchedule[0] ?? null,
    phase: 1,
    addCount: 0,
    bloodMarks: 0,
    lastElements: [],
    lastRarities: [],
    repeatCount: 0,
    cursedCardIds: [],
    bonusGoals: [
      { id: 'break_triggered', label: 'Break ausgelöst', achieved: false },
      { id: 'three_elements', label: '3 verschiedene Elemente gespielt', achieved: false },
      { id: 'no_heat_explosion', label: 'Keine Hitze-Explosion', achieved: false },
      { id: 'boss_killed_in_break', label: 'Boss im Break-Fenster besiegt', achieved: false },
      { id: 'low_rarity_used', label: 'Mindestens 2 N/R/SR gespielt', achieved: false },
    ],
  };
}

function getStanceWeakness(stance: Element | null): Element[] {
  if (!stance) return [];
  const weakMap: Partial<Record<Element, Element[]>> = {
    fire:      ['water', 'earth', 'ice'],
    water:     ['lightning', 'earth'],
    earth:     ['water', 'wind', 'ice'],
    lightning: ['earth', 'water'],
    wind:      ['earth', 'lightning'],
    ice:       ['fire', 'lightning'],
    light:     ['dark', 'void'],
    dark:      ['light', 'fire'],
    void:      ['light', 'chaos'],
    death:     ['light', 'fire'],
    chaos:     ['void', 'dark'],
  };
  return weakMap[stance] ?? [];
}

/** Rotate stance at end of round */
export function rotateStance(
  stance: ElementStanceState,
  stances: Element[],
  interval: number,
): ElementStanceState {
  if (stances.length <= 1) return stance;
  const left = stance.roundsLeft - 1;
  if (left > 0) return { ...stance, roundsLeft: left };
  const currentIdx = stances.indexOf(stance.current as Element);
  const nextIdx = (currentIdx + 1) % stances.length;
  const next = stances[nextIdx];
  return {
    current: next,
    resistsOwn: true,
    weakTo: getStanceWeakness(next),
    roundsLeft: interval,
  };
}

export const TacticalBattleManager = {
  initTacticalState,
  tacticalCardModifiers,
  applyBreak,
  tickBreakState,
  applyHeatPunish,
  rotateStance,
  getHeat,
};
