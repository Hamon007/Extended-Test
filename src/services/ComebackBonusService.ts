/**
 * ComebackBonusService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * If the player has been away for ≥ 24 hours, the next
 * COMEBACK_BATTLES victories earn +25% bonus crystals.
 * Resets automatically after the streak is consumed or when
 * the player returns without a long absence.
 *
 * Uses the same 'ci_last_active' key as OfflineIncomeService.
 * ComebackBonusService does NOT update that key — OfflineIncome
 * does it on claim(), so order of calls matters: always call
 * OfflineIncomeService.claim() before this one on app start.
 * ─────────────────────────────────────────────────────────────
 */

import { SaveService } from './SaveService';

const ABSENCE_THRESHOLD_H = 24;
const COMEBACK_BATTLES    = 3;
export const COMEBACK_BONUS = 0.25;   // +25% crystals

const STATE_KEY     = 'ci_comeback';
const LAST_ACTIVE_KEY = 'ci_last_active';

interface ComebackState {
  active:       boolean;
  remaining:    number;  // battles remaining with bonus
}

function load(): ComebackState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    return raw ? (JSON.parse(raw) as ComebackState) : { active: false, remaining: 0 };
  } catch { return { active: false, remaining: 0 }; }
}

function save(st: ComebackState): void {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(st)); } catch { /* ignore */ }
}

export const ComebackBonusService = {
  /** Call on app start (after OfflineIncomeService). Activates comeback if absent ≥ 24h. */
  checkOnStart(): boolean {
    const raw = localStorage.getItem(LAST_ACTIVE_KEY);
    if (!raw) return false;
    const hoursAway = (Date.now() - parseInt(raw, 10)) / 3_600_000;
    if (hoursAway < ABSENCE_THRESHOLD_H) return false;

    const st = load();
    if (st.active && st.remaining > 0) return true; // already active

    save({ active: true, remaining: COMEBACK_BATTLES });
    return true;
  },

  isActive(): boolean {
    const st = load();
    return st.active && st.remaining > 0;
  },

  getRemaining(): number {
    return load().remaining;
  },

  /** Apply bonus crystals on a victory. Returns bonus amount, or 0 if not active. */
  applyVictory(baseCrystals: number): number {
    const st = load();
    if (!st.active || st.remaining <= 0) return 0;

    const bonus = Math.round(baseCrystals * COMEBACK_BONUS);
    st.remaining -= 1;
    if (st.remaining <= 0) st.active = false;
    save(st);

    if (bonus > 0) {
      const gs = SaveService.loadGachaState();
      SaveService.saveGachaState({ ...gs, crystals: gs.crystals + bonus });
      void SaveService.uploadSave();
    }
    return bonus;
  },

  COMEBACK_BATTLES,
};
