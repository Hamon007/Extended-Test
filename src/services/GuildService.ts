/**
 * GuildService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Einzel-Spieler Gilden-Mock: feste NPC-Mitglieder, wöchentlicher
 * Guild-Boss, Spendefunktion.
 * ─────────────────────────────────────────────────────────────
 */

import type { BossAttackResult, GuildMember, GuildSaveState } from '../types/GuildTypes';
import type { CardInstance } from '../types/GachaTypes';
import { CardDatabase } from './CardDatabase';
import { FusionSystem } from './FusionSystem';
import { SaveService } from './SaveService';
import { EnergyService } from './EnergyService';
import {
  GUILD_NAME,
  GUILD_BOSS_MAX_HP,
  GUILD_BOSS_ATTACKS,
  GUILD_BOSS_REWARD_CRYSTALS,
  GUILD_BOSS_REWARD_POTIONS,
  GUILD_XP_PER_CRYSTAL,
  GUILD_LEVEL_THRESHOLDS,
  GUILD_BOSS_BASE_DAMAGE,
  GUILD_BOSS_ATK_FACTOR_MIN,
  GUILD_BOSS_ATK_FACTOR_VARIANCE,
} from '../config/GameConfig';

export {
  GUILD_NAME,
  GUILD_BOSS_MAX_HP,
  GUILD_BOSS_ATTACKS,
  GUILD_BOSS_REWARD_CRYSTALS,
  GUILD_BOSS_REWARD_POTIONS,
  GUILD_XP_PER_CRYSTAL,
  GUILD_LEVEL_THRESHOLDS,
};

const STORAGE_KEY = 'ci_guild_state';

// ── NPC-Mitglieder ────────────────────────────────────────────

export const NPC_MEMBERS: GuildMember[] = [
  { id: 'npc_ereshkigal', name: 'Ereshkigal',  role: 'leader',  weeklyContribution: 1200, isPlayer: false },
  { id: 'npc_morrigan',   name: 'Morrigan',     role: 'officer', weeklyContribution:  900, isPlayer: false },
  { id: 'npc_thanatos',   name: 'Thanatos',     role: 'officer', weeklyContribution:  850, isPlayer: false },
  { id: 'npc_nidhogg',    name: 'Nidhogg',      role: 'member',  weeklyContribution:  650, isPlayer: false },
  { id: 'npc_anubis',     name: 'Anubis',       role: 'member',  weeklyContribution:  600, isPlayer: false },
  { id: 'npc_hel',        name: 'Hel',          role: 'member',  weeklyContribution:  580, isPlayer: false },
  { id: 'npc_balor',      name: 'Balor',        role: 'member',  weeklyContribution:  420, isPlayer: false },
  { id: 'npc_medusa',     name: 'Medusa',       role: 'member',  weeklyContribution:  380, isPlayer: false },
];

/** Wöchentliche NPC-Gesamtspenden */
export const NPC_TOTAL_CONTRIBUTION = NPC_MEMBERS.reduce(
  (s, m) => s + m.weeklyContribution, 0,
); // ~5580

// Wochenziel = NPC-Beiträge + 500 Spieler-Beitrag
export const WEEKLY_GOAL = NPC_TOTAL_CONTRIBUTION + 500;

// ── Wochenschlüssel (ISO-Week) ────────────────────────────────

function getWeekKey(): string {
  const d   = new Date();
  const day = d.getDay() === 0 ? 6 : d.getDay() - 1; // Mo=0
  const mon = new Date(d);
  mon.setDate(d.getDate() - day);
  const jan1    = new Date(mon.getFullYear(), 0, 1);
  const weekNum = Math.ceil((((mon.getTime() - jan1.getTime()) / 86_400_000) + jan1.getDay() + 1) / 7);
  return `${mon.getFullYear()}-W${weekNum}`;
}

// ── State-Management ──────────────────────────────────────────

function defaultState(): GuildSaveState {
  const wk = getWeekKey();
  return {
    playerWeeklyContribution: 0,
    lastWeekKey:              wk,
    bossCurrentHp:            GUILD_BOSS_MAX_HP,
    bossAttacksLeft:          GUILD_BOSS_ATTACKS,
    bossResetKey:             wk,
    bossCleared:              false,
    guildXp:                  0,
  };
}

function load(): GuildSaveState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const st = JSON.parse(raw) as GuildSaveState;
    const wk = getWeekKey();

    // Wöchentlicher Reset
    if (st.lastWeekKey !== wk) {
      st.playerWeeklyContribution = 0;
      st.lastWeekKey              = wk;
    }
    if (st.bossResetKey !== wk) {
      st.bossCurrentHp    = GUILD_BOSS_MAX_HP;
      st.bossAttacksLeft  = GUILD_BOSS_ATTACKS;
      st.bossResetKey     = wk;
      st.bossCleared      = false;
    }
    return st;
  } catch {
    return defaultState();
  }
}

function save(st: GuildSaveState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(st));
  } catch (e) {
    console.warn('[GuildService] Speichern fehlgeschlagen:', e);
  }
}

// ── Gildenlevel aus XP ────────────────────────────────────────

export function guildLevel(xp: number): number {
  let lvl = 1;
  for (let i = 1; i < GUILD_LEVEL_THRESHOLDS.length; i++) {
    if (xp >= GUILD_LEVEL_THRESHOLDS[i]) lvl = i + 1;
    else break;
  }
  return Math.min(lvl, GUILD_LEVEL_THRESHOLDS.length);
}

export function xpForNextLevel(xp: number): { current: number; needed: number; pct: number } {
  const lvl  = guildLevel(xp);
  const base = GUILD_LEVEL_THRESHOLDS[lvl - 1] ?? 0;
  const next = GUILD_LEVEL_THRESHOLDS[lvl] ?? GUILD_LEVEL_THRESHOLDS[GUILD_LEVEL_THRESHOLDS.length - 1];
  const span = next - base;
  const prog = xp - base;
  return { current: prog, needed: span, pct: span > 0 ? (prog / span) * 100 : 100 };
}

// ── Spende ────────────────────────────────────────────────────

export function donate(amount: number): boolean {
  const gState  = load();
  const gState2 = SaveService.loadGachaState();

  if (gState2.crystals < amount) return false;

  // Kristalle abziehen
  SaveService.saveGachaState({ ...gState2, crystals: gState2.crystals - amount });

  // Gildenbeitrag + XP erhöhen
  gState.playerWeeklyContribution += amount;
  gState.guildXp                  += amount * GUILD_XP_PER_CRYSTAL;
  save(gState);
  return true;
}

// ── Boss-Angriff ──────────────────────────────────────────────

export function attackBoss(deckUuids: string[], inventory: CardInstance[]): BossAttackResult | null {
  const st = load();
  if (st.bossAttacksLeft <= 0 || st.bossCleared) return null;

  // Deck-Stärke → Schaden
  let totalAtk = 0;
  for (const uuid of deckUuids) {
    const inst = inventory.find(i => i.uuid === uuid);
    if (!inst) continue;
    const card = CardDatabase.getById(inst.cardId);
    if (!card) continue;
    totalAtk += FusionSystem.getEffectiveStats(card, inst.rarity).atk;
  }

  const dmg = Math.round(
    GUILD_BOSS_BASE_DAMAGE + totalAtk * (GUILD_BOSS_ATK_FACTOR_MIN + Math.random() * GUILD_BOSS_ATK_FACTOR_VARIANCE),
  );

  const hpAfter  = Math.max(0, st.bossCurrentHp - dmg);
  const cleared  = hpAfter === 0;

  st.bossCurrentHp   = hpAfter;
  st.bossAttacksLeft = st.bossAttacksLeft - 1;
  st.bossCleared     = cleared;

  let crystalsWon = 0;
  let potionsWon  = 0;

  if (cleared) {
    crystalsWon = GUILD_BOSS_REWARD_CRYSTALS;
    potionsWon  = GUILD_BOSS_REWARD_POTIONS;

    // Belohnungen dem Spieler gutschreiben
    const gs = SaveService.loadGachaState();
    SaveService.saveGachaState({ ...gs, crystals: gs.crystals + crystalsWon });

    EnergyService.addPotions(potionsWon);
  }

  save(st);

  return { damage: dmg, hpAfter, cleared, crystalsWon, potionsWon };
}

// ── Vollständige Liste ────────────────────────────────────────

export function getMembersWithPlayer(playerContrib: number): GuildMember[] {
  const player: GuildMember = {
    id:                 'player',
    name:               '(Du)',
    role:               'member',
    weeklyContribution: playerContrib,
    isPlayer:           true,
  };
  return [...NPC_MEMBERS, player].sort((a, b) => b.weeklyContribution - a.weeklyContribution);
}

export const GuildService = {
  load,
  save,
  donate,
  attackBoss,
  getMembersWithPlayer,
  guildLevel,
  xpForNextLevel,
};
