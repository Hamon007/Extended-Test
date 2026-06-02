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

interface SpinState {
  lastSpinDate: string; // 'YYYY-MM-DD'
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function load(): SpinState {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SpinState) : { lastSpinDate: '' };
  } catch { return { lastSpinDate: '' }; }
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

function spin(): { prize: SpinPrize; prizeIndex: number } | null {
  if (!canSpin()) return null;
  save({ lastSpinDate: todayKey() });

  const prize = pickPrize();
  const prizeIndex = SPIN_PRIZES.indexOf(prize);

  // Apply reward
  if (prize.crystals) {
    const gs = SaveService.loadGachaState();
    SaveService.saveGachaState({ ...gs, crystals: gs.crystals + prize.crystals });
  }
  if (prize.potions) {
    EnergyService.addPotions(prize.potions);
  }
  if (prize.accountXp) {
    const acc = SaveService.loadAccountState();
    const res = AccountProgressionService.addAccountXp(acc, prize.accountXp);
    SaveService.saveAccountState(res.newState);
  }

  return { prize, prizeIndex };
}

export const LuckySpinService = {
  canSpin,
  spin,
  SPIN_PRIZES,
};
