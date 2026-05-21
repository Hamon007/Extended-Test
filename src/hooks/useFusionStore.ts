/**
 * useFusionStore.ts
 * ─────────────────────────────────────────────────────────────
 * React-Hook für das Fusions-System. Lädt den Gacha-State
 * (Inventar + Kristalle) aus dem SaveService, führt Fusionen
 * durch und persistiert das Ergebnis.
 * ─────────────────────────────────────────────────────────────
 */

import { useState, useCallback, useMemo } from 'react';
import type { Rarity } from '../types/Card';
import type { GachaState } from '../types/GachaTypes';
import { SaveService } from '../services/SaveService';
import { FusionSystem, type FusionGroup, type FusionError } from '../services/FusionSystem';

export interface LastFusion {
  cardId: string;
  from:   Rarity;
  to:     Rarity;
}

export interface FusionStore {
  state:     GachaState;
  groups:    FusionGroup[];
  lastFusion: LastFusion | null;
  error:     FusionError | null;
  fuse:      (cardId: string) => void;
  clearLast: () => void;
}

export function useFusionStore(): FusionStore {
  const [state, setState]           = useState<GachaState>(() => SaveService.loadGachaState());
  const [lastFusion, setLastFusion] = useState<LastFusion | null>(null);
  const [error, setError]           = useState<FusionError | null>(null);

  const groups = useMemo(() => FusionSystem.buildGroups(state.inventory), [state.inventory]);

  const fuse = useCallback((cardId: string) => {
    setError(null);
    const outcome = FusionSystem.fuse(state, cardId);
    if (!outcome.ok) {
      setError(outcome.error);
      return;
    }
    SaveService.saveGachaState(outcome.nextState);
    setState(outcome.nextState);
    setLastFusion({ cardId, from: outcome.fromRarity, to: outcome.toRarity });
  }, [state]);

  const clearLast = useCallback(() => setLastFusion(null), []);

  return { state, groups, lastFusion, error, fuse, clearLast };
}
