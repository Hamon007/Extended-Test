// Win-Streak: zählt Siege in Folge. Niederlagen setzen zurück.

const KEY = 'ci_win_streak';

export interface StreakReward {
  multiplier: number;
  label:      string;
}

export const WinStreakService = {
  get(): number {
    return parseInt(localStorage.getItem(KEY) ?? '0', 10);
  },

  incrementOnVictory(): number {
    const next = WinStreakService.get() + 1;
    localStorage.setItem(KEY, String(next));
    return next;
  },

  resetOnDefeat(): void {
    localStorage.removeItem(KEY);
  },

  /** Belohnungs-Multiplikator basierend auf aktueller Streak-Stufe. */
  getRewardMultiplier(streak: number): StreakReward {
    if (streak >= 10) return { multiplier: 1.8, label: 'LEGENDE — Belohnungen ×1.8' };
    if (streak >= 5)  return { multiplier: 1.4, label: 'UNFEHLBAR — Belohnungen ×1.4' };
    if (streak >= 3)  return { multiplier: 1.2, label: 'STRÄHNE — Belohnungen ×1.2' };
    return { multiplier: 1.0, label: '' };
  },
};
