/**
 * useEnergyStore.ts
 * ─────────────────────────────────────────────────────────────
 * React-Hook für die Battle-Energie. Lädt den Energiestand,
 * verbraucht Energie pro Kampf und verwaltet Ausdauertränke.
 * ─────────────────────────────────────────────────────────────
 */

import { useState, useCallback } from 'react';
import { EnergyService, type EnergyState, MAX_BATTLE_ENERGY } from '../services/EnergyService';

export interface EnergyStore extends EnergyState {
  max:       number;
  consume:   () => boolean;   // true wenn Energie verbraucht wurde
  usePotion: () => void;
  refresh:   () => void;
}

export function useEnergyStore(): EnergyStore {
  const [state, setState] = useState<EnergyState>(() => EnergyService.load());

  const consume = useCallback(() => {
    const next = EnergyService.consume();
    if (next) {
      setState(next);
      return true;
    }
    return false;
  }, []);

  const usePotion = useCallback(() => {
    setState(EnergyService.usePotion());
  }, []);

  const refresh = useCallback(() => {
    setState(EnergyService.load());
  }, []);

  return { ...state, max: MAX_BATTLE_ENERGY, consume, usePotion, refresh };
}
