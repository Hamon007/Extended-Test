/**
 * HourlyFirstWinService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Awards a small bonus on the first victory in each UTC hour.
 * Creates 24 micro-engagement windows per day — even short sessions
 * feel rewarded. Resets automatically as the hour changes.
 * ─────────────────────────────────────────────────────────────
 */

import { SaveService } from './SaveService';

export const HOURLY_FIRST_WIN_BONUS = 50;

const KEY = 'ci_hourly_first_win';

function hourKey(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  return `${y}-${m}-${day}-${h}`;
}

function loadClaimed(): string {
  try { return localStorage.getItem(KEY) ?? ''; } catch { return ''; }
}

function saveClaimed(key: string): void {
  try { localStorage.setItem(KEY, key); } catch { /* ignore */ }
}

/** Returns true if the first-win bonus is available this hour. */
export function isAvailable(): boolean {
  return loadClaimed() !== hourKey();
}

/**
 * Claim the hourly first-win bonus.
 * Returns the bonus amount (HOURLY_FIRST_WIN_BONUS) or 0 if already claimed.
 */
export function claim(): number {
  const key = hourKey();
  if (loadClaimed() === key) return 0;
  saveClaimed(key);
  const gs = SaveService.loadGachaState();
  SaveService.saveGachaState({ ...gs, crystals: gs.crystals + HOURLY_FIRST_WIN_BONUS });
  return HOURLY_FIRST_WIN_BONUS;
}

/** Minutes remaining until next hour (and next opportunity). */
export function minsUntilNext(): number {
  const d = new Date();
  return 60 - d.getUTCMinutes();
}

export const HourlyFirstWinService = {
  isAvailable,
  claim,
  minsUntilNext,
  HOURLY_FIRST_WIN_BONUS,
};
