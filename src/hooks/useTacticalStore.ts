// ─────────────────────────────────────────────────────────────────────────────
// useTacticalStore.ts  –  Codex Immortalis
// React-Hook: Taktische Schicht über useBattleStore
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react';
import { TacticalBattleManager } from '../services/TacticalBattleManager';
import type { TacticalBattleState, TacticalEnemyConfig } from '../types/TacticalBattleTypes';
import type { BattleCard } from '../types/BattleTypes';
import type { Element } from '../types/Card';

export function useTacticalStore(config: TacticalEnemyConfig | null) {
  const [tactical, setTactical] = useState<TacticalBattleState | null>(
    config ? TacticalBattleManager.initTacticalState(config) : null,
  );
  const [guardActive,  setGuardActive]  = useState(false);
  const [focusActive,  setFocusActive]  = useState(false);
  const [cleanseUsed,  setCleanseUsed]  = useState(0);

  // Returns the damage multiplier and updates tactical state; does NOT call battle.playCard.
  const playTacticalCard = useCallback(
    (card: BattleCard, comboCount: number): number => {
      if (!tactical) return 1.0;

      const mods = TacticalBattleManager.tacticalCardModifiers(card, tactical, comboCount);
      const focusBonus = focusActive ? 2 : 0;

      setTactical(prev => {
        if (!prev) return prev;
        let next = { ...prev };
        next.breakState = TacticalBattleManager.applyBreak(
          next.breakState,
          mods.breakGain + focusBonus,
        );
        if (next.breakState.isBroken) {
          next.bonusGoals = next.bonusGoals.map(g =>
            g.id === 'break_triggered' ? { ...g, achieved: true } : g,
          );
        }
        if (next.heat.active) {
          next.heat = { ...next.heat, current: next.heat.current + mods.heatGain };
        }
        const el = card.card?.element;
        if (el) next.lastElements = [...next.lastElements.slice(-4), el as Element];
        const elements = new Set(next.lastElements);
        if (elements.size >= 3) {
          next.bonusGoals = next.bonusGoals.map(g =>
            g.id === 'three_elements' ? { ...g, achieved: true } : g,
          );
        }
        return next;
      });

      setFocusActive(false);
      return mods.damageMultiplier;
    },
    [tactical, focusActive],
  );

  const useGuard = useCallback(() => {
    setGuardActive(true);
  }, []);

  const useFocus = useCallback(() => {
    setFocusActive(true);
  }, []);

  const useCleanse = useCallback(() => {
    if (cleanseUsed >= 2) return;
    setCleanseUsed(n => n + 1);
    setTactical(prev => (prev ? { ...prev, cursedCardIds: [] } : prev));
  }, [cleanseUsed]);

  return {
    tactical,
    guardActive,
    focusActive,
    cleanseUsed,
    playTacticalCard,
    useGuard,
    useFocus,
    useCleanse,
  };
}
