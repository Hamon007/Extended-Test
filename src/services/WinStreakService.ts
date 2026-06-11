// Win-Streak: zählt Siege in Folge. Niederlagen setzen zurück.
// Streak Shield: bei Streak ≥ 5 wird ein Schutzschild gewährt, das eine
// Niederlage absorbiert, ohne die Streak zurückzusetzen.

import { SaveService } from './SaveService';

const KEY        = 'ci_win_streak';
const SHIELD_KEY = 'ci_streak_shield';

const SHIELD_THRESHOLDS = [5, 10, 15, 20, 30, 50];

export interface StreakReward {
  multiplier: number;
  label:      string;
}

export const WinStreakService = {
  get(): number {
    return parseInt(localStorage.getItem(KEY) ?? '0', 10);
  },

  hasShield(): boolean {
    return localStorage.getItem(SHIELD_KEY) === '1';
  },

  grantShield(): void {
    localStorage.setItem(SHIELD_KEY, '1');
  },

  /** Consumes the shield. Returns true if a shield was active (i.e. defeat blocked). */
  consumeShield(): boolean {
    if (localStorage.getItem(SHIELD_KEY) === '1') {
      localStorage.removeItem(SHIELD_KEY);
      return true;
    }
    return false;
  },

  incrementOnVictory(): number {
    const next = WinStreakService.get() + 1;
    localStorage.setItem(KEY, String(next));
    // Grant a shield each time we hit a threshold (and don't already have one)
    if (SHIELD_THRESHOLDS.includes(next) && !WinStreakService.hasShield()) {
      WinStreakService.grantShield();
    }
    void SaveService.uploadSave();
    return next;
  },

  /**
   * Called on defeat.
   * Returns 'shielded' if a streak shield absorbed the defeat (streak preserved),
   * or 'reset' if the streak was cleared normally.
   */
  resetOnDefeat(): 'shielded' | 'reset' {
    if (WinStreakService.consumeShield()) {
      void SaveService.uploadSave();
      return 'shielded';
    }
    localStorage.removeItem(KEY);
    void SaveService.uploadSave();
    return 'reset';
  },

  /** Belohnungs-Multiplikator basierend auf aktueller Streak-Stufe. */
  getRewardMultiplier(streak: number): StreakReward {
    if (streak >= 10) return { multiplier: 1.8, label: 'LEGENDE — Belohnungen ×1.8' };
    if (streak >= 5)  return { multiplier: 1.4, label: 'UNFEHLBAR — Belohnungen ×1.4' };
    if (streak >= 3)  return { multiplier: 1.2, label: 'STRÄHNE — Belohnungen ×1.2' };
    return { multiplier: 1.0, label: '' };
  },
};
