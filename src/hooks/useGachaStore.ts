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
      const outcome = GachaSystem.singlePull(state);
      if (outcome.ok) {
        setLastSingle(outcome.result);
        setLastMulti(null);
        persist(outcome.nextState);
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
      const outcome = GachaSystem.multiPull(state);
      if (outcome.ok) {
        setLastMulti(outcome.result);
        setLastSingle(null);
        persist(outcome.nextState);
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
