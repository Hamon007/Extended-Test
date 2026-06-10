/**
 * useFusionStore.ts
 * ─────────────────────────────────────────────────────────────
 * React-Hook für Fusion UND True Awakening. Lädt den Gacha-State
 * (Inventar + Kristalle) aus dem SaveService, führt Fusionen
 * bzw. Awakenings durch und persistiert das Ergebnis.
 * ─────────────────────────────────────────────────────────────
 */

import { useState, useCallback, useMemo } from 'react';
import type { Rarity } from '../types/Card';
import type { GachaState } from '../types/GachaTypes';
import { SaveService } from '../services/SaveService';
import { CardDatabase } from '../services/CardDatabase';
import { FusionSystem, type FusionGroup, type FusionError } from '../services/FusionSystem';
import { AwakeningSystem, type AwakenError } from '../services/AwakeningSystem';
import { ActivityFeedService } from '../services/ActivityFeedService';
import { AchievementService } from '../services/AchievementService';

export interface LastFusion {
  cardId: string;
  from:   Rarity;
  to:     Rarity;
}

export interface LastAwakening {
  fromName: string;
  toName:   string;
}

export interface FusionStore {
  state:         GachaState;
  groups:        FusionGroup[];
  lastFusion:    LastFusion | null;
  lastAwakening: LastAwakening | null;
  error:         FusionError | AwakenError | null;
  fuse:          (cardId: string) => void;
  fuseAll:       () => number;
  awaken:        (uuid: string) => void;
  clearLast:     () => void;
}

export function useFusionStore(): FusionStore {
  const [state, setState]                 = useState<GachaState>(() => SaveService.loadGachaState());
  const [lastFusion, setLastFusion]       = useState<LastFusion | null>(null);
  const [lastAwakening, setLastAwakening] = useState<LastAwakening | null>(null);
  const [error, setError]                 = useState<FusionError | AwakenError | null>(null);

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
    AchievementService.recordProgress('first_fusion');
    if (outcome.toRarity === 'LR') {
      AchievementService.recordProgress('first_lr');
      const card = CardDatabase.getById(cardId);
      ActivityFeedService.post('fusion_lr', { cardName: card?.name ?? cardId });
    }
  }, [state]);

  const fuseAll = useCallback((): number => {
    setError(null);
    let cur = state;
    let count = 0;
    let last: LastFusion | null = null;
    for (;;) {
      const readyGroups = FusionSystem.buildGroups(cur.inventory).filter(g => g.canFuse);
      if (readyGroups.length === 0) break;
      for (const g of readyGroups) {
        const outcome = FusionSystem.fuse(cur, g.cardId);
        if (!outcome.ok) continue;
        cur = outcome.nextState;
        last = { cardId: g.cardId, from: outcome.fromRarity, to: outcome.toRarity };
        count++;
        AchievementService.recordProgress('first_fusion');
        if (outcome.toRarity === 'LR') {
          AchievementService.recordProgress('first_lr');
          const card = CardDatabase.getById(g.cardId);
          ActivityFeedService.post('fusion_lr', { cardName: card?.name ?? g.cardId });
        }
      }
    }
    if (count > 0) {
      SaveService.saveGachaState(cur);
      setState(cur);
      if (last) setLastFusion(last);
    }
    return count;
  }, [state]);

  const awaken = useCallback((uuid: string) => {
    setError(null);
    const outcome = AwakeningSystem.awaken(state, uuid);
    if (!outcome.ok) {
      setError(outcome.error);
      return;
    }
    SaveService.saveGachaState(outcome.nextState);
    setState(outcome.nextState);
    setLastAwakening({ fromName: outcome.fromName, toName: outcome.awakenedCard.name });
    AchievementService.recordProgress('first_awakening');
    ActivityFeedService.post('awaken', { fromName: outcome.fromName, toName: outcome.awakenedCard.name });
  }, [state]);

  const clearLast = useCallback(() => {
    setLastFusion(null);
    setLastAwakening(null);
  }, []);

  return { state, groups, lastFusion, lastAwakening, error, fuse, fuseAll, awaken, clearLast };
}
