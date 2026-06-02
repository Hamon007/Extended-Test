/**
 * SaveService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Zentraler localStorage-Wrapper.
 * Typisiert, fehlerresistent, leicht auf Server-API erweiterbar.
 * ─────────────────────────────────────────────────────────────
 */

import type { GachaState } from '../types/GachaTypes';
import { STARTING_CRYSTALS } from '../types/GachaTypes';
import type { Deck } from '../types/DeckTypes';
import { createEmptyDeck } from './DeckBuilderHelpers';
import { STARTING_CRYSTAL_CARDS } from '../config/GameConfig';
import type { AccountState } from '../types/AccountTypes';
import {
  createDefaultAccountState,
  normalizeAccountState,
} from './AccountProgressionService';
import { supabase } from '../lib/supabase';
import { AuthService } from './AuthService';

interface CloudSave {
  gacha:          GachaState;
  deck:           Deck;
  account:        AccountState;
  savedAt:        number;
  // Extended cross-device sync fields
  guild?:         unknown;
  energy?:        unknown;
  quests?:        unknown;
  tower?:         { floor: number; highestFloor: number };
  winStreak?:     number;
  profileCardId?: string;
}

// ── Storage-Schlüssel ─────────────────────────────────────────

const KEYS = {
  gacha:         'ci_gacha_state',
  deck:          'ci_deck_main',
  settings:      'ci_settings',
  lastLogin:     'ci_last_login',
  account:       'ci_account_state',
  savedAt:       'ci_save_timestamp',
  guild:         'ci_guild_state',
  energy:        'ci_battle_energy',
  quests:        'ci_quest_state',
  towerFloor:    'ci_tower_floor',
  towerHighest:  'ci_tower_highest_floor',
  winStreak:     'ci_win_streak',
  profileCardId: 'ci_profile_card_id',
} as const;

// ── Generische Helfer ─────────────────────────────────────────

function persist<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('[SaveService] Schreiben fehlgeschlagen:', key, e);
  }
}

function retrieve<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.warn('[SaveService] Lesen fehlgeschlagen:', key, e);
    return null;
  }
}

// ── Standard-Gacha-State ──────────────────────────────────────

function defaultGachaState(): GachaState {
  return {
    crystals:     STARTING_CRYSTALS,
    pityCounter:  0,
    totalPulls:   0,
    inventory:    [],
    crystalCards: { ...STARTING_CRYSTAL_CARDS },
  };
}

// ── Gacha-State API ───────────────────────────────────────────

function loadGachaState(): GachaState {
  const saved = retrieve<GachaState>(KEYS.gacha);
  if (!saved) {
    const fresh = defaultGachaState();
    persist(KEYS.gacha, fresh);
    console.log('[SaveService] Neuen Gacha-State angelegt. Startkristalle:', STARTING_CRYSTALS);
    return fresh;
  }
  const inventory = Array.isArray(saved.inventory)
    ? saved.inventory.map(inst => ({
        ...inst,
        level: inst.level ?? 1,
        xp:    inst.xp    ?? 0,
      }))
    : [];

  return {
    crystals:     saved.crystals     ?? STARTING_CRYSTALS,
    pityCounter:  saved.pityCounter  ?? 0,
    totalPulls:   saved.totalPulls   ?? 0,
    inventory,
    crystalCards: saved.crystalCards ?? { ...STARTING_CRYSTAL_CARDS },
  };
}

function saveGachaState(state: GachaState): void {
  persist(KEYS.gacha, state);
  persist(KEYS.savedAt, Date.now());
  void uploadSave();
}

// ── Deck API ──────────────────────────────────────────────────

function loadDeck(): Deck {
  const saved = retrieve<Deck>(KEYS.deck);
  if (!saved) return createEmptyDeck();

  // Sanity-Check
  return {
    id:      saved.id      ?? 'deck_main',
    name:    saved.name    ?? 'Mein Deck',
    uuids:   Array.isArray(saved.uuids) ? saved.uuids.slice(0, 10) : [],
    savedAt: saved.savedAt ?? 0,
  };
}

function saveDeck(deck: Deck): void {
  persist(KEYS.deck, { ...deck, savedAt: Date.now() });
  persist(KEYS.savedAt, Date.now());
  void uploadSave();
}

function deleteDeck(): void {
  localStorage.removeItem(KEYS.deck);
}

// ── Account-State API ─────────────────────────────────────────

function loadAccountState(): AccountState {
  try {
    const raw = localStorage.getItem(KEYS.account);
    if (!raw) {
      const fresh = createDefaultAccountState();
      persist(KEYS.account, fresh);
      return fresh;
    }
    return normalizeAccountState(JSON.parse(raw) as Partial<AccountState>);
  } catch (e) {
    console.warn('[SaveService] Account-State Lesen fehlgeschlagen:', e);
    return createDefaultAccountState();
  }
}

function saveAccountState(state: AccountState): void {
  persist(KEYS.account, state);
  persist(KEYS.savedAt, Date.now());
  void uploadSave();
}

// ── Letzer Login ──────────────────────────────────────────────

function updateLastLogin(): void {
  persist(KEYS.lastLogin, Date.now());
}

// ── Cloud-Sync ────────────────────────────────────────────────

async function uploadSave(): Promise<void> {
  if (!supabase || !AuthService.isLoggedIn) return;
  const userId = AuthService.user!.id;
  const now = Date.now();
  const towerFloor    = parseInt(localStorage.getItem(KEYS.towerFloor)   ?? '1', 10);
  const towerHighest  = parseInt(localStorage.getItem(KEYS.towerHighest) ?? '1', 10);
  const winStreak     = parseInt(localStorage.getItem(KEYS.winStreak)    ?? '0', 10);
  const data: CloudSave = {
    gacha:         retrieve<GachaState>(KEYS.gacha)     ?? defaultGachaState(),
    deck:          retrieve<Deck>(KEYS.deck)             ?? createEmptyDeck(),
    account:       retrieve<AccountState>(KEYS.account) ?? createDefaultAccountState(),
    savedAt:       now,
    guild:         retrieve<unknown>(KEYS.guild)  ?? null,
    energy:        retrieve<unknown>(KEYS.energy) ?? null,
    quests:        retrieve<unknown>(KEYS.quests) ?? null,
    tower:         { floor: towerFloor, highestFloor: towerHighest },
    winStreak,
    profileCardId: localStorage.getItem(KEYS.profileCardId) ?? 'azazel',
  };
  persist(KEYS.savedAt, now);
  const { error } = await supabase
    .from('saves')
    .upsert(
      { user_id: userId, data, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  if (error) console.warn('[SaveService] Cloud-Upload fehlgeschlagen:', error.message);
}

/** Merges cloud and local data, uploads merged result, returns true if local state changed. */
async function downloadSave(): Promise<boolean> {
  if (!supabase || !AuthService.isLoggedIn) return false;
  const userId = AuthService.user!.id;
  const { data: row, error } = await supabase
    .from('saves')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.warn('[SaveService] Download fehlgeschlagen:', error.message);
    return false;
  }
  if (!row?.data) {
    await uploadSave();
    return false;
  }

  const cloud    = row.data as CloudSave;
  let anyChanged = false;

  // ── Core (gacha / deck / account): more cards wins, else newer wins ──
  const localTs    = retrieve<number>(KEYS.savedAt) ?? 0;
  const localCards = retrieve<GachaState>(KEYS.gacha)?.inventory?.length ?? 0;
  const cloudCards = cloud.gacha?.inventory?.length ?? 0;
  const useCloud   = cloudCards > localCards || (cloud.savedAt > localTs && cloudCards >= localCards);

  if (useCloud) {
    if (cloud.gacha)   { persist(KEYS.gacha, cloud.gacha);     anyChanged = true; }
    if (cloud.deck)    { persist(KEYS.deck, cloud.deck);       anyChanged = true; }
    if (cloud.account) { persist(KEYS.account, cloud.account); anyChanged = true; }
  }

  // ── Guild: take whichever has more guildXp ────────────────────
  const cloudGuild = cloud.guild as { guildXp?: number } | null | undefined;
  const localGuild = retrieve<{ guildXp?: number }>(KEYS.guild);
  if (cloudGuild && (cloudGuild.guildXp ?? 0) > (localGuild?.guildXp ?? 0)) {
    persist(KEYS.guild, cloudGuild);
    anyChanged = true;
  }

  // ── Tower: take highest floor ──────────────────────────────────
  const cloudHighest = cloud.tower?.highestFloor ?? 1;
  const localHighest = parseInt(localStorage.getItem(KEYS.towerHighest) ?? '1', 10);
  if (cloudHighest > localHighest) {
    localStorage.setItem(KEYS.towerHighest, String(cloudHighest));
    anyChanged = true;
  }
  const cloudFloor = cloud.tower?.floor ?? 1;
  const localFloor = parseInt(localStorage.getItem(KEYS.towerFloor) ?? '1', 10);
  if (cloudFloor > localFloor) {
    localStorage.setItem(KEYS.towerFloor, String(cloudFloor));
    anyChanged = true;
  }

  // ── Energy / Quests: silent sync — never trigger reload ──────────
  // (Supabase JSONB can reorder keys, making JSON comparison unreliable.
  //  These fields are read fresh on every screen mount so no reload needed.)
  if (cloud.energy) persist(KEYS.energy, cloud.energy);
  if (cloud.quests) persist(KEYS.quests, cloud.quests);

  // ── WinStreak: take max ───────────────────────────────────────
  const cloudStreak = cloud.winStreak ?? 0;
  const localStreak = parseInt(localStorage.getItem(KEYS.winStreak) ?? '0', 10);
  if (cloudStreak > localStreak) {
    localStorage.setItem(KEYS.winStreak, String(cloudStreak));
    anyChanged = true;
  }

  // ── Profile card: prefer cloud if local is not set ────────────
  if (cloud.profileCardId && !localStorage.getItem(KEYS.profileCardId)) {
    localStorage.setItem(KEYS.profileCardId, cloud.profileCardId);
    anyChanged = true;
  }

  // Upload merged state (pushes any local-only fields like guild/tower to cloud)
  await uploadSave();

  if (anyChanged) console.log('[SaveService] Sync: Cloud-Daten übernommen.');
  return anyChanged;
}

// ── Debug: kompletten State zurücksetzen ──────────────────────

function resetAll(): void {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
  console.log('[SaveService] Alle Daten zurückgesetzt.');
}

// ── Export ────────────────────────────────────────────────────

export const SaveService = {
  loadGachaState,
  saveGachaState,
  loadDeck,
  saveDeck,
  deleteDeck,
  loadAccountState,
  saveAccountState,
  updateLastLogin,
  resetAll,
  uploadSave,
  downloadSave,
};
