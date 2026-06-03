/**
 * LuckySpinService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Daily lucky spin wheel. Free once per day; awards crystals,
 * potions, or XP. Variable rewards drive daily engagement.
 * ─────────────────────────────────────────────────────────────
 */

import { SaveService } from './SaveService';
import { AccountProgressionService } from './AccountProgressionService';
import { EnergyService } from './EnergyService';

const KEY = 'ci_lucky_spin';

export interface SpinPrize {
  id:        string;
  label:     string;
  icon:      string;
  color:     string;
  crystals?: number;
  potions?:  number;
  accountXp?: number;
  weight:    number;
}

export const SPIN_PRIZES: SpinPrize[] = [
  { id: 'crystal_100',  label: '100 Kristalle',  icon: '💎', color: '#5e8eff', crystals: 100,  weight: 30 },
  { id: 'crystal_300',  label: '300 Kristalle',  icon: '💎', color: '#7b52ab', crystals: 300,  weight: 20 },
  { id: 'crystal_600',  label: '600 Kristalle',  icon: '💎', color: '#9c27b0', crystals: 600,  weight: 12 },
  { id: 'crystal_1500', label: '1.500 Kristalle', icon: '💎', color: '#e91e63', crystals: 1500, weight: 6  },
  { id: 'crystal_3000', label: '3.000 Kristalle', icon: '💎', color: '#ffd700', crystals: 3000, weight: 2  },
  { id: 'potion_2',     label: '2 Tränke',        icon: '🧪', color: '#4caf50', potions: 2,     weight: 8  },
  { id: 'potion_5',     label: '5 Tränke',        icon: '🧪', color: '#00bcd4', potions: 5,     weight: 14 },
  { id: 'xp_200',       label: '200 Account-XP',  icon: '✦',  color: '#ff9800', accountXp: 200, weight: 8  },
];

const TOTAL_WEIGHT = SPIN_PRIZES.reduce((s, p) => s + p.weight, 0);

export const STREAK_MILESTONES: { days: number; bonus: number; label: string }[] = [
  { days: 3,  bonus: 300,  label: '3-Tage-Serie'   },
  { days: 7,  bonus: 1000, label: '7-Tage-Serie'   },
  { days: 14, bonus: 2000, label: '14-Tage-Serie'  },
  { days: 30, bonus: 5000, label: '30-Tage-Serie'  },
];

interface SpinState {
  lastSpinDate: string;       // 'YYYY-MM-DD'
  streak: number;             // consecutive days spun
  history: string[];          // last 7 prize IDs (newest first)
  claimedMilestones: number[]; // milestone day-counts already claimed
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function load(): SpinState {
  try {
    const raw = localStorage.getItem(KEY);
    const base = raw ? (JSON.parse(raw) as Partial<SpinState>) : {};
    return {
      lastSpinDate:      base.lastSpinDate      ?? '',
      streak:            base.streak            ?? 0,
      history:           base.history           ?? [],
      claimedMilestones: base.claimedMilestones ?? [],
    };
  } catch {
    return { lastSpinDate: '', streak: 0, history: [], claimedMilestones: [] };
  }
}

function save(st: SpinState): void {
  localStorage.setItem(KEY, JSON.stringify(st));
}

function canSpin(): boolean {
  return load().lastSpinDate !== todayKey();
}

function pickPrize(): SpinPrize {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const p of SPIN_PRIZES) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return SPIN_PRIZES[0]!;
}

function getStreak(): number {
  return load().streak ?? 0;
}

function getHistory(): SpinPrize[] {
  const st = load();
  return (st.history ?? [])
    .map(id => SPIN_PRIZES.find(p => p.id === id))
    .filter((p): p is SpinPrize => p !== undefined);
}

function spin(): { prize: SpinPrize; prizeIndex: number; streakBonus: number | null } | null {
  if (!canSpin()) return null;
  const st = load();
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yKey = yesterday.toISOString().slice(0, 10);
  const newStreak = st.lastSpinDate === yKey ? (st.streak ?? 0) + 1 : 1;

  // Check for unclaimed streak milestones
  const claimed = st.claimedMilestones ?? [];
  let streakBonus: number | null = null;
  const newClaimed = [...claimed];
  for (const ms of STREAK_MILESTONES) {
    if (newStreak >= ms.days && !claimed.includes(ms.days)) {
      streakBonus = (streakBonus ?? 0) + ms.bonus;
      newClaimed.push(ms.days);
    }
  }

  const prize = pickPrize();
  const prizeIndex = SPIN_PRIZES.indexOf(prize);
  const newHistory = [prize.id, ...(st.history ?? [])].slice(0, 7);

  save({
    lastSpinDate: todayKey(),
    streak: newStreak,
    history: newHistory,
    claimedMilestones: newClaimed,
  });

  // Apply reward
  if (prize.crystals) {
    const gs = SaveService.loadGachaState();
    SaveService.saveGachaState({ ...gs, crystals: gs.crystals + prize.crystals + (streakBonus ?? 0) });
  } else {
    if (streakBonus) {
      const gs = SaveService.loadGachaState();
      SaveService.saveGachaState({ ...gs, crystals: gs.crystals + streakBonus });
    }
    if (prize.potions) {
      EnergyService.addPotions(prize.potions);
    }
    if (prize.accountXp) {
      const acc = SaveService.loadAccountState();
      const res = AccountProgressionService.addAccountXp(acc, prize.accountXp);
      SaveService.saveAccountState(res.newState);
    }
  }

  return { prize, prizeIndex, streakBonus };
}

export const LuckySpinService = {
  canSpin,
  spin,
  getStreak,
  getHistory,
  SPIN_PRIZES,
};
