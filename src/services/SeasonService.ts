/**
 * SeasonService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Saisonales Rangsystem. Jede Saison dauert 30 Tage.
 * Spieler sammeln SP (Season Points) durch Siege, PvP und Turm.
 * Am Saisonende erhalten Spieler Belohnungen basierend auf Rang.
 * ─────────────────────────────────────────────────────────────
 */

import { SaveService } from './SaveService';

const KEY = 'ci_season';

export type SeasonRank =
  | 'Novize'
  | 'Kämpfer'
  | 'Veteran'
  | 'Elite'
  | 'Champion'
  | 'Meister'
  | 'Legende';

export const RANK_THRESHOLDS: Record<SeasonRank, number> = {
  Novize:    0,
  Kämpfer:   100,
  Veteran:   300,
  Elite:     700,
  Champion:  1500,
  Meister:   3000,
  Legende:   6000,
};

export const RANK_COLORS: Record<SeasonRank, string> = {
  Novize:   '#9e9e9e',
  Kämpfer:  '#4caf50',
  Veteran:  '#2196f3',
  Elite:    '#9c27b0',
  Champion: '#ff9800',
  Meister:  '#f44336',
  Legende:  '#ffd700',
};

export const RANK_ICONS: Record<SeasonRank, string> = {
  Novize:   '○',
  Kämpfer:  '◆',
  Veteran:  '★',
  Elite:    '⚜',
  Champion: '🏅',
  Meister:  '👑',
  Legende:  '🔥',
};

export const SP_REWARDS = {
  tower_win:    10,
  boss_win:     30,
  elite_win:    20,
  pvp_win:      25,
  pvp_loss:     5,
  daily_trial:  40,
} as const;

export interface SeasonEndReward {
  rank:       SeasonRank;
  crystals:   number;
  description: string;
}

export const SEASON_END_REWARDS: SeasonEndReward[] = [
  { rank: 'Novize',    crystals: 100,   description: 'Anfänger-Belohnung' },
  { rank: 'Kämpfer',   crystals: 300,   description: 'Kämpfer-Belohnung' },
  { rank: 'Veteran',   crystals: 600,   description: 'Veteran-Belohnung' },
  { rank: 'Elite',     crystals: 1200,  description: 'Elite-Belohnung' },
  { rank: 'Champion',  crystals: 2500,  description: 'Champion-Belohnung' },
  { rank: 'Meister',   crystals: 5000,  description: 'Meister-Belohnung' },
  { rank: 'Legende',   crystals: 10000, description: 'Legendäre Belohnung!' },
];

export interface SeasonState {
  seasonNumber: number;
  sp:           number;
  startDate:    string;   // ISO date when season started
  endDate:      string;   // ISO date when season ends (startDate + 30 days)
  lastClaimed:  boolean;  // has end-season reward been claimed
  spToday:      number;   // SP earned today (resets at midnight)
  lastSpDate:   string;   // ISO date of last SP earned (for daily reset)
}

const SEASON_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function newSeason(number: number): SeasonState {
  const start = new Date();
  const end   = new Date(start.getTime() + SEASON_DURATION_MS);
  return {
    seasonNumber: number,
    sp:           0,
    startDate:    start.toISOString().slice(0, 10),
    endDate:      end.toISOString().slice(0, 10),
    lastClaimed:  false,
    spToday:      0,
    lastSpDate:   todayISO(),
  };
}

function load(): SeasonState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const st = newSeason(1);
      save(st);
      return st;
    }
    const partial = JSON.parse(raw) as Partial<SeasonState> & Pick<SeasonState, 'seasonNumber' | 'sp' | 'startDate' | 'endDate' | 'lastClaimed'>;
    const today = todayISO();
    const st: SeasonState = {
      ...partial,
      spToday:    partial.lastSpDate === today ? (partial.spToday ?? 0) : 0,
      lastSpDate: partial.lastSpDate ?? today,
    };
    // Check if season expired
    if (today > st.endDate) {
      return handleSeasonEnd(st);
    }
    return st;
  } catch {
    const st = newSeason(1);
    save(st);
    return st;
  }
}

function save(st: SeasonState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(st));
  } catch { /* ignore */ }
}

function handleSeasonEnd(oldSeason: SeasonState): SeasonState {
  // Give end-of-season reward if not claimed
  if (!oldSeason.lastClaimed) {
    const rank = getRankForSp(oldSeason.sp);
    const reward = SEASON_END_REWARDS.find(r => r.rank === rank);
    if (reward) {
      const gs = SaveService.loadGachaState();
      SaveService.saveGachaState({ ...gs, crystals: gs.crystals + reward.crystals });
    }
  }
  // Start new season
  const next = newSeason(oldSeason.seasonNumber + 1);
  save(next);
  return next;
}

function getRankForSp(sp: number): SeasonRank {
  const ranks = Object.entries(RANK_THRESHOLDS) as [SeasonRank, number][];
  let currentRank: SeasonRank = 'Novize';
  for (const [rank, threshold] of ranks) {
    if (sp >= threshold) currentRank = rank;
  }
  return currentRank;
}

function progressToNext(sp: number): { rank: SeasonRank; nextRank: SeasonRank | null; progress: number } {
  const rank = getRankForSp(sp);
  const ranks = Object.keys(RANK_THRESHOLDS) as SeasonRank[];
  const rankIdx = ranks.indexOf(rank);
  const nextRank = rankIdx < ranks.length - 1 ? ranks[rankIdx + 1] : null;

  if (!nextRank) return { rank, nextRank: null, progress: 1 };

  const fromSp = RANK_THRESHOLDS[rank];
  const toSp   = RANK_THRESHOLDS[nextRank];
  const progress = Math.min(1, (sp - fromSp) / (toSp - fromSp));
  return { rank, nextRank, progress };
}

function addSp(amount: number): SeasonState {
  const st = load();
  const today = todayISO();
  const spToday = st.lastSpDate === today ? st.spToday + amount : amount;
  const updated = { ...st, sp: st.sp + amount, spToday, lastSpDate: today };
  save(updated);
  return updated;
}

function getDaysLeft(): number {
  const st = load();
  const end = new Date(st.endDate);
  const now = new Date();
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
}

export const SeasonService = {
  load,
  addSp,
  getRankForSp,
  progressToNext,
  getDaysLeft,
  SP_REWARDS,
  RANK_COLORS,
  RANK_ICONS,
};
