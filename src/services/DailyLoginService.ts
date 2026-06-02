/**
 * DailyLoginService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Classic 7-day login bonus streak.
 * Rewards escalate each day; streak resets if a day is missed.
 * Day-7 bonus is the "jackpot" reward to keep players logging daily.
 * ─────────────────────────────────────────────────────────────
 */

import { SaveService } from './SaveService';
import { EnergyService } from './EnergyService';

const KEY = 'ci_daily_login';

export interface DayReward {
  day:      number;
  crystals: number;
  potions:  number;
  label:    string;
}

export const DAY_REWARDS: DayReward[] = [
  { day: 1, crystals: 50,   potions: 0, label: '50 Kristalle' },
  { day: 2, crystals: 100,  potions: 0, label: '100 Kristalle' },
  { day: 3, crystals: 150,  potions: 1, label: '150 Kristalle + 1 Trank' },
  { day: 4, crystals: 200,  potions: 0, label: '200 Kristalle' },
  { day: 5, crystals: 300,  potions: 2, label: '300 Kristalle + 2 Tränke' },
  { day: 6, crystals: 500,  potions: 0, label: '500 Kristalle' },
  { day: 7, crystals: 1000, potions: 3, label: '🎉 1000 Kristalle + 3 Tränke!' },
];

export interface LoginState {
  lastClaimDate: string;   // 'YYYY-MM-DD' or ''
  streakDay:     number;   // 1-7 (current streak day, 0 = never claimed)
  totalDays:     number;   // lifetime login days
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function load(): LoginState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { lastClaimDate: '', streakDay: 0, totalDays: 0 };
    return JSON.parse(raw) as LoginState;
  } catch {
    return { lastClaimDate: '', streakDay: 0, totalDays: 0 };
  }
}

function save(st: LoginState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(st));
  } catch { /* ignore */ }
}

function canClaim(): boolean {
  const st = load();
  return st.lastClaimDate !== todayISO();
}

function getStreakDay(): number {
  const st = load();
  if (st.lastClaimDate === '') return 1;
  if (st.lastClaimDate === yesterdayISO()) {
    return st.streakDay >= 7 ? 1 : st.streakDay + 1;
  }
  return 1; // streak broken
}

function getTodayReward(): DayReward {
  const day = getStreakDay();
  return DAY_REWARDS[day - 1];
}

function claim(): DayReward | null {
  if (!canClaim()) return null;

  const reward  = getTodayReward();
  const nextDay = reward.day;

  const st = load();
  const newSt: LoginState = {
    lastClaimDate: todayISO(),
    streakDay:     nextDay,
    totalDays:     st.totalDays + 1,
  };
  save(newSt);

  // Apply crystal reward
  const gs = SaveService.loadGachaState();
  SaveService.saveGachaState({ ...gs, crystals: gs.crystals + reward.crystals });

  // Apply potion reward
  if (reward.potions > 0) {
    EnergyService.addPotions(reward.potions);
  }

  return reward;
}

export const DailyLoginService = {
  canClaim,
  claim,
  getTodayReward,
  getStreakDay,
  load,
  DAY_REWARDS,
};
