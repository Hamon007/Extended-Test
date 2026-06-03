/**
 * FirstWinService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Grants a bonus on the first battle victory of each day.
 * Classic daily-retention hook — rewards coming back to play.
 * ─────────────────────────────────────────────────────────────
 */

import { SaveService } from './SaveService';

const KEY = 'ci_first_win';

export const FIRST_WIN_BONUS = 500;

interface FirstWinState {
  lastWinDate: string; // 'YYYY-MM-DD'
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function load(): FirstWinState {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as FirstWinState) : { lastWinDate: '' };
  } catch { return { lastWinDate: '' }; }
}

function save(st: FirstWinState): void {
  localStorage.setItem(KEY, JSON.stringify(st));
}

/** Returns true if today's first win has not been claimed yet. */
function isAvailable(): boolean {
  return load().lastWinDate !== todayKey();
}

/**
 * Claims the first-win bonus if available. Awards crystals directly.
 * Returns the bonus amount, or 0 if already claimed today.
 */
function claim(): number {
  if (!isAvailable()) return 0;
  save({ lastWinDate: todayKey() });
  const gs = SaveService.loadGachaState();
  SaveService.saveGachaState({ ...gs, crystals: gs.crystals + FIRST_WIN_BONUS });
  return FIRST_WIN_BONUS;
}

export const FirstWinService = {
  isAvailable,
  claim,
  FIRST_WIN_BONUS,
};
