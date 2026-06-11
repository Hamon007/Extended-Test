/**
 * SessionBonusService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Tracks wins within a single app session (in-memory only —
 * resets when the page reloads). Awards one-time bonus crystals
 * at milestone win counts, driving longer single-session play.
 *
 * Checkpoints: 3 → 5 → 7 → 10 wins in one session.
 * ─────────────────────────────────────────────────────────────
 */

import { SaveService } from './SaveService';

export interface SessionMilestone {
  wins:     number;
  crystals: number;
  label:    string;
  icon:     string;
}

export const SESSION_MILESTONES: SessionMilestone[] = [
  { wins:  3, crystals: 100,  label: 'Fleiß',        icon: '⚡' },
  { wins:  5, crystals: 200,  label: 'Ausdauer',      icon: '🔥' },
  { wins:  7, crystals: 500,  label: 'Meisterschaft', icon: '💫' },
  { wins: 10, crystals: 1000, label: 'MARATHON',      icon: '🏆' },
];

// In-memory state — session-scoped (resets on page load)
let sessionWins = 0;
const claimedMilestones = new Set<number>();

export const SessionBonusService = {
  /** Call on each victory. Returns the milestone bonus earned (or null). */
  recordWin(): SessionMilestone | null {
    sessionWins += 1;

    for (const m of SESSION_MILESTONES) {
      if (sessionWins === m.wins && !claimedMilestones.has(m.wins)) {
        claimedMilestones.add(m.wins);
        // Apply crystals immediately
        const gs = SaveService.loadGachaState();
        SaveService.saveGachaState({ ...gs, crystals: gs.crystals + m.crystals });
        void SaveService.uploadSave();
        return m;
      }
    }
    return null;
  },

  getSessionWins(): number {
    return sessionWins;
  },

  /** The next unclaimed milestone the player is working toward. */
  getNextMilestone(): SessionMilestone | null {
    return SESSION_MILESTONES.find(m => !claimedMilestones.has(m.wins) && m.wins > sessionWins) ?? null;
  },

  reset(): void {
    sessionWins = 0;
    claimedMilestones.clear();
  },
};
