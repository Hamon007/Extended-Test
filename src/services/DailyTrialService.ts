import type { Element } from '../types/Card';

export type DailyModifier =
  | { kind: 'time_trial';    maxRounds: number }
  | { kind: 'element_curse'; element: Element }
  | { kind: 'berserker' }
  | { kind: 'silence' }
  | { kind: 'mirror' };

export interface DailyTrial {
  id:          string;
  title:       string;
  description: string;
  modifier:    DailyModifier;
  rewardXp:    number;
  rewardCrystals: number;
}

const ELEMENTS: Element[] = ['fire', 'ice', 'lightning', 'dark', 'light', 'water', 'earth'];

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function pickTrial(seed: string): DailyTrial {
  const h = hashSeed(seed);
  const kindIdx = h % 5;

  switch (kindIdx) {
    case 0: {
      const el = ELEMENTS[(h >>> 3) % ELEMENTS.length];
      return {
        id:    `dt_${seed}`,
        title: 'Elementarfluch',
        description: `Nur Karten vom Element "${el}" verursachen vollen Schaden. Andere nur 40%.`,
        modifier: { kind: 'element_curse', element: el },
        rewardXp: 500, rewardCrystals: 250,
      };
    }
    case 1:
      return {
        id:    `dt_${seed}`,
        title: 'Spiegelturm',
        description: 'Du erleidest 40% des Schadens, den du verursachst, selbst.',
        modifier: { kind: 'mirror' },
        rewardXp: 600, rewardCrystals: 300,
      };
    case 2:
      return {
        id:    `dt_${seed}`,
        title: 'Zeitprüfung',
        description: 'Maximal 4 Runden. Schaffst du es nicht, hast du verloren.',
        modifier: { kind: 'time_trial', maxRounds: 4 },
        rewardXp: 700, rewardCrystals: 350,
      };
    case 3:
      return {
        id:    `dt_${seed}`,
        title: 'Berserker-Modus',
        description: 'Alle Angriffe ×2, alle HP ×0,5 — beide Seiten.',
        modifier: { kind: 'berserker' },
        rewardXp: 800, rewardCrystals: 400,
      };
    default:
      return {
        id:    `dt_${seed}`,
        title: 'Stille',
        description: 'Keine MP-Regeneration in den ersten 2 Runden.',
        modifier: { kind: 'silence' },
        rewardXp: 600, rewardCrystals: 300,
      };
  }
}

const COMPLETED_KEY = 'ci_daily_trial_completed';

export const DailyTrialService = {
  today(): DailyTrial {
    return pickTrial(todayString());
  },

  isCompleted(): boolean {
    return localStorage.getItem(COMPLETED_KEY) === todayString();
  },

  markCompleted(): void {
    localStorage.setItem(COMPLETED_KEY, todayString());
  },
};
