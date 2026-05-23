// ─────────────────────────────────────────────────────────────────────────────
// useTacticalStore.ts  –  Codex Immortalis
// React-Hook: Taktische Schicht über useBattleStore
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react';
import { useBattleStore } from './useBattleStore';
import { TacticalBattleManager } from '../services/TacticalBattleManager';
import type { TacticalBattleState, TacticalEnemyConfig } from '../types/TacticalBattleTypes';
import type { BattleCard } from '../types/BattleTypes';
import type { Element } from '../types/Card';

export function useTacticalStore(config: TacticalEnemyConfig | null) {
  const battle = useBattleStore();
  const [tactical, setTactical] = useState<TacticalBattleState | null>(
    config ? TacticalBattleManager.initTacticalState(config) : null,
  );
  const [guardActive,  setGuardActive]  = useState(false);
  const [focusActive,  setFocusActive]  = useState(false);
  const [cleanseUsed,  setCleanseUsed]  = useState(0);

  const playTacticalCard = useCallback(
    (card: BattleCard, comboCount: number) => {
      if (!tactical) {
        battle.playCard(card.instanceId, 1.0);
        return;
      }
      const mods = TacticalBattleManager.tacticalCardModifiers(card, tactical, comboCount);
      const focusBonus = focusActive ? 2 : 0;

      // Update tactical state
      setTactical(prev => {
        if (!prev) return prev;
        let next = { ...prev };
        // Apply break
        next.breakState = TacticalBattleManager.applyBreak(
          next.breakState,
          mods.breakGain + focusBonus,
        );
        // Track break bonus goal
        if (next.breakState.isBroken) {
          next.bonusGoals = next.bonusGoals.map(g =>
            g.id === 'break_triggered' ? { ...g, achieved: true } : g,
          );
        }
        // Apply heat
        if (next.heat.active) {
          next.heat = { ...next.heat, current: next.heat.current + mods.heatGain };
        }
        // Track elements for mirror/antirepeat
        const el = card.card?.element;
        if (el) next.lastElements = [...next.lastElements.slice(-4), el as Element];
        // Bonus goal: 3 different elements
        const elements = new Set(next.lastElements);
        if (elements.size >= 3) {
          next.bonusGoals = next.bonusGoals.map(g =>
            g.id === 'three_elements' ? { ...g, achieved: true } : g,
          );
        }
        return next;
      });

      setFocusActive(false);
      battle.playCard(card.instanceId, mods.damageMultiplier);
    },
    [battle, tactical, focusActive],
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
    battle,
    tactical,
    guardActive,
    focusActive,
    cleanseUsed,
    playTacticalCard,
    useGuard,
    useFocus,
    useCleanse,
    endTurn: battle.endTurn,
    isEnemyActing: battle.isEnemyActing,
  };
}
