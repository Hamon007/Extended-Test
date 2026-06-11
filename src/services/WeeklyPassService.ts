/**
 * WeeklyPassService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * 10-milestone weekly battle pass. Resets every Monday UTC midnight.
 * Each victory fills the progress bar; milestones must be claimed manually.
 * Drives daily return habit and gives long-term weekly goals.
 * ─────────────────────────────────────────────────────────────
 */

import { SaveService } from './SaveService';

const KEY = 'ci_weekly_pass';

export interface PassMilestone {
  id:        number; // 1-10
  label:     string;
  winsNeeded: number; // cumulative victories needed
  crystals:  number;
  icon:      string;
}

export const PASS_MILESTONES: PassMilestone[] = [
  { id:  1, label: 'Stufe I',   winsNeeded:  1,  crystals:  100, icon: '⚔️' },
  { id:  2, label: 'Stufe II',  winsNeeded:  3,  crystals:  150, icon: '🗡️' },
  { id:  3, label: 'Stufe III', winsNeeded:  6,  crystals:  200, icon: '🏹' },
  { id:  4, label: 'Stufe IV',  winsNeeded: 10,  crystals:  300, icon: '🛡️' },
  { id:  5, label: 'Stufe V',   winsNeeded: 15,  crystals:  400, icon: '💎' },
  { id:  6, label: 'Stufe VI',  winsNeeded: 22,  crystals:  600, icon: '⭐' },
  { id:  7, label: 'Stufe VII', winsNeeded: 30,  crystals:  800, icon: '🌟' },
  { id:  8, label: 'Stufe VIII',winsNeeded: 40,  crystals: 1000, icon: '👑' },
  { id:  9, label: 'Stufe IX',  winsNeeded: 55,  crystals: 1500, icon: '🔥' },
  { id: 10, label: 'MAX',       winsNeeded: 75,  crystals: 2500, icon: '🏆' },
];

interface WeeklyPassState {
  weekKey:  string; // 'YYYY-WW' — ISO week identifier
  wins:     number;
  claimed:  number[]; // milestone IDs already claimed
}

function isoWeekKey(): string {
  const d = new Date();
  // ISO week: start on Monday
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7));
  const diff = d.getTime() - startOfWeek1.getTime();
  const weekNum = Math.floor(diff / (7 * 86400000)) + 1;
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function load(): WeeklyPassState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { weekKey: isoWeekKey(), wins: 0, claimed: [] };
    const st = JSON.parse(raw) as WeeklyPassState;
    if (st.weekKey !== isoWeekKey()) return { weekKey: isoWeekKey(), wins: 0, claimed: [] };
    return st;
  } catch { return { weekKey: isoWeekKey(), wins: 0, claimed: [] }; }
}

function save(st: WeeklyPassState): void {
  try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* ignore */ }
}

/** Called on every victory (tower or standard). Returns newly reached milestone ids. */
export function recordWin(): number[] {
  const st = load();
  st.wins += 1;
  save(st);
  return PASS_MILESTONES
    .filter(m => st.wins >= m.winsNeeded && !st.claimed.includes(m.id))
    .map(m => m.id);
}

/** Claim a milestone reward. Returns crystals awarded (0 if not eligible). */
export function claimMilestone(milestoneId: number): number {
  const st = load();
  const ms = PASS_MILESTONES.find(m => m.id === milestoneId);
  if (!ms) return 0;
  if (st.wins < ms.winsNeeded) return 0;
  if (st.claimed.includes(ms.id)) return 0;

  st.claimed.push(ms.id);
  save(st);

  const gs = SaveService.loadGachaState();
  SaveService.saveGachaState({ ...gs, crystals: gs.crystals + ms.crystals });
  return ms.crystals;
}

/** Returns current wins this week. */
export function getWins(): number { return load().wins; }

/** Returns which milestone ids have been claimed this week. */
export function getClaimed(): number[] { return load().claimed; }

/** Returns claimable (reached but not yet claimed) milestone ids. */
export function getClaimable(): number[] {
  const st = load();
  return PASS_MILESTONES
    .filter(m => st.wins >= m.winsNeeded && !st.claimed.includes(m.id))
    .map(m => m.id);
}

/** Full pass state for rendering. */
export function getPassState(): {
  wins:       number;
  milestones: Array<PassMilestone & { reached: boolean; claimed: boolean }>;
  nextMs:     PassMilestone | null;
  complete:   boolean;
} {
  const st = load();
  const milestones = PASS_MILESTONES.map(m => ({
    ...m,
    reached: st.wins >= m.winsNeeded,
    claimed: st.claimed.includes(m.id),
  }));
  const nextMs = PASS_MILESTONES.find(m => st.wins < m.winsNeeded) ?? null;
  return { wins: st.wins, milestones, nextMs, complete: st.wins >= PASS_MILESTONES[9]!.winsNeeded };
}

export const WeeklyPassService = {
  recordWin,
  claimMilestone,
  getWins,
  getClaimed,
  getClaimable,
  getPassState,
  PASS_MILESTONES,
};
