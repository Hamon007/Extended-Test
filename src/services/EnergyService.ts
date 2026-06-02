/**
 * EnergyService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Battle-Energie mit passiver Regeneration.
 * Regeneration: 1 Energie alle 30 Minuten bis Maximum.
 * Tägliche Komplett-Auffüllung bleibt als Bonus erhalten.
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
import { DevModeService } from './DevModeService';

export { MAX_BATTLE_ENERGY, ENERGY_PER_BATTLE, STARTING_POTIONS, POTION_RESTORE };

// Regen: 1 Energie alle 30 Minuten
const REGEN_MS = 30 * 60 * 1000;

/** Dynamisches Maximum — wächst mit dem Account-Level. */
function getMax(): number {
  try {
    return getMaxStamina(SaveService.loadAccountState().level);
  } catch {
    return MAX_BATTLE_ENERGY;
  }
}

const ENERGY_KEY = 'ci_battle_energy';

export interface EnergyState {
  energy:        number;
  potions:       number;
  lastDate:      string;   // toDateString() der letzten täglichen Auffüllung
  lastRegenTime: number;   // Unix-Timestamp der letzten Regen-Berechnung
}

function defaultState(): EnergyState {
  return {
    energy:        getMax(),
    potions:       STARTING_POTIONS,
    lastDate:      new Date().toDateString(),
    lastRegenTime: Date.now(),
  };
}

function write(st: EnergyState): void {
  try {
    localStorage.setItem(ENERGY_KEY, JSON.stringify(st));
    void SaveService.uploadSave();
  } catch (e) {
    console.warn('[EnergyService] Schreiben fehlgeschlagen:', e);
  }
}

/** Wendet passive Regen an — gibt wie viel Energie regeneriert wurde. */
function applyPassiveRegen(st: EnergyState, max: number): EnergyState {
  if (st.energy >= max) return { ...st, lastRegenTime: Date.now() };
  const now      = Date.now();
  const elapsed  = now - (st.lastRegenTime ?? now);
  const ticks    = Math.floor(elapsed / REGEN_MS);
  if (ticks <= 0) return st;
  const gained   = Math.min(ticks, max - st.energy);
  const consumed = gained * REGEN_MS;
  return {
    ...st,
    energy:        st.energy + gained,
    lastRegenTime: (st.lastRegenTime ?? now) + consumed,
  };
}

/** Lädt Energiestand, wendet Regen + tägliche Auffüllung an. */
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
      energy:        typeof parsed.energy  === 'number' ? Math.min(parsed.energy, max) : max,
      potions:       typeof parsed.potions === 'number' ? parsed.potions : 0,
      lastDate:      typeof parsed.lastDate      === 'string' ? parsed.lastDate : '',
      lastRegenTime: typeof parsed.lastRegenTime === 'number' ? parsed.lastRegenTime : Date.now(),
    };
  } catch {
    st = defaultState();
  }

  const max = getMax();

  // Tägliche Komplett-Auffüllung
  const today = new Date().toDateString();
  if (st.lastDate !== today) {
    st = { ...st, energy: max, lastDate: today, lastRegenTime: Date.now() };
    write(st);
    if (DevModeService.isEnabled()) return { ...st, energy: max, potions: 99 };
    return st;
  }

  // Passive Regen
  const regenned = applyPassiveRegen(st, max);
  if (regenned.energy !== st.energy || regenned.lastRegenTime !== st.lastRegenTime) {
    write(regenned);
    st = regenned;
  }

  if (DevModeService.isEnabled()) return { ...st, energy: max, potions: 99 };
  return st;
}

/** Millisekunden bis zum nächsten Energie-Punkt. 0 wenn bereits voll. */
function msUntilNextRegen(): number {
  const st  = load();
  const max = getMax();
  if (st.energy >= max) return 0;
  const now     = Date.now();
  const elapsed = now - st.lastRegenTime;
  return Math.max(0, REGEN_MS - elapsed);
}

/** Verbraucht Energie für einen Kampf. Gibt false zurück wenn leer. */
function consume(): boolean {
  if (DevModeService.isEnabled()) return true;
  const st = load();
  if (st.energy < ENERGY_PER_BATTLE) return false;
  const next = { ...st, energy: st.energy - ENERGY_PER_BATTLE };
  write(next);
  return true;
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
  msUntilNextRegen,
  REGEN_MS,
  MAX_BATTLE_ENERGY,
};
