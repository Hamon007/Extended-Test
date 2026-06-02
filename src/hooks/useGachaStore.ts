/**
 * useGachaStore.ts
 * ─────────────────────────────────────────────────────────────
 * React-Hook der GachaState, SaveService und GachaSystem
 * zusammenbringt. Kein globaler State-Manager nötig.
 * ─────────────────────────────────────────────────────────────
 */

import { useState, useCallback } from 'react';
import type { GachaState, PullResult, MultiPullResult } from '../types/GachaTypes';
import { GachaSystem, type PullError } from '../services/GachaSystem';
import { SaveService } from '../services/SaveService';
import { CardDatabase } from '../services/CardDatabase';
import { ActivityFeedService } from '../services/ActivityFeedService';
import { AchievementService } from '../services/AchievementService';

export interface GachaStore {
  state:       GachaState;
  lastSingle:  PullResult | null;
  lastMulti:   MultiPullResult | null;
  error:       PullError | null;
  isPulling:   boolean;
  doSingle:    () => void;
  doMulti:     () => void;
  clearResults:() => void;
  debugReset:  () => void;
}

export function useGachaStore(): GachaStore {
  const [state,      setState]      = useState<GachaState>(() => SaveService.loadGachaState());
  const [lastSingle, setLastSingle] = useState<PullResult | null>(null);
  const [lastMulti,  setLastMulti]  = useState<MultiPullResult | null>(null);
  const [error,      setError]      = useState<PullError | null>(null);
  const [isPulling,  setIsPulling]  = useState(false);

  const persist = useCallback((next: GachaState) => {
    setState(next);
    SaveService.saveGachaState(next);
  }, []);

  const doSingle = useCallback(() => {
    if (isPulling) return;
    setIsPulling(true);
    setError(null);

    // Kurzes Delay für UX-Feedback
    setTimeout(() => {
      const prevInventory = state.inventory;
      const prevCardIds = new Set(prevInventory.map(i => i.cardId));
      const outcome = GachaSystem.singlePull(state);
      if (outcome.ok) {
        const instance = outcome.result.instance;
        instance.isNew = !prevCardIds.has(instance.cardId);
        setLastSingle({ ...outcome.result, instance });
        setLastMulti(null);
        persist(outcome.nextState);
        // Achievements
        if (instance.rarity === 'SSR' || instance.rarity === 'MR') {
          AchievementService.recordProgress('first_ssr');
          const card = CardDatabase.getById(instance.cardId);
          ActivityFeedService.post(instance.rarity === 'MR' ? 'pull_mr' : 'pull_ssr', { cardName: card?.name ?? instance.cardId });
        }
        if (instance.rarity === 'LR') AchievementService.recordProgress('first_lr');
        // Card collection achievements
        const totalCards = outcome.nextState.inventory.length;
        if (totalCards >= 20) AchievementService.recordProgress('cards_20');
        if (totalCards >= 50) AchievementService.recordProgress('cards_50');
      } else {
        setError(outcome.error);
      }
      setIsPulling(false);
    }, 300);
  }, [state, isPulling, persist]);

  const doMulti = useCallback(() => {
    if (isPulling) return;
    setIsPulling(true);
    setError(null);

    setTimeout(() => {
      const prevInventory = state.inventory;
      const prevCardIds = new Set(prevInventory.map(i => i.cardId));
      const outcome = GachaSystem.multiPull(state);
      if (outcome.ok) {
        const seenInBatch = new Set<string>();
        const updatedResults = outcome.result.results.map(pr => {
          const isNew = !prevCardIds.has(pr.instance.cardId) && !seenInBatch.has(pr.instance.cardId);
          seenInBatch.add(pr.instance.cardId);
          return { ...pr, instance: { ...pr.instance, isNew } };
        });
        setLastMulti({ ...outcome.result, results: updatedResults });
        setLastSingle(null);
        persist(outcome.nextState);
        for (const r of updatedResults) {
          if (r.instance.rarity === 'SSR' || r.instance.rarity === 'MR') {
            AchievementService.recordProgress('first_ssr');
            const card = CardDatabase.getById(r.instance.cardId);
            ActivityFeedService.post(r.instance.rarity === 'MR' ? 'pull_mr' : 'pull_ssr', { cardName: card?.name ?? r.instance.cardId });
          }
          if (r.instance.rarity === 'LR') AchievementService.recordProgress('first_lr');
        }
        const totalCards = outcome.nextState.inventory.length;
        if (totalCards >= 20) AchievementService.recordProgress('cards_20');
        if (totalCards >= 50) AchievementService.recordProgress('cards_50');
      } else {
        setError(outcome.error);
      }
      setIsPulling(false);
    }, 300);
  }, [state, isPulling, persist]);

  const clearResults = useCallback(() => {
    setLastSingle(null);
    setLastMulti(null);
    setError(null);
  }, []);

  const debugReset = useCallback(() => {
    SaveService.resetAll();
    const fresh = SaveService.loadGachaState();
    setState(fresh);
    setLastSingle(null);
    setLastMulti(null);
    setError(null);
  }, []);

  return {
    state, lastSingle, lastMulti,
    error, isPulling,
    doSingle, doMulti, clearResults, debugReset,
  };
}
