import type { Card, Rarity } from '../types/Card';
import { rarityMajor } from '../types/Card';

export interface AwakeningCondition {
  comboMin?:        number;
  playerHpBelowPct?: number;
  enemyHpBelowPct?:  number;
  description:      string;
}

export interface AwakeningProfile {
  threshold:    AwakeningCondition;
  damageBoost:  number;   // additive (0.25 = +25%)
  flavorText:   string;   // "Azazel ERWACHT!"
}

/** Returns the awakening profile for a card based on its rarity. SR and below never awaken. */
export function getAwakeningProfile(card: Card | undefined): AwakeningProfile | null {
  if (!card) return null;
  const major = rarityMajor(card.rarity as Rarity);

  switch (major) {
    case 'SR':
      return {
        threshold:   { comboMin: 4, description: '4er-Kombo' },
        damageBoost: 0.25,
        flavorText:  `${card.name} ERWACHT!`,
      };
    case 'SSR':
      return {
        threshold:   { comboMin: 3, playerHpBelowPct: 0.5, description: '3er-Kombo oder HP < 50%' },
        damageBoost: 0.35,
        flavorText:  `${card.name} ENTFESSELT!`,
      };
    case 'MR':
      return {
        threshold:   { comboMin: 2, playerHpBelowPct: 0.6, enemyHpBelowPct: 0.5, description: '2er-Kombo, HP < 60% oder Gegner < 50%' },
        damageBoost: 0.5,
        flavorText:  `${card.name} ENTFLAMMT!`,
      };
    case 'LR':
      return {
        threshold:   { description: 'Permanent erwacht' },
        damageBoost: 0.65,
        flavorText:  `${card.name} STRAHLT!`,
      };
    default:
      return null;
  }
}

export interface AwakeningCheckContext {
  comboCount:    number;
  playerHpPct:   number;   // 0–1
  enemyHpPct:    number;   // 0–1
}

export function checkAwakened(
  card: Card | undefined,
  ctx: AwakeningCheckContext,
): boolean {
  const profile = getAwakeningProfile(card);
  if (!profile) return false;
  // LR cards always count as awakened
  if ((rarityMajor((card!.rarity) as Rarity)) === 'LR') return true;

  const t = profile.threshold;
  if (t.comboMin && ctx.comboCount >= t.comboMin)         return true;
  if (t.playerHpBelowPct && ctx.playerHpPct < t.playerHpBelowPct) return true;
  if (t.enemyHpBelowPct  && ctx.enemyHpPct  < t.enemyHpBelowPct)  return true;
  return false;
}

export const AwakeningService = {
  getAwakeningProfile,
  checkAwakened,
};
