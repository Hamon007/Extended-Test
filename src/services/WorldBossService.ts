/**
 * WorldBossService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Weekly World Boss event: a shared enemy that the entire "server"
 * fights together. Damage contributions from individual battles feed
 * into a global HP pool. When the boss dies (HP ≤ 0), all participants
 * receive a crystal reward (claimable once).
 *
 * Simulation: other players' damage is seeded so it's deterministic
 * but feels like a living server — the bar visibly drops over time
 * even without the player doing anything.
 * ─────────────────────────────────────────────────────────────
 */

import { SaveService } from './SaveService';

const BOSS_MAX_HP   = 10_000_000;  // 10 M total HP
const PLAYER_DAMAGE_FACTOR = 0.08; // 8% of battle damage → boss contribution
const SIM_DPS_PER_HOUR = 420_000;  // simulated server deals ~420 K/h
const REWARD_CRYSTALS   = 1_200;   // reward for any participation

export interface WorldBossState {
  weekKey:      string;   // ISO week string (YYYY-Www)
  playerDamage: number;   // cumulative damage player contributed
  claimed:      boolean;
}

const KEY = 'ci_world_boss';

function getWeekKey(): string {
  const d = new Date();
  // ISO week: starts Monday
  const dayOfWeek = (d.getUTCDay() + 6) % 7; // 0 = Mon
  const startOfWeek = new Date(d);
  startOfWeek.setUTCDate(d.getUTCDate() - dayOfWeek);
  startOfWeek.setUTCHours(0, 0, 0, 0);
  const y = startOfWeek.getUTCFullYear();
  const week = Math.ceil((((startOfWeek.getTime() - new Date(y, 0, 1).getTime()) / 86400000) + 1) / 7);
  return `${y}-W${String(week).padStart(2, '0')}`;
}

function getWeekStartMs(): number {
  const d = new Date();
  const dayOfWeek = (d.getUTCDay() + 6) % 7;
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() - dayOfWeek);
  start.setUTCHours(0, 0, 0, 0);
  return start.getTime();
}

function loadState(): WorldBossState {
  const week = getWeekKey();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WorldBossState;
      if (parsed.weekKey === week) return parsed;
    }
  } catch { /* ignore */ }
  return { weekKey: week, playerDamage: 0, claimed: false };
}

function saveState(st: WorldBossState): void {
  try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* ignore */ }
}

/** Simulated global damage since this week started (based on elapsed time). */
function simulatedGlobalDamage(): number {
  const elapsed = (Date.now() - getWeekStartMs()) / 3_600_000; // hours
  return Math.round(SIM_DPS_PER_HOUR * elapsed);
}

export const WorldBossService = {
  /** Boss name and lore change each week based on weekKey seed. */
  getBossName(): string {
    const names = [
      'Abaddon, König des Abgrunds',
      'Chronovore, Fresserin der Zeit',
      'Malphas, Fürst der Dämonen',
      'Nergal, Herr der Unterwelt',
      'Valefar, Fürst der Seelen',
      'Paimon, König der Westwinde',
      'Zagan, Fürst der Täuschung',
    ];
    const week = getWeekKey();
    let h = 0;
    for (let i = 0; i < week.length; i++) h = (h * 31 + week.charCodeAt(i)) >>> 0;
    return names[h % names.length]!;
  },

  getBossIcon(): string {
    const icons = ['💀', '🔥', '🌑', '⚡', '🔮', '🌪️', '☠️'];
    const week = getWeekKey();
    let h = 0;
    for (let i = 0; i < week.length; i++) h = (h * 31 + week.charCodeAt(i)) >>> 0;
    return icons[h % icons.length]!;
  },

  /** Current boss HP (0 = dead). Factors in sim + player damage. */
  getCurrentHp(): number {
    const st  = loadState();
    const sim = simulatedGlobalDamage();
    return Math.max(0, BOSS_MAX_HP - sim - st.playerDamage);
  },

  /** HP fraction 0-1. */
  getHpPct(): number {
    return WorldBossService.getCurrentHp() / BOSS_MAX_HP;
  },

  /** Player's total accumulated damage contribution (for display). */
  getPlayerDamage(): number {
    return loadState().playerDamage;
  },

  /** True when boss is dead this week. */
  isDead(): boolean {
    return WorldBossService.getCurrentHp() <= 0;
  },

  /** True if reward is available (boss dead, not yet claimed). */
  canClaim(): boolean {
    return WorldBossService.isDead() && !loadState().claimed;
  },

  /** Record battle damage — contributions 8% of total player damage in a battle. */
  recordBattleDamage(totalBattleDamage: number): void {
    if (totalBattleDamage <= 0) return;
    const contrib = Math.round(totalBattleDamage * PLAYER_DAMAGE_FACTOR);
    if (contrib <= 0) return;
    const st = loadState();
    st.playerDamage += contrib;
    saveState(st);
  },

  /** Claim crystal reward. Returns crystals awarded (0 if already claimed or boss alive). */
  claimReward(): number {
    if (!WorldBossService.canClaim()) return 0;
    const st = loadState();
    st.claimed = true;
    saveState(st);
    const gs = SaveService.loadGachaState();
    SaveService.saveGachaState({ ...gs, crystals: gs.crystals + REWARD_CRYSTALS });
    void SaveService.uploadSave();
    return REWARD_CRYSTALS;
  },

  BOSS_MAX_HP,
  REWARD_CRYSTALS,
  PLAYER_DAMAGE_FACTOR,

  getWeekKey,
};
