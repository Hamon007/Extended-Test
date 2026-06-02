/**
 * AchievementService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Einmalige Meilensteine mit Kristall-Belohnungen.
 * Fortschritt wird lokal persistiert.
 * ─────────────────────────────────────────────────────────────
 */

import { SaveService } from './SaveService';
import { RelicService } from './RelicService';

// Achievement → Relic mapping (unlocking an achievement also unlocks a relic)
const ACHIEVEMENT_RELIC: Partial<Record<AchievementId, string>> = {
  first_win:      'golden_eye',
  wins_10:        'bloody_blade',
  wins_50:        'iron_will',
  first_ssr:      'element_soul',
  tower_10:       'tower_spirit',
  win_streak_5:   'victor_spirit',
  pvp_first_win:  'eternal_warrior',
  cards_20:       'collector_greed',
  first_lr:       'legend_heart',
  combo_master:   'combo_master_relic',
};

// Lazy import to avoid circular dependency — set by App.tsx on mount
let _toastFn: ((def: AchievementDef) => void) | null = null;
export function registerToastFn(fn: (def: AchievementDef) => void): void {
  _toastFn = fn;
}

// ── Typen ─────────────────────────────────────────────────────

export type AchievementId =
  | 'first_win'
  | 'wins_10'
  | 'wins_50'
  | 'wins_100'
  | 'combo_5'
  | 'combo_master'
  | 'first_ssr'
  | 'first_lr'
  | 'deck_complete'
  | 'tower_10'
  | 'tower_30'
  | 'tower_50'
  | 'first_awakening'
  | 'pvp_first_win'
  | 'pvp_10_wins'
  | 'cards_20'
  | 'cards_50'
  | 'streak_7'
  | 'streak_30'
  | 'first_fusion'
  | 'win_streak_5'
  | 'win_streak_10'
  | 'shop_first'
  | 'shop_regular'
  | 'expedition_first'
  | 'expedition_master'
  | 'season_fighter'
  | 'season_champion'
  | 'season_legend'
  | 'login_7'
  | 'login_30'
  | 'combo_10'
  | 'tower_100';

export interface AchievementDef {
  id:          AchievementId;
  title:       string;
  description: string;
  icon:        string;
  crystals:    number;
  hidden?:     boolean;        // nur anzeigen wenn freigeschaltet
  targetValue?: number;        // für Progress-Achievements
  category:    'combat' | 'collection' | 'progression' | 'social';
}

export interface AchievementProgress {
  id:        AchievementId;
  current:   number;
  unlocked:  boolean;
  claimed:   boolean;
  unlockedAt?: number;  // timestamp
}

export interface AchievementState {
  progress: Partial<Record<AchievementId, AchievementProgress>>;
}

// ── Definitionen ──────────────────────────────────────────────

export const ACHIEVEMENTS: AchievementDef[] = [
  // Combat
  {
    id: 'first_win', title: 'Erster Sieg', icon: '⚔️',
    description: 'Gewinne deinen ersten Kampf.',
    crystals: 100, category: 'combat',
  },
  {
    id: 'wins_10', title: 'Kämpfer', icon: '🗡️',
    description: '10 Kämpfe gewonnen.',
    crystals: 150, targetValue: 10, category: 'combat',
  },
  {
    id: 'wins_50', title: 'Veteran', icon: '🏆',
    description: '50 Kämpfe gewonnen.',
    crystals: 300, targetValue: 50, category: 'combat',
  },
  {
    id: 'wins_100', title: 'Unsterblicher', icon: '💀',
    description: '100 Kämpfe gewonnen.',
    crystals: 600, targetValue: 100, category: 'combat',
  },
  {
    id: 'combo_5', title: 'Kombo-Einsteiger', icon: '🔥',
    description: 'Erreiche Kombo ×5.',
    crystals: 100, category: 'combat',
  },
  {
    id: 'combo_master', title: 'Kombo-Meister', icon: '🌪️',
    description: 'Erreiche Kombo ×5 in 5 verschiedenen Kämpfen.',
    crystals: 250, targetValue: 5, category: 'combat',
  },
  {
    id: 'win_streak_5', title: 'Auf einer Welle', icon: '🌊',
    description: '5 Siege in Folge ohne Niederlage.',
    crystals: 200, category: 'combat',
  },
  {
    id: 'win_streak_10', title: 'Unaufhaltbar', icon: '⚡',
    description: '10 Siege in Folge ohne Niederlage.',
    crystals: 500, category: 'combat',
  },
  // Collection
  {
    id: 'first_ssr', title: 'Seltener Fund', icon: '✨',
    description: 'Erhalte eine SSR-Karte.',
    crystals: 150, category: 'collection',
  },
  {
    id: 'first_lr', title: 'Legendäre Macht', icon: '🌟',
    description: 'Erhalte eine LR-Karte (durch Beschwörung oder Fusion).',
    crystals: 500, category: 'collection',
  },
  {
    id: 'cards_20', title: 'Sammler', icon: '📦',
    description: '20 verschiedene Karten in der Sammlung.',
    crystals: 150, targetValue: 20, category: 'collection',
  },
  {
    id: 'cards_50', title: 'Archivar', icon: '📚',
    description: '50 Karten insgesamt gesammelt.',
    crystals: 300, targetValue: 50, category: 'collection',
  },
  {
    id: 'deck_complete', title: 'Meister-Formation', icon: '🃏',
    description: 'Stelle ein vollständiges 10-Karten-Deck zusammen.',
    crystals: 200, category: 'collection',
  },
  {
    id: 'first_fusion', title: 'Alchemist', icon: '🔮',
    description: 'Führe deine erste Karten-Fusion durch.',
    crystals: 100, category: 'collection',
  },
  {
    id: 'first_awakening', title: 'Erwachtes Potential', icon: '💥',
    description: 'Erwecke eine Karte zur True Awakening.',
    crystals: 250, category: 'collection',
  },
  // Progression
  {
    id: 'tower_10', title: 'Turmkleterer', icon: '🗼',
    description: 'Erreiche Etage 10 im Turm der Prüfung.',
    crystals: 200, category: 'progression',
  },
  {
    id: 'tower_30', title: 'Turmbezwinger', icon: '🏰',
    description: 'Erreiche Etage 30 im Turm der Prüfung.',
    crystals: 400, category: 'progression',
  },
  {
    id: 'tower_50', title: 'Turmgipfel', icon: '🌌',
    description: 'Erreiche Etage 50 im Turm der Prüfung.',
    crystals: 800, hidden: true, category: 'progression',
  },
  {
    id: 'streak_7', title: 'Treuer Schüler', icon: '📅',
    description: '7 Tage in Folge eingeloggt.',
    crystals: 300, category: 'progression',
  },
  {
    id: 'streak_30', title: 'Codex-Devotee', icon: '🔱',
    description: '30 Tage in Folge eingeloggt.',
    crystals: 1000, hidden: true, category: 'progression',
  },
  // Social
  {
    id: 'pvp_first_win', title: 'PvP-Debut', icon: '⚔️',
    description: 'Gewinne deinen ersten PvP-Kampf.',
    crystals: 200, category: 'social',
  },
  {
    id: 'pvp_10_wins', title: 'Arena-Rivale', icon: '🎖️',
    description: '10 PvP-Kämpfe gewonnen.',
    crystals: 500, targetValue: 10, category: 'social',
  },
  // ── Shop ──
  {
    id: 'shop_first', title: 'Erster Kauf', icon: '🛒',
    description: 'Kaufe deinen ersten Artikel im Laden.',
    crystals: 150, category: 'progression',
  },
  {
    id: 'shop_regular', title: 'Stammkunde', icon: '🏪',
    description: '10 Artikel im Laden gekauft.',
    crystals: 400, targetValue: 10, category: 'progression',
  },
  // ── Expedition ──
  {
    id: 'expedition_first', title: 'Aufbruch ins Unbekannte', icon: '⚔',
    description: 'Schließe deine erste Expedition ab.',
    crystals: 200, category: 'progression',
  },
  {
    id: 'expedition_master', title: 'Expeditionsmeister', icon: '🗺️',
    description: '10 Expeditionen abgeschlossen.',
    crystals: 800, targetValue: 10, category: 'progression',
  },
  // ── Season Ranks ──
  {
    id: 'season_fighter', title: 'Kämpfer', icon: '◆',
    description: 'Erreiche den Saison-Rang "Kämpfer".',
    crystals: 200, category: 'progression',
  },
  {
    id: 'season_champion', title: 'Champion der Saison', icon: '🏅',
    description: 'Erreiche den Saison-Rang "Champion".',
    crystals: 1000, category: 'progression',
  },
  {
    id: 'season_legend', title: 'Lebende Legende', icon: '🔥',
    description: 'Erreiche den Saison-Rang "Legende".',
    crystals: 3000, category: 'progression',
  },
  // ── Login Streak ──
  {
    id: 'login_7', title: 'Treuer Kämpfer', icon: '📅',
    description: '7 Tage in Folge eingeloggt.',
    crystals: 500, targetValue: 7, category: 'progression',
  },
  {
    id: 'login_30', title: 'Geweihter des Turms', icon: '🌟',
    description: '30 Tage insgesamt eingeloggt.',
    crystals: 2500, targetValue: 30, category: 'progression',
  },
  // ── Extended Combat ──
  {
    id: 'combo_10', title: 'Kombo-Gott', icon: '💥',
    description: 'Erreiche eine 10er-Kombo in einem Kampf.',
    crystals: 600, category: 'combat',
  },
  {
    id: 'tower_100', title: 'Ewiger Aufsteiger', icon: '🗼',
    description: 'Erreiche Etage 100 im Turm.',
    crystals: 5000, category: 'progression',
  },
];

// ── Storage ───────────────────────────────────────────────────

const KEY = 'ci_achievements';

function loadState(): AchievementState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { progress: {} };
    return JSON.parse(raw) as AchievementState;
  } catch {
    return { progress: {} };
  }
}

function saveState(st: AchievementState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(st));
  } catch { /* ignore */ }
}

function getProgress(id: AchievementId): AchievementProgress {
  const st = loadState();
  return st.progress[id] ?? { id, current: 0, unlocked: false, claimed: false };
}

// ── Unlock-Logik ──────────────────────────────────────────────

/** Gibt true zurück wenn die Achievement gerade NEU freigeschaltet wurde. */
function recordProgress(id: AchievementId, increment = 1): boolean {
  const def = ACHIEVEMENTS.find(a => a.id === id);
  if (!def) return false;

  const st   = loadState();
  const prev = st.progress[id] ?? { id, current: 0, unlocked: false, claimed: false };
  if (prev.unlocked) return false;

  const newCurrent = prev.current + increment;
  const target     = def.targetValue ?? 1;
  const unlocked   = newCurrent >= target;

  const newlyUnlocked = unlocked && !prev.unlocked;
  const updated: AchievementProgress = {
    ...prev,
    current:    newCurrent,
    unlocked,
    unlockedAt: unlocked ? Date.now() : prev.unlockedAt,
  };

  st.progress[id] = updated;
  saveState(st);

  // Fire toast notification when newly unlocked
  if (newlyUnlocked && _toastFn) _toastFn(def);

  // Unlock associated relic
  if (newlyUnlocked) {
    const relicId = ACHIEVEMENT_RELIC[id];
    if (relicId) RelicService.unlock(relicId);
  }

  return newlyUnlocked;
}

/**
 * Gibt Kristalle für eine freigeschaltete Achievement aus.
 * Gibt 0 zurück wenn nicht freigeschaltet oder bereits geclaimed.
 */
function claim(id: AchievementId): number {
  const def = ACHIEVEMENTS.find(a => a.id === id);
  if (!def) return 0;

  const st   = loadState();
  const prog = st.progress[id];
  if (!prog?.unlocked || prog.claimed) return 0;

  st.progress[id] = { ...prog, claimed: true };
  saveState(st);

  // Kristalle hinzufügen
  const gs = SaveService.loadGachaState();
  SaveService.saveGachaState({ ...gs, crystals: gs.crystals + def.crystals });

  return def.crystals;
}

function claimAll(): number {
  const st = loadState();
  let total = 0;
  let crystalsToAdd = 0;

  for (const def of ACHIEVEMENTS) {
    const prog = st.progress[def.id];
    if (prog?.unlocked && !prog.claimed) {
      st.progress[def.id] = { ...prog, claimed: true };
      crystalsToAdd += def.crystals;
      total += def.crystals;
    }
  }

  if (crystalsToAdd > 0) {
    saveState(st);
    const gs = SaveService.loadGachaState();
    SaveService.saveGachaState({ ...gs, crystals: gs.crystals + crystalsToAdd });
  }
  return total;
}

function getAll(): { def: AchievementDef; progress: AchievementProgress }[] {
  const st = loadState();
  return ACHIEVEMENTS.map(def => ({
    def,
    progress: st.progress[def.id] ?? { id: def.id, current: 0, unlocked: false, claimed: false },
  }));
}

function getUnclaimedCount(): number {
  const st = loadState();
  return ACHIEVEMENTS.filter(def => {
    const prog = st.progress[def.id];
    return prog?.unlocked && !prog.claimed;
  }).length;
}

/** Alle neu freigeschalteten Achievement-IDs (noch nicht geclaimed) */
function getNewlyUnlocked(): AchievementId[] {
  const st = loadState();
  return ACHIEVEMENTS
    .filter(def => {
      const prog = st.progress[def.id];
      return prog?.unlocked && !prog.claimed;
    })
    .map(def => def.id);
}

export const AchievementService = {
  recordProgress,
  claim,
  claimAll,
  getAll,
  getProgress,
  getUnclaimedCount,
  getNewlyUnlocked,
  ACHIEVEMENTS,
};
