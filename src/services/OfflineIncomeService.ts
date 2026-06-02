/**
 * OfflineIncomeService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Passive crystal generation while the player is offline.
 * Called once on app start; returns crystals earned since last session.
 * Cap: 8 hours (encourages returning multiple times per day).
 * ─────────────────────────────────────────────────────────────
 */

import { SaveService } from './SaveService';

const KEY = 'ci_last_active';
const CAP_HOURS = 8;
const MIN_MINUTES = 15; // below this threshold, no reward shown

function getRate(accountLevel: number): number {
  // Crystals per hour based on account level
  if (accountLevel >= 30) return 15;
  if (accountLevel >= 20) return 10;
  if (accountLevel >= 10) return 6;
  if (accountLevel >= 5)  return 4;
  return 2;
}

export interface OfflineResult {
  hours:    number;   // hours offline (capped)
  crystals: number;   // crystals awarded
}

function updateActiveTime(): void {
  try {
    localStorage.setItem(KEY, Date.now().toString());
  } catch { /* ignore */ }
}

function claim(): OfflineResult | null {
  try {
    const raw  = localStorage.getItem(KEY);
    const now  = Date.now();
    updateActiveTime();

    if (!raw) return null;

    const last       = parseInt(raw, 10);
    const elapsedMs  = now - last;
    const elapsedMin = elapsedMs / 60_000;

    if (elapsedMin < MIN_MINUTES) return null;

    const elapsedHours = Math.min(CAP_HOURS, elapsedMs / 3_600_000);
    const account      = SaveService.loadAccountState();
    const rate         = getRate(account.level);
    const crystals     = Math.floor(elapsedHours * rate);

    if (crystals < 1) return null;

    const gs = SaveService.loadGachaState();
    SaveService.saveGachaState({ ...gs, crystals: gs.crystals + crystals });

    return { hours: Math.round(elapsedHours * 10) / 10, crystals };
  } catch {
    updateActiveTime();
    return null;
  }
}

export const OfflineIncomeService = {
  claim,
  updateActiveTime,
  getRate,
};
