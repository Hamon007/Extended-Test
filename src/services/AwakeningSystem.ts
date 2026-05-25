/**
 * AwakeningSystem.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * True Awakening (gemäß Konzept §7).
 * Nur LR-Karten mit definierter Awakening-Form können erwachen.
 * Das Erwachen verwandelt die Instanz in ihre Awakening-Karte
 * (neuer Skill, neue Passive, neue Combos, evolierte Werte).
 * Rein funktional — kein State, kein React.
 * ─────────────────────────────────────────────────────────────
 */

import type { Card } from '../types/Card';
import { rarityMajor } from '../types/Card';
import type { CardInstance, GachaState } from '../types/GachaTypes';
import { CardDatabase } from './CardDatabase';

export type AwakenBlockReason = 'NOT_LR' | 'NO_AWAKENING' | 'TARGET_MISSING';

export interface AwakenInfo {
  canAwaken:     boolean;
  reason?:       AwakenBlockReason;
  awakenedCard?: Card;
}

/** Kann diese konkrete Instanz erwachen? */
function getAwakenInfo(instance: CardInstance): AwakenInfo {
  if (rarityMajor(instance.rarity) !== 'LR') return { canAwaken: false, reason: 'NOT_LR' };

  const base = CardDatabase.getById(instance.cardId);
  if (!base?.awakening) return { canAwaken: false, reason: 'NO_AWAKENING' };

  const target = CardDatabase.getById(base.awakening);
  if (!target) return { canAwaken: false, reason: 'TARGET_MISSING' };

  return { canAwaken: true, awakenedCard: target };
}

// ── Awakening durchführen ─────────────────────────────────────

export type AwakenError = 'NOT_FOUND' | 'CANNOT_AWAKEN' | 'NOT_ENOUGH_DUPLICATES';

export interface AwakenSuccess {
  ok:           true;
  nextState:    GachaState;
  awakenedCard: Card;
  fromName:     string;
}

export interface AwakenFailure {
  ok:    false;
  error: AwakenError;
}

function awaken(state: GachaState, uuid: string): AwakenSuccess | AwakenFailure {
  const instance = state.inventory.find(i => i.uuid === uuid);
  if (!instance) return { ok: false, error: 'NOT_FOUND' };

  const info = getAwakenInfo(instance);
  if (!info.canAwaken || !info.awakenedCard) return { ok: false, error: 'CANNOT_AWAKEN' };

  const duplicate = state.inventory.find(i => i.cardId === instance.cardId && i.uuid !== uuid);
  if (!duplicate) return { ok: false, error: 'NOT_ENOUGH_DUPLICATES' };

  const fromName = CardDatabase.getById(instance.cardId)?.name ?? instance.cardId;
  const target   = info.awakenedCard;

  let duplicateRemoved = false;
  const newInventory = state.inventory
    .filter(i => {
      if (!duplicateRemoved && i.uuid === duplicate.uuid) { duplicateRemoved = true; return false; }
      return true;
    })
    .map(i => i.uuid === uuid ? { ...i, cardId: target.id, rarity: target.rarity, isNew: true } : i);

  return {
    ok:           true,
    nextState:    { ...state, inventory: newInventory },
    awakenedCard: target,
    fromName,
  };
}

export const AwakeningSystem = {
  getAwakenInfo,
  awaken,
};
