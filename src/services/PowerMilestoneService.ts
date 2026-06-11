/**
 * PowerMilestoneService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Fires a celebratory milestone when the player's deck power
 * score crosses predefined thresholds for the first time.
 * ─────────────────────────────────────────────────────────────
 */

const KEY = 'ci_power_milestone';

const MILESTONES = [
  { threshold: 1_000,   label: '1.000',   icon: '⚡', tier: 'bronze' },
  { threshold: 2_500,   label: '2.500',   icon: '⚡', tier: 'bronze' },
  { threshold: 5_000,   label: '5.000',   icon: '🔥', tier: 'silver' },
  { threshold: 10_000,  label: '10.000',  icon: '🔥', tier: 'silver' },
  { threshold: 25_000,  label: '25.000',  icon: '💥', tier: 'gold'   },
  { threshold: 50_000,  label: '50.000',  icon: '💥', tier: 'gold'   },
  { threshold: 100_000, label: '100.000', icon: '👑', tier: 'legend' },
  { threshold: 200_000, label: '200.000', icon: '👑', tier: 'legend' },
] as const;

export type MilestoneTier = 'bronze' | 'silver' | 'gold' | 'legend';

export interface PowerMilestone {
  label:  string;
  icon:   string;
  tier:   MilestoneTier;
}

function getHighest(): number {
  try {
    return parseInt(localStorage.getItem(KEY) ?? '0', 10);
  } catch {
    return 0;
  }
}

function setHighest(v: number): void {
  try { localStorage.setItem(KEY, String(v)); } catch { /* ignore */ }
}

/** Call when deckPower is known. Returns first newly-crossed milestone or null. */
function check(currentPower: number): PowerMilestone | null {
  const prev = getHighest();
  if (currentPower <= prev) return null;

  setHighest(currentPower);

  // Find the highest threshold just crossed that was above prev
  let hit: PowerMilestone | null = null;
  for (const m of MILESTONES) {
    if (currentPower >= m.threshold && prev < m.threshold) {
      hit = { label: m.label, icon: m.icon, tier: m.tier };
    }
  }
  return hit;
}

export const PowerMilestoneService = { check };
