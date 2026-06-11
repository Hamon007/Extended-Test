/**
 * DailyBossService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Each UTC day a unique super-powered boss appears in the battle lobby.
 * Defeating it once grants a large crystal bonus. Creates daily must-play.
 * Boss is seeded from the date — same enemy for all players all day.
 * ─────────────────────────────────────────────────────────────
 */

import type { EnemyData } from '../types/BattleTypes';
import { EnemyDatabase } from './EnemyDatabase';
import { SaveService } from './SaveService';

const KEY = 'ci_daily_boss';

export const DAILY_BOSS_REWARD = 1500;
export const DAILY_BOSS_HP_MULT = 2.0;
export const DAILY_BOSS_ATK_MULT = 1.6;

const BOSS_TITLES = [
  'Erzfeind', 'Schwarzdämon', 'Schrecken des Turms', 'Vernichter',
  'Todesbote', 'Chaosherr', 'Schattenfürst', 'Ewiger Feind',
];

interface DailyBossState {
  dateKey:   string; // 'YYYY-MM-DD'
  defeated:  boolean;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function load(): DailyBossState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { dateKey: todayKey(), defeated: false };
    const st = JSON.parse(raw) as DailyBossState;
    if (st.dateKey !== todayKey()) return { dateKey: todayKey(), defeated: false };
    return st;
  } catch { return { dateKey: todayKey(), defeated: false }; }
}

function save(st: DailyBossState): void {
  try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* ignore */ }
}

function dateHash(): number {
  const d = new Date();
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

function seededIdx(seed: number, len: number): number {
  let s = seed;
  s ^= s << 13; s ^= s >> 17; s ^= s << 5;
  return Math.abs(s >>> 0) % len;
}

/** Returns today's boss as an enhanced EnemyData (scaled stats). */
export function getDailyBoss(): EnemyData | null {
  EnemyDatabase.init();
  const tier3 = EnemyDatabase.getByTier(3);
  const tier2 = EnemyDatabase.getByTier(2);
  const candidates = tier3.length > 0 ? tier3 : tier2;
  if (candidates.length === 0) return null;

  const h = dateHash();
  const base = candidates[seededIdx(h * 7919, candidates.length)]!;
  const titleIdx = seededIdx(h * 3137, BOSS_TITLES.length);

  return {
    ...base,
    id: `daily_boss_${base.id}`,
    name: `${BOSS_TITLES[titleIdx]}: ${base.name}`,
    stats: {
      ...base.stats,
      hp: Math.round(base.stats.hp * DAILY_BOSS_HP_MULT),
    },
    // Boost all enemy card ATK values
    cards: base.cards.map(c => ({
      ...c,
      atk: Math.round(c.atk * DAILY_BOSS_ATK_MULT),
    })),
  };
}

export function isDefeatedToday(): boolean {
  return load().defeated;
}

/** Call after player wins the daily boss battle. Awards crystals. Returns reward amount. */
export function claimVictory(): number {
  const st = load();
  if (st.defeated) return 0;
  st.defeated = true;
  save(st);

  const gs = SaveService.loadGachaState();
  SaveService.saveGachaState({ ...gs, crystals: gs.crystals + DAILY_BOSS_REWARD });
  return DAILY_BOSS_REWARD;
}

export const DailyBossService = {
  getDailyBoss,
  isDefeatedToday,
  claimVictory,
  DAILY_BOSS_REWARD,
};
