/**
 * BattleStatsService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Lifetime battle statistics for the profile screen.
 * Tracked across all modes (tower, PvP, daily trial).
 * ─────────────────────────────────────────────────────────────
 */

const KEY = 'ci_battle_stats';

export interface BattleStats {
  totalBattles:   number;
  totalWins:      number;
  totalLosses:    number;
  totalDamage:    number;
  bestCombo:      number;
  bestWinStreak:  number;
  pvpWins:        number;
  pvpLosses:      number;
  towerBattles:   number;
}

const DEFAULT: BattleStats = {
  totalBattles:  0,
  totalWins:     0,
  totalLosses:   0,
  totalDamage:   0,
  bestCombo:     0,
  bestWinStreak: 0,
  pvpWins:       0,
  pvpLosses:     0,
  towerBattles:  0,
};

function load(): BattleStats {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    return { ...DEFAULT, ...JSON.parse(raw) as Partial<BattleStats> };
  } catch {
    return { ...DEFAULT };
  }
}

function save(st: BattleStats): void {
  try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* ignore */ }
}

function recordBattle(opts: {
  victory:    boolean;
  isPvp:      boolean;
  isTower:    boolean;
  damage:     number;
  combo:      number;
  winStreak:  number;
}): void {
  const st = load();
  const next: BattleStats = {
    ...st,
    totalBattles:  st.totalBattles + 1,
    totalWins:     st.totalWins  + (opts.victory ? 1 : 0),
    totalLosses:   st.totalLosses + (opts.victory ? 0 : 1),
    totalDamage:   st.totalDamage + opts.damage,
    bestCombo:     Math.max(st.bestCombo, opts.combo),
    bestWinStreak: Math.max(st.bestWinStreak, opts.winStreak),
    pvpWins:       st.pvpWins   + (opts.isPvp && opts.victory  ? 1 : 0),
    pvpLosses:     st.pvpLosses + (opts.isPvp && !opts.victory ? 1 : 0),
    towerBattles:  st.towerBattles + (opts.isTower ? 1 : 0),
  };
  save(next);
}

export const BattleStatsService = {
  load,
  recordBattle,
};
