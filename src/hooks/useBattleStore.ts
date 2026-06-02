/**
 * useBattleStore.ts
 * ─────────────────────────────────────────────────────────────
 * React-Hook: verwaltet BattleState und steuert den Ablauf.
 * Gegner-Zug läuft mit kurzer Verzögerung für UX-Feedback.
 * ─────────────────────────────────────────────────────────────
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { BattleState } from '../types/BattleTypes';
import type { EnemyData } from '../types/BattleTypes';
import type { CardInstance } from '../types/GachaTypes';
import { BattleManager, type BattleMeta } from '../services/BattleManager';
import { ENEMY_TURN_DELAY_MS, ROUND_END_DELAY_MS } from '../config/GameConfig';

export interface BattleStore {
  state:          BattleState | null;
  isEnemyActing:  boolean;
  startBattle:    (instances: CardInstance[], enemy: EnemyData, meta?: BattleMeta) => void;
  playCard:       (instanceId: string, damageMultiplier?: number, comboCount?: number) => void;
  endTurn:        () => void;
  guard:          () => void;
  resetBattle:    () => void;
}

export function useBattleStore(): BattleStore {
  const [state,         setState]         = useState<BattleState | null>(null);
  const [isEnemyActing, setIsEnemyActing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Aufräumen bei Unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  // Automatisch Gegner-Zug und Rundenende abarbeiten
  useEffect(() => {
    if (!state) return;

    if (state.phase === 'enemy_turn') {
      setIsEnemyActing(true);
      timerRef.current = setTimeout(() => {
        setState(prev => prev ? BattleManager.runEnemyTurn(prev) : null);
      }, ENEMY_TURN_DELAY_MS);
    }

    if (state.phase === 'round_end') {
      timerRef.current = setTimeout(() => {
        setState(prev => prev ? BattleManager.resolveRoundEnd(prev) : null);
        setIsEnemyActing(false);
      }, ROUND_END_DELAY_MS);
    }

    if (state.phase === 'player_turn' || state.phase === 'ended') {
      setIsEnemyActing(false);
    }
  }, [state?.phase, state?.round]); // eslint-disable-line react-hooks/exhaustive-deps

  const startBattle = useCallback((instances: CardInstance[], enemy: EnemyData, meta?: BattleMeta) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setState(BattleManager.initBattle(instances, enemy, meta));
    setIsEnemyActing(false);
  }, []);

  const playCard = useCallback((instanceId: string, damageMultiplier = 1.0, comboCount = 1) => {
    setState(prev => prev ? BattleManager.playPlayerCard(prev, instanceId, damageMultiplier, comboCount) : null);
  }, []);

  const endTurn = useCallback(() => {
    setState(prev => prev ? BattleManager.endPlayerTurn(prev) : null);
  }, []);

  const guard = useCallback(() => {
    setState(prev => prev ? BattleManager.guardAndEndTurn(prev) : null);
  }, []);

  const resetBattle = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setState(null);
    setIsEnemyActing(false);
  }, []);

  return { state, isEnemyActing, startBattle, playCard, endTurn, guard, resetBattle };
}
