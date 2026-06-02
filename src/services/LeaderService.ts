import type { Card, Element, Rarity } from '../types/Card';
import { rarityMajor } from '../types/Card';

export interface LeaderBonus {
  leaderId:           string;
  leaderName:         string;
  element:            Element;
  elementDamageBoost: number;   // additive multiplier (0.15 = +15%)
  comboWindowBonusMs: number;
  startMpBonus:       number;
  rarityLabel:        string;
}

const RARITY_TIER: Record<string, { dmg: number; combo: number; mp: number; label: string }> = {
  N:   { dmg: 0.05, combo:   0, mp:  0, label: 'Anführer' },
  R:   { dmg: 0.08, combo: 100, mp:  5, label: 'Anführer' },
  SR:  { dmg: 0.12, combo: 200, mp:  8, label: 'Anführer' },
  SSR: { dmg: 0.18, combo: 300, mp: 12, label: 'Heerführer' },
  MR:  { dmg: 0.25, combo: 400, mp: 18, label: 'Großmeister' },
  LR:  { dmg: 0.35, combo: 500, mp: 25, label: 'Legende' },
};

export const LeaderService = {
  computeBonus(leader: Card | undefined): LeaderBonus | null {
    if (!leader) return null;
    const tier = RARITY_TIER[rarityMajor(leader.rarity as Rarity)] ?? RARITY_TIER.N;
    return {
      leaderId:           leader.id,
      leaderName:         leader.name,
      element:            leader.element,
      elementDamageBoost: tier.dmg,
      comboWindowBonusMs: tier.combo,
      startMpBonus:       tier.mp,
      rarityLabel:        tier.label,
    };
  },

  /** Multiplikator den die Leader-Bonus auf ein Kartenspiel anwendet. */
  damageMultiplier(bonus: LeaderBonus | null, cardElement: Element | undefined): number {
    if (!bonus || !cardElement) return 1.0;
    return cardElement === bonus.element ? 1.0 + bonus.elementDamageBoost : 1.0;
  },
};
