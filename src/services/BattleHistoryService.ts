/**
 * BattleHistoryService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Tracks the last 5 battle results so the lobby can show a
 * compact "recent runs" strip. Creates session momentum and
 * motivates players to beat their previous grades.
 * ─────────────────────────────────────────────────────────────
 */

const KEY = 'ci_battle_history';
const MAX_ENTRIES = 5;

export interface BattleHistoryEntry {
  timestamp: number;
  floor:     number;
  won:       boolean;
  crystals:  number;
  grade?:    string;
}

function load(): BattleHistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as BattleHistoryEntry[];
  } catch { return []; }
}

function save(entries: BattleHistoryEntry[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(entries)); } catch { /* ignore */ }
}

export function addEntry(entry: Omit<BattleHistoryEntry, 'timestamp'>): void {
  const entries = load();
  entries.unshift({ ...entry, timestamp: Date.now() });
  save(entries.slice(0, MAX_ENTRIES));
}

export function getRecent(): BattleHistoryEntry[] {
  return load();
}

/** Win rate across stored history (0–1). */
export function recentWinRate(): number {
  const entries = load();
  if (entries.length === 0) return 0;
  return entries.filter(e => e.won).length / entries.length;
}

/** Crystals earned per battle (recent average). */
export function avgCrystals(): number {
  const entries = load().filter(e => e.won);
  if (entries.length === 0) return 0;
  return Math.round(entries.reduce((s, e) => s + e.crystals, 0) / entries.length);
}

export const BattleHistoryService = {
  addEntry,
  getRecent,
  recentWinRate,
  avgCrystals,
};
