/**
 * useEnergyStore.ts
 * ─────────────────────────────────────────────────────────────
 * React-Hook für die Battle-Energie. Lädt den Energiestand,
 * verbraucht Energie pro Kampf und verwaltet Ausdauertränke.
 * ─────────────────────────────────────────────────────────────
 */

import { useState, useCallback } from 'react';
import { EnergyService, type EnergyState } from '../services/EnergyService';

export interface EnergyStore extends EnergyState {
  max:       number;
  consume:   () => boolean;   // true wenn Energie verbraucht wurde
  usePotion: () => void;
  refresh:   () => void;
}

export function useEnergyStore(): EnergyStore {
  const [state, setState] = useState<EnergyState>(() => EnergyService.load());
  const [max,   setMax]   = useState<number>(() => EnergyService.getMax());

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
    setMax(EnergyService.getMax()); // aktualisiert max nach Level-Up
  }, []);

  return { ...state, max, consume, usePotion, refresh };
}
