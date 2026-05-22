/**
 * EnergyService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Tägliche Battle-Energie (Konzept §3: "5 tägliche Live-Battles",
 * Ausdauertränke). Jeder Kampf kostet 1 Energie. Die Energie füllt
 * sich täglich (lokale Gerätezeit) auf das Maximum auf.
 * Ausdauertränke stellen zusätzlich Energie wieder her.
 * Eigener localStorage-Schlüssel, unabhängig vom Gacha-State.
 * ─────────────────────────────────────────────────────────────
 */

import {
  MAX_BATTLE_ENERGY,
  ENERGY_PER_BATTLE,
  STARTING_POTIONS,
  POTION_RESTORE,
} from '../config/GameConfig';
import { getMaxStamina } from './AccountProgressionService';
import { SaveService } from './SaveService';

export { MAX_BATTLE_ENERGY, ENERGY_PER_BATTLE, STARTING_POTIONS, POTION_RESTORE };

/** Dynamisches Maximum — wächst mit dem Account-Level (min. MAX_BATTLE_ENERGY). */
function getMax(): number {
  try {
    return getMaxStamina(SaveService.loadAccountState().level);
  } catch {
    return MAX_BATTLE_ENERGY;
  }
}

const ENERGY_KEY = 'ci_battle_energy';

export interface EnergyState {
  energy:   number;
  potions:  number;
  lastDate: string;  // toDateString() der letzten täglichen Auffüllung
}

function defaultState(): EnergyState {
  return {
    energy:   getMax(),
    potions:  STARTING_POTIONS,
    lastDate: new Date().toDateString(),
  };
}

function write(st: EnergyState): void {
  try {
    localStorage.setItem(ENERGY_KEY, JSON.stringify(st));
  } catch (e) {
    console.warn('[EnergyService] Schreiben fehlgeschlagen:', e);
  }
}

/** Lädt den Energiestand und füllt bei neuem Kalendertag auf. */
function load(): EnergyState {
  let st: EnergyState;
  try {
    const raw = localStorage.getItem(ENERGY_KEY);
    if (!raw) {
      const fresh = defaultState();
      write(fresh);
      return fresh;
    }
    const parsed = JSON.parse(raw) as Partial<EnergyState>;
    const max = getMax();
    st = {
      energy:   typeof parsed.energy  === 'number' ? Math.min(parsed.energy, max) : max,
      potions:  typeof parsed.potions === 'number' ? parsed.potions : 0,
      lastDate: typeof parsed.lastDate === 'string' ? parsed.lastDate : '',
    };
  } catch (e) {
    console.warn('[EnergyService] Lesen fehlgeschlagen:', e);
    st = defaultState();
  }

  // Tägliche Auffüllung
  const today = new Date().toDateString();
  if (st.lastDate !== today) {
    st = { ...st, energy: getMax(), lastDate: today };
    write(st);
  }
  return st;
}

/** Verbraucht Energie für einen Kampf. Gibt neuen State zurück oder null wenn leer. */
function consume(): EnergyState | null {
  const st = load();
  if (st.energy < ENERGY_PER_BATTLE) return null;
  const next = { ...st, energy: st.energy - ENERGY_PER_BATTLE };
  write(next);
  return next;
}

/** Nutzt einen Ausdauertrank: +POTION_RESTORE Energie (bis Maximum). */
function usePotion(): EnergyState {
  const st  = load();
  const max = getMax();
  if (st.potions <= 0 || st.energy >= max) return st;
  const next = {
    ...st,
    potions: st.potions - 1,
    energy:  Math.min(max, st.energy + POTION_RESTORE),
  };
  write(next);
  return next;
}

/** Fügt Ausdauertränke hinzu (z.B. als Battle-Belohnung). */
function addPotions(n: number): EnergyState {
  const st = load();
  const next = { ...st, potions: st.potions + n };
  write(next);
  return next;
}

export const EnergyService = {
  load,
  consume,
  usePotion,
  addPotions,
  getMax,
  MAX_BATTLE_ENERGY,
};
