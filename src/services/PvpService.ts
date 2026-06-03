/**
 * PvpService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Asynchrones PvP: Spieler greifen das gespeicherte Deck
 * eines anderen Spielers an (kein Live-Multiplayer).
 * ─────────────────────────────────────────────────────────────
 */

import type { EnemyData, EnemyCardData } from '../types/BattleTypes';
import { PLAYER_HP_BASE, PLAYER_MP_MAX, PLAYER_MP_REGEN } from '../types/BattleTypes';
import type { CardInstance } from '../types/GachaTypes';
import { CardDatabase } from './CardDatabase';
import { FusionSystem } from './FusionSystem';
import { supabase } from '../lib/supabase';
import { AuthService } from './AuthService';
import { SaveService } from './SaveService';
import type { AccountState } from '../types/AccountTypes';

// ── Typen ─────────────────────────────────────────────────────

export interface PvpOpponent {
  userId:        string;
  displayName:   string;
  accountLevel:  number;
  pvpWins:       number;
  pvpLosses:     number;
  rating:        number;
  deckInstances: CardInstance[];
  updatedAt:     string;
}

// ── Pending-Battle-Singleton ──────────────────────────────────
// Gesetzt vor dem Navigieren zu BattleScreen; konsumiert bei Mount.

let _pendingEnemy:    EnemyData    | null = null;
let _pendingOpponent: PvpOpponent | null = null;

function setPendingBattle(enemy: EnemyData, opponent: PvpOpponent): void {
  _pendingEnemy    = enemy;
  _pendingOpponent = opponent;
}

function consumePendingBattle(): { enemy: EnemyData; opponent: PvpOpponent } | null {
  if (!_pendingEnemy || !_pendingOpponent) return null;
  const out = { enemy: _pendingEnemy, opponent: _pendingOpponent };
  _pendingEnemy    = null;
  _pendingOpponent = null;
  return out;
}

function hasPendingBattle(): boolean {
  return _pendingEnemy !== null;
}

// ── Rating & Rang ─────────────────────────────────────────────

function computeRating(wins: number, losses: number, accountLevel: number): number {
  return wins * 100 - losses * 20 + accountLevel * 5;
}

export function rankLabel(rating: number): string {
  if (rating >= 2000) return 'Legendär';
  if (rating >= 1000) return 'Diamant';
  if (rating >= 500)  return 'Platin';
  if (rating >= 200)  return 'Gold';
  if (rating >= 50)   return 'Silber';
  return 'Bronze';
}

export function rankColor(rating: number): string {
  if (rating >= 2000) return '#ff6b35';
  if (rating >= 1000) return '#88d4f5';
  if (rating >= 500)  return '#b0bec5';
  if (rating >= 200)  return '#ffd700';
  if (rating >= 50)   return '#c0c0c0';
  return '#cd7f32';
}

// ── Gegner aus gespeichertem Deck bauen ───────────────────────

function buildEnemyFromOpponent(opponent: PvpOpponent): EnemyData {
  const cards: EnemyCardData[] = opponent.deckInstances.map((inst, i) => {
    const card = CardDatabase.getById(inst.cardId);
    if (!card) {
      return { id: `pvp_${i}`, name: inst.cardId, atk: 300, def: 100, hp: 1000, mpCost: 50, image: '' };
    }
    const stats = FusionSystem.getEffectiveStats(card, inst.rarity, inst.level ?? 1);
    return {
      id:     `pvp_${opponent.userId}_${i}`,
      name:   card.name,
      atk:    stats.atk,
      def:    stats.def,
      hp:     stats.hp,
      mpCost: stats.mpCost,
      image:  card.image,
    };
  });

  const lvl = Math.max(1, opponent.accountLevel);
  return {
    id:       `pvp_${opponent.userId}`,
    name:     opponent.displayName,
    title:    rankLabel(opponent.rating),
    tier:     Math.min(10, Math.ceil(lvl / 10)),
    element:  'neutral',
    image:    '',
    stats: {
      hp:      PLAYER_HP_BASE,
      mpMax:   PLAYER_MP_MAX,
      mpRegen: PLAYER_MP_REGEN,
    },
    cards,
    aiStrategy:     'highest_atk_first',
    rewardXp:       40 + lvl * 2,
    rewardCrystals: 20 + lvl,
  };
}

// ── Leaderboard abrufen ───────────────────────────────────────

async function fetchLeaderboard(): Promise<PvpOpponent[]> {
  if (!supabase) return [];

  const myId = AuthService.isLoggedIn ? AuthService.user?.id : null;

  // 1. Saves abrufen
  const { data: rows, error } = await supabase
    .from('saves')
    .select('user_id, data, updated_at')
    .limit(60);

  if (error || !rows) return [];

  // 2. Usernames aus profiles-Tabelle laden
  const ids = rows.map(r => r.user_id as string).filter(id => id !== myId);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, username')
    .in('user_id', ids);

  const nameMap = new Map<string, string>(
    (profiles ?? []).map(p => [p.user_id as string, p.username as string])
  );

  // 3. Gegner zusammenstellen
  const opponents: PvpOpponent[] = [];

  for (const row of rows) {
    if ((row.user_id as string) === myId) continue;

    const save = row.data as {
      account?: { level?: number; pvpWins?: number; pvpLosses?: number };
      gacha?:   { inventory?: CardInstance[] };
      deck?:    { uuids?: string[] };
    } | null;

    if (!save?.deck?.uuids?.length) continue;

    const inventory    = save.gacha?.inventory ?? [];
    const deckUuids    = (save.deck.uuids).slice(0, 10);
    const invMap       = new Map(inventory.map(i => [i.uuid, i]));
    const deckInstances = deckUuids
      .map(uuid => invMap.get(uuid))
      .filter((i): i is CardInstance => i !== undefined);

    if (deckInstances.length < 3) continue;

    const uid          = row.user_id as string;
    const account      = save.account ?? {};
    const displayName  = nameMap.get(uid) ?? `Spieler#${uid.slice(0, 6)}`;
    const accountLevel = account.level    ?? 1;
    const pvpWins      = account.pvpWins   ?? 0;
    const pvpLosses    = account.pvpLosses ?? 0;
    const rating       = computeRating(pvpWins, pvpLosses, accountLevel);

    opponents.push({
      userId: uid,
      displayName,
      accountLevel,
      pvpWins,
      pvpLosses,
      rating,
      deckInstances,
      updatedAt: row.updated_at as string,
    });
  }

  return opponents.sort((a, b) => b.rating - a.rating).slice(0, 20);
}

// ── Ergebnis speichern ────────────────────────────────────────

async function recordResult(outcome: 'win' | 'loss'): Promise<void> {
  const account = SaveService.loadAccountState() as AccountState & { pvpWins?: number; pvpLosses?: number };
  const updated = {
    ...account,
    pvpWins:   (account.pvpWins   ?? 0) + (outcome === 'win'  ? 1 : 0),
    pvpLosses: (account.pvpLosses ?? 0) + (outcome === 'loss' ? 1 : 0),
  };
  SaveService.saveAccountState(updated);
}

function getMyRecord(): { wins: number; losses: number } {
  const account = SaveService.loadAccountState() as { pvpWins?: number; pvpLosses?: number };
  return { wins: account.pvpWins ?? 0, losses: account.pvpLosses ?? 0 };
}

function getMyRating(): number {
  const account = SaveService.loadAccountState() as AccountState & { pvpWins?: number; pvpLosses?: number };
  return computeRating(account.pvpWins ?? 0, account.pvpLosses ?? 0, account.level ?? 1);
}

export const PVP_RANK_TIERS: { label: string; min: number; color: string }[] = [
  { label: 'Bronze',   min: 0,    color: '#cd7f32' },
  { label: 'Silber',   min: 50,   color: '#c0c0c0' },
  { label: 'Gold',     min: 200,  color: '#ffd700' },
  { label: 'Platin',   min: 500,  color: '#b0bec5' },
  { label: 'Diamant',  min: 1000, color: '#88d4f5' },
  { label: 'Legendär', min: 2000, color: '#ff6b35' },
];

// ── Export ────────────────────────────────────────────────────

export const PvpService = {
  fetchLeaderboard,
  buildEnemyFromOpponent,
  setPendingBattle,
  consumePendingBattle,
  hasPendingBattle,
  rankLabel,
  rankColor,
  recordResult,
  getMyRecord,
  getMyRating,
};
