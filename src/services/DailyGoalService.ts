/**
 * DailyGoalService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Tracks crystals earned from battles today and rewards the player
 * when they hit the daily crystal goal. Creates a concrete daily
 * habit and shows visible progress on the main screen.
 * Resets at UTC midnight.
 * ─────────────────────────────────────────────────────────────
 */

import { SaveService } from './SaveService';

export const DAILY_GOAL = 2_000;        // crystal target
export const DAILY_GOAL_REWARD = 200;   // bonus crystals on reaching goal

const KEY = 'ci_daily_goal';

interface GoalState {
  dateKey: string; // 'YYYY-MM-DD' UTC
  earned:  number; // crystals earned from battles today
  claimed: boolean;
}

function utcDateKey(): string {
  const n = new Date();
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, '0')}-${String(n.getUTCDate()).padStart(2, '0')}`;
}

function load(): GoalState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GoalState;
      if (parsed.dateKey === utcDateKey()) return parsed;
    }
  } catch { /* ignore */ }
  return { dateKey: utcDateKey(), earned: 0, claimed: false };
}

function save(st: GoalState): void {
  try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* ignore */ }
}

export const DailyGoalService = {
  /** Add crystals earned from a battle. Returns bonus amount if goal is newly reached, else 0. */
  addEarned(crystals: number): number {
    if (crystals <= 0) return 0;
    const st = load();
    const wasReached = st.earned >= DAILY_GOAL;
    st.earned = Math.min(st.earned + crystals, DAILY_GOAL * 3); // cap to avoid huge numbers
    const nowReached = st.earned >= DAILY_GOAL && !wasReached && !st.claimed;
    if (nowReached) {
      st.claimed = true;
      save(st);
      const gs = SaveService.loadGachaState();
      SaveService.saveGachaState({ ...gs, crystals: gs.crystals + DAILY_GOAL_REWARD });
      void SaveService.uploadSave();
      return DAILY_GOAL_REWARD;
    }
    save(st);
    return 0;
  },

  getEarned(): number {
    return load().earned;
  },

  isClaimed(): boolean {
    return load().claimed;
  },

  /** Progress fraction 0-1 (may exceed 1 if over-achieved). */
  getProgress(): number {
    return Math.min(1, load().earned / DAILY_GOAL);
  },
};
