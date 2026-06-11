/**
 * LuckySeven.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Every 7th battle victory in a calendar day earns 777 bonus
 * crystals. Resets at UTC midnight.
 * Creates a concrete daily goal (win 7 battles) and a
 * satisfying jackpot moment at each multiple of 7.
 * ─────────────────────────────────────────────────────────────
 */

const KEY = 'ci_lucky7';
const JACKPOT = 777;

interface LuckyData {
  date:   string;  // ISO date YYYY-MM-DD
  wins:   number;  // wins today
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function load(): LuckyData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { date: todayISO(), wins: 0 };
    const d = JSON.parse(raw) as LuckyData;
    if (d.date !== todayISO()) return { date: todayISO(), wins: 0 };
    return d;
  } catch {
    return { date: todayISO(), wins: 0 };
  }
}

function save(d: LuckyData): void {
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* ignore */ }
}

/**
 * Record a battle victory. Returns 777 if this was the 7th (or 14th, 21st…)
 * win of the day, otherwise 0.
 */
function recordWin(): number {
  const d = load();
  const newWins = d.wins + 1;
  save({ date: d.date, wins: newWins });
  return newWins % 7 === 0 ? JACKPOT : 0;
}

/** Wins recorded today (for UI display). */
function getWinsToday(): number {
  return load().wins;
}

/** Wins needed until the next Lucky 7 jackpot. */
function winsUntilNext(): number {
  const w = load().wins;
  return 7 - (w % 7);
}

export const LuckySeven = {
  recordWin,
  getWinsToday,
  winsUntilNext,
  JACKPOT,
};
