/**
 * BossRushService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Boss Rush: 5 escalating wave gauntlet. No energy cost.
 * Available once per day. Player HP carries over between waves.
 * ─────────────────────────────────────────────────────────────
 */

import type { EnemyData } from '../types/BattleTypes';
import { EnemyDatabase } from './EnemyDatabase';

const KEY = 'ci_boss_rush_date';

export const BOSS_RUSH_WAVES = 5;

export const BOSS_RUSH_CRYSTAL_REWARDS: Record<number, number> = {
  1: 80,
  2: 160,
  3: 300,
  4: 550,
  5: 1200,
};

export const BOSS_RUSH_COMPLETION_BONUS = 2500;

// Per-wave enemy scaling: [enemyId, hpMult, atkMult, label]
const WAVE_CONFIG: Array<{ id: string; hpMult: number; atkMult: number; label: string }> = [
  { id: 'shadow_captain',  hpMult: 1.0, atkMult: 1.0, label: 'Welle 1 — Vorhut' },
  { id: 'shadow_captain',  hpMult: 1.6, atkMult: 1.4, label: 'Welle 2 — Verstärkung' },
  { id: 'infernal_warlord',hpMult: 1.0, atkMult: 1.0, label: 'Welle 3 — Elitesoldat' },
  { id: 'infernal_warlord',hpMult: 1.5, atkMult: 1.5, label: 'Welle 4 — Kriegsherr' },
  { id: 'void_sentinel',   hpMult: 1.4, atkMult: 1.4, label: 'Welle 5 — Endgegner' },
];

function todayKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

function canAttempt(): boolean {
  return localStorage.getItem(KEY) !== todayKey();
}

function recordAttempt(): void {
  localStorage.setItem(KEY, todayKey());
}

function getWave(waveIndex: number): EnemyData | null {
  const cfg = WAVE_CONFIG[waveIndex - 1];
  if (!cfg) return null;

  const base = EnemyDatabase.getById(cfg.id);
  if (!base) return null;

  return {
    ...base,
    name:  `[W${waveIndex}] ${base.name}`,
    stats: {
      ...base.stats,
      hp: Math.round(base.stats.hp * cfg.hpMult),
    },
    cards: base.cards.map(c => ({
      ...c,
      atk: Math.round(c.atk * cfg.atkMult),
      hp:  Math.round(c.hp  * cfg.hpMult),
    })),
    rewardCrystals: BOSS_RUSH_CRYSTAL_REWARDS[waveIndex] ?? 0,
    rewardXp:       Math.round(base.rewardXp * (0.5 + waveIndex * 0.3)),
  };
}

export const BossRushService = {
  canAttempt,
  recordAttempt,
  getWave,
  BOSS_RUSH_WAVES,
  BOSS_RUSH_CRYSTAL_REWARDS,
  BOSS_RUSH_COMPLETION_BONUS,
};
