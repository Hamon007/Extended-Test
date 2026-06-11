/**
 * FlashChallengeService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Every 2 UTC hours a new timed challenge activates for 60 minutes.
 * Completing it awards a big bonus. Creates FOMO and regular return habit.
 * Challenges are deterministic (date + slot seed) — same for everyone.
 * ─────────────────────────────────────────────────────────────
 */

import { SaveService } from './SaveService';

const KEY = 'ci_flash_challenge';
const SLOT_MS    = 2 * 60 * 60 * 1000;  // 2-hour slots
const ACTIVE_MS  = 60 * 60 * 1000;      // active for first 60 minutes of slot

export type ChallengeType =
  | 'win_3'           // win 3 battles
  | 'win_streak_2'    // win 2 in a row
  | 'perfect_win'     // win with ≥ 95% HP
  | 'combo_5'         // hit combo ×5
  | 'clutch_win'      // win with < 20% HP
  | 'tower_boss'      // defeat a tower boss
  | 'win_5'           // win 5 battles
  | 'win_no_loss';    // win 2 without taking HP damage

export interface FlashChallenge {
  type:        ChallengeType;
  label:       string;
  target:      number;   // how many events needed to complete
  crystals:    number;
  icon:        string;
  slotKey:     string;   // 'YYYY-MM-DD-HH' (2-hr slot, even hours)
}

const CHALLENGE_POOL: Array<Omit<FlashChallenge, 'slotKey'>> = [
  { type: 'win_3',        label: '3 Siege erringen',            target: 3, crystals: 400, icon: '⚔️' },
  { type: 'win_5',        label: '5 Siege erringen',            target: 5, crystals: 700, icon: '🏆' },
  { type: 'win_streak_2', label: '2 Siege in Folge',            target: 2, crystals: 350, icon: '🔥' },
  { type: 'perfect_win',  label: 'Perfekter Sieg erreichen',    target: 1, crystals: 500, icon: '✨' },
  { type: 'combo_5',      label: 'Kombo ×5 erzielen',           target: 1, crystals: 450, icon: '🌪️' },
  { type: 'clutch_win',   label: 'Sieg mit < 20% HP',           target: 1, crystals: 550, icon: '💥' },
  { type: 'tower_boss',   label: 'Einen Turm-Boss bezwingen',   target: 1, crystals: 600, icon: '💀' },
  { type: 'win_no_loss',  label: '2 Siege ohne HP-Verlust',     target: 2, crystals: 500, icon: '🛡️' },
];

function slotKey(): string {
  const now = new Date();
  const slotHour = Math.floor(now.getUTCHours() / 2) * 2;
  return `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${slotHour}`;
}

function seededPick(seed: string): Omit<FlashChallenge, 'slotKey'> {
  let h = 0;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(31, h) + seed.charCodeAt(i); }
  h = h >>> 0;
  return CHALLENGE_POOL[h % CHALLENGE_POOL.length]!;
}

export function getActiveChallenge(): FlashChallenge {
  const key = slotKey();
  const base = seededPick(key);
  return { ...base, slotKey: key };
}

/** Returns true if we're within the active window (first 60 min of 2-hour slot). */
export function isActive(): boolean {
  const now = new Date();
  const slotStart = Math.floor(now.getTime() / SLOT_MS) * SLOT_MS;
  return (now.getTime() - slotStart) < ACTIVE_MS;
}

/** Ms remaining in the current active window (0 if not active). */
export function msRemaining(): number {
  if (!isActive()) return 0;
  const now = Date.now();
  const slotStart = Math.floor(now / SLOT_MS) * SLOT_MS;
  return Math.max(0, slotStart + ACTIVE_MS - now);
}

/** Ms until the next challenge starts. */
export function msUntilNext(): number {
  const now = Date.now();
  const nextSlot = (Math.floor(now / SLOT_MS) + 1) * SLOT_MS;
  return nextSlot - now;
}

interface ChallengeState {
  slotKey:   string;
  progress:  number;
  completed: boolean;
  claimed:   boolean;
}

function load(): ChallengeState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { slotKey: '', progress: 0, completed: false, claimed: false };
    const st = JSON.parse(raw) as ChallengeState;
    if (st.slotKey !== slotKey()) return { slotKey: slotKey(), progress: 0, completed: false, claimed: false };
    return st;
  } catch { return { slotKey: slotKey(), progress: 0, completed: false, claimed: false }; }
}

function save(st: ChallengeState): void {
  try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* ignore */ }
}

export function getProgress(): number { return load().progress; }
export function isCompleted(): boolean { return load().completed; }
export function isClaimed(): boolean { return load().claimed; }

/**
 * Record a challenge event. Returns crystals awarded if this event completes the challenge.
 * @param type - the event type to record
 */
export function recordEvent(type: ChallengeType): number {
  if (!isActive()) return 0;
  const challenge = getActiveChallenge();
  if (challenge.type !== type) return 0;

  const st = load();
  if (st.completed) return 0;

  st.progress += 1;
  if (st.progress >= challenge.target) {
    st.completed = true;
    st.claimed   = true;
    save(st);
    const gs = SaveService.loadGachaState();
    SaveService.saveGachaState({ ...gs, crystals: gs.crystals + challenge.crystals });
    return challenge.crystals;
  }
  save(st);
  return 0;
}

export const FlashChallengeService = {
  getActiveChallenge,
  isActive,
  msRemaining,
  msUntilNext,
  getProgress,
  isCompleted,
  isClaimed,
  recordEvent,
};
