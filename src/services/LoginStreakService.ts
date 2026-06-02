/**
 * LoginStreakService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Tägliche Einlogg-Serie mit eskalierenden Belohnungen.
 * Jeder Tag in Folge gibt mehr Kristalle + Bonusitems.
 * Verpasster Tag bricht die Serie ab (FOMO-Mechanik).
 * ─────────────────────────────────────────────────────────────
 */

import { SaveService } from './SaveService';

// ── Belohnungs-Tabelle (1-basiert, Index = Streak-Tag) ────────

export interface StreakRewardDef {
  day:           number;
  crystals:      number;
  crystalCards?: { size: 'small' | 'medium' | 'large'; count: number };
  label:         string;
  icon:          string;
}

// 30-Tage-Zyklus — danach wiederholt sich Woche 4
export const STREAK_REWARDS: StreakRewardDef[] = [
  { day:  1, crystals: 100,  icon: '💎', label: '100 Kristalle' },
  { day:  2, crystals: 150,  icon: '💎', label: '150 Kristalle' },
  { day:  3, crystals: 200,  icon: '🔮', label: '200💎 + KK', crystalCards: { size: 'small', count: 1 } },
  { day:  4, crystals: 200,  icon: '💎', label: '200 Kristalle' },
  { day:  5, crystals: 300,  icon: '💎', label: '300 Kristalle' },
  { day:  6, crystals: 300,  icon: '💎', label: '300 Kristalle' },
  { day:  7, crystals: 500,  icon: '✨', label: '500💎 + MKK', crystalCards: { size: 'medium', count: 1 } },
  { day:  8, crystals: 150,  icon: '💎', label: '150 Kristalle' },
  { day:  9, crystals: 200,  icon: '💎', label: '200 Kristalle' },
  { day: 10, crystals: 300,  icon: '🔮', label: '300💎 + KK', crystalCards: { size: 'small', count: 1 } },
  { day: 11, crystals: 300,  icon: '💎', label: '300 Kristalle' },
  { day: 12, crystals: 400,  icon: '💎', label: '400 Kristalle' },
  { day: 13, crystals: 400,  icon: '💎', label: '400 Kristalle' },
  { day: 14, crystals: 1000, icon: '🌟', label: '1000💎 + GKK', crystalCards: { size: 'large', count: 1 } },
  { day: 15, crystals: 200,  icon: '💎', label: '200 Kristalle' },
  { day: 16, crystals: 250,  icon: '💎', label: '250 Kristalle' },
  { day: 17, crystals: 350,  icon: '🔮', label: '350💎 + KK', crystalCards: { size: 'small', count: 1 } },
  { day: 18, crystals: 350,  icon: '💎', label: '350 Kristalle' },
  { day: 19, crystals: 500,  icon: '💎', label: '500 Kristalle' },
  { day: 20, crystals: 500,  icon: '✨', label: '500💎 + MKK', crystalCards: { size: 'medium', count: 1 } },
  { day: 21, crystals: 1500, icon: '🌟', label: '1500💎 + 2×MKK', crystalCards: { size: 'medium', count: 2 } },
  { day: 22, crystals: 300,  icon: '💎', label: '300 Kristalle' },
  { day: 23, crystals: 400,  icon: '💎', label: '400 Kristalle' },
  { day: 24, crystals: 500,  icon: '🔮', label: '500💎 + MKK', crystalCards: { size: 'medium', count: 1 } },
  { day: 25, crystals: 500,  icon: '💎', label: '500 Kristalle' },
  { day: 26, crystals: 600,  icon: '💎', label: '600 Kristalle' },
  { day: 27, crystals: 600,  icon: '✨', label: '600💎 + GKK', crystalCards: { size: 'large', count: 1 } },
  { day: 28, crystals: 800,  icon: '💎', label: '800 Kristalle' },
  { day: 29, crystals: 1000, icon: '🌟', label: '1000💎 + GKK', crystalCards: { size: 'large', count: 1 } },
  { day: 30, crystals: 3000, icon: '🔥', label: '3000💎 + 2×GKK!', crystalCards: { size: 'large', count: 2 } },
];

export function getRewardForDay(day: number): StreakRewardDef {
  // Cycle: after 30 days, repeat last week pattern scaled
  const clamped = ((day - 1) % STREAK_REWARDS.length) + 1;
  return STREAK_REWARDS.find(r => r.day === clamped) ?? STREAK_REWARDS[0]!;
}

// ── State ─────────────────────────────────────────────────────

export interface StreakState {
  streak:    number;   // aktuelle Sieges-Tage in Folge
  longest:   number;   // Allzeit-Rekord
  lastDate:  string;   // 'YYYY-MM-DD' des letzten Check-ins
  todayClaimed: boolean;
}

const KEY = 'ci_login_streak';

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function load(): StreakState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { streak: 0, longest: 0, lastDate: '', todayClaimed: false };
    return JSON.parse(raw) as StreakState;
  } catch {
    return { streak: 0, longest: 0, lastDate: '', todayClaimed: false };
  }
}

function save(st: StreakState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(st));
  } catch { /* ignore */ }
}

// ── Öffentliche API ───────────────────────────────────────────

export interface StreakCheckResult {
  newStreak:   number;
  reward:      StreakRewardDef;
  isNewRecord: boolean;
  shouldShow:  boolean;  // true wenn heute noch nicht gezeigt
}

/**
 * Beim App-Start aufrufen.
 * Gibt null zurück wenn heute bereits geclaimed.
 * Gibt Belohnungsdetails zurück wenn neuer Tag → Belohnung sofort anwenden.
 */
function checkAndClaim(): StreakCheckResult | null {
  const st    = load();
  const t     = today();
  const yest  = yesterday();

  if (st.lastDate === t) return null; // Heute schon geclaimed

  // Streak-Berechnung
  const continuing = st.lastDate === yest;
  const newStreak  = continuing ? st.streak + 1 : 1;
  const longest    = Math.max(st.longest, newStreak);

  const reward = getRewardForDay(newStreak);

  // Belohnung anwenden
  const gs = SaveService.loadGachaState();
  const updatedGs = {
    ...gs,
    crystals: gs.crystals + reward.crystals,
    crystalCards: reward.crystalCards
      ? {
          ...gs.crystalCards,
          [reward.crystalCards.size]:
            (gs.crystalCards[reward.crystalCards.size] ?? 0) + reward.crystalCards.count,
        }
      : gs.crystalCards,
  };
  SaveService.saveGachaState(updatedGs);

  const newState: StreakState = { streak: newStreak, longest, lastDate: t, todayClaimed: true };
  save(newState);

  return {
    newStreak,
    reward,
    isNewRecord: newStreak > st.longest && st.longest > 0,
    shouldShow: true,
  };
}

function getState(): StreakState {
  return load();
}

export const LoginStreakService = {
  checkAndClaim,
  getState,
  getRewardForDay,
};
