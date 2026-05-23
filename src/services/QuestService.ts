// ─────────────────────────────────────────────────────────────────────────────
// QuestService.ts  –  Codex Immortalis
// Turm-Aufgaben (Tower of God inspired)
// ─────────────────────────────────────────────────────────────────────────────

import { SaveService } from './SaveService';

export type QuestType =
  | 'reach_floor'
  | 'defeat_boss'
  | 'defeat_elite'
  | 'win_battles'
  | 'win_no_damage'
  | 'play_combos'
  | 'collect_cards'
  | 'use_synergy';

export interface QuestDefinition {
  id:          string;
  title:       string;
  description: string;
  type:        QuestType;
  target:      number;
  crystalReward: number;
  xpReward:    number;
}

export interface QuestProgress {
  questId:   string;
  current:   number;
  completed: boolean;
  claimed:   boolean;
}

export interface QuestState {
  daily:    QuestProgress[];
  weekly:   QuestProgress[];
  lastDailyReset:  string; // ISO date string
  lastWeeklyReset: string;
}

// ── Quest-Definitionen ────────────────────────────────────────

const DAILY_QUEST_POOL: QuestDefinition[] = [
  {
    id: 'daily_win_3',
    title: 'Aufsteiger',
    description: '3 Etagen im Turm abschließen',
    type: 'win_battles',
    target: 3,
    crystalReward: 150,
    xpReward: 200,
  },
  {
    id: 'daily_floor_5',
    title: 'Turmkletterer',
    description: 'Etage 5 oder höher betreten',
    type: 'reach_floor',
    target: 5,
    crystalReward: 100,
    xpReward: 150,
  },
  {
    id: 'daily_combo',
    title: 'Kombomeister',
    description: '5 Kombos in Kämpfen erzielen',
    type: 'play_combos',
    target: 5,
    crystalReward: 120,
    xpReward: 180,
  },
  {
    id: 'daily_synergy',
    title: 'Synergie-Jäger',
    description: '3 Synergie-Aktivierungen auslösen',
    type: 'use_synergy',
    target: 3,
    crystalReward: 130,
    xpReward: 160,
  },
  {
    id: 'daily_win_5',
    title: 'Unaufhaltsam',
    description: '5 Kämpfe gewinnen',
    type: 'win_battles',
    target: 5,
    crystalReward: 200,
    xpReward: 250,
  },
];

const WEEKLY_QUEST_POOL: QuestDefinition[] = [
  {
    id: 'weekly_floor_10',
    title: 'Prüfling des Turms',
    description: 'Etage 10 erreichen und den ersten Boss besiegen',
    type: 'defeat_boss',
    target: 1,
    crystalReward: 500,
    xpReward: 800,
  },
  {
    id: 'weekly_floor_20',
    title: 'Bezwinger der Finsternis',
    description: 'Etage 20 im Turm erreichen',
    type: 'reach_floor',
    target: 20,
    crystalReward: 800,
    xpReward: 1200,
  },
  {
    id: 'weekly_win_15',
    title: 'Krieger des Turms',
    description: '15 Kämpfe im Turm gewinnen',
    type: 'win_battles',
    target: 15,
    crystalReward: 600,
    xpReward: 900,
  },
  {
    id: 'weekly_elite_3',
    title: 'Elite-Jäger',
    description: '3 Elite-Gegner besiegen',
    type: 'defeat_elite',
    target: 3,
    crystalReward: 700,
    xpReward: 1000,
  },
  {
    id: 'weekly_cards_30',
    title: 'Sammlungsmeister',
    description: '30 Karten im Inventar besitzen',
    type: 'collect_cards',
    target: 30,
    crystalReward: 400,
    xpReward: 600,
  },
  {
    id: 'weekly_synergy_10',
    title: 'Meister der Resonanz',
    description: '10 Synergie-Aktivierungen auslösen',
    type: 'use_synergy',
    target: 10,
    crystalReward: 600,
    xpReward: 800,
  },
];

// ── Speicher-Key ──────────────────────────────────────────────

const QUEST_KEY = 'ci_quest_state';

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function thisWeekString(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

function pickQuests(pool: QuestDefinition[], count: number, seed: string): QuestDefinition[] {
  // Deterministic selection based on date seed
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    hash = (hash * 1664525 + 1013904223) >>> 0;
    const j = hash % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

export const QuestService = {
  loadState(): QuestState {
    try {
      const raw = localStorage.getItem(QUEST_KEY);
      if (raw) return JSON.parse(raw) as QuestState;
    } catch { /* ignore */ }
    return {
      daily:  [],
      weekly: [],
      lastDailyReset:  '',
      lastWeeklyReset: '',
    };
  },

  saveState(state: QuestState): void {
    localStorage.setItem(QUEST_KEY, JSON.stringify(state));
  },

  getOrRefreshState(): QuestState {
    let state = QuestService.loadState();
    const today  = todayString();
    const week   = thisWeekString();
    let changed  = false;

    if (state.lastDailyReset !== today) {
      const quests = pickQuests(DAILY_QUEST_POOL, 3, today);
      state.daily = quests.map(q => ({ questId: q.id, current: 0, completed: false, claimed: false }));
      state.lastDailyReset = today;
      changed = true;
    }

    if (state.lastWeeklyReset !== week) {
      const quests = pickQuests(WEEKLY_QUEST_POOL, 3, week);
      state.weekly = quests.map(q => ({ questId: q.id, current: 0, completed: false, claimed: false }));
      state.lastWeeklyReset = week;
      changed = true;
    }

    if (changed) QuestService.saveState(state);
    return state;
  },

  getDailyQuests(): { def: QuestDefinition; progress: QuestProgress }[] {
    const state = QuestService.getOrRefreshState();
    return state.daily.map(p => {
      const def = DAILY_QUEST_POOL.find(q => q.id === p.questId) ?? DAILY_QUEST_POOL[0];
      return { def, progress: p };
    });
  },

  getWeeklyQuests(): { def: QuestDefinition; progress: QuestProgress }[] {
    const state = QuestService.getOrRefreshState();
    return state.weekly.map(p => {
      const def = WEEKLY_QUEST_POOL.find(q => q.id === p.questId) ?? WEEKLY_QUEST_POOL[0];
      return { def, progress: p };
    });
  },

  recordEvent(type: QuestType, amount = 1, extra?: { floor?: number }): void {
    const state = QuestService.getOrRefreshState();
    let changed = false;

    const update = (list: QuestProgress[], pool: QuestDefinition[]) => {
      for (const p of list) {
        if (p.completed) continue;
        const def = pool.find(q => q.id === p.questId);
        if (!def || def.type !== type) continue;

        if (type === 'reach_floor' && extra?.floor !== undefined) {
          if (extra.floor >= def.target) { p.current = def.target; p.completed = true; changed = true; }
        } else if (type === 'collect_cards') {
          const count = SaveService.loadGachaState().inventory.length;
          p.current = count;
          if (count >= def.target) p.completed = true;
          changed = true;
        } else {
          p.current = Math.min(def.target, p.current + amount);
          if (p.current >= def.target) p.completed = true;
          changed = true;
        }
      }
    };

    update(state.daily, DAILY_QUEST_POOL);
    update(state.weekly, WEEKLY_QUEST_POOL);
    if (changed) QuestService.saveState(state);
  },

  claimReward(questId: string): { crystals: number; xp: number } | null {
    const state = QuestService.getOrRefreshState();
    const pools  = [
      { list: state.daily,  defs: DAILY_QUEST_POOL  },
      { list: state.weekly, defs: WEEKLY_QUEST_POOL },
    ];

    for (const { list, defs } of pools) {
      const p = list.find(q => q.questId === questId);
      if (!p || !p.completed || p.claimed) continue;
      const def = defs.find(d => d.id === questId);
      if (!def) continue;

      p.claimed = true;
      QuestService.saveState(state);

      const gs = SaveService.loadGachaState();
      SaveService.saveGachaState({ ...gs, crystals: gs.crystals + def.crystalReward });
      return { crystals: def.crystalReward, xp: def.xpReward };
    }
    return null;
  },
};
