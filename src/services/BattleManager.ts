/**
 * BattleManager.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Kernlogik des Battle-Systems (minimal, ohne Combo).
 * Rein funktional — kein React, kein State.
 *
 * Ablauf pro Runde:
 *   1. Spieler wählt Karten → playPlayerCard()
 *   2. Spieler beendet Zug  → endPlayerTurn()
 *   3. Gegner-KI agiert     → runEnemyTurn()  (automatisch)
 *   4. Rundenabschluss      → resolveRoundEnd()
 *   5. Sieg/Niederlage-Check
 * ─────────────────────────────────────────────────────────────
 */

import type { Card } from '../types/Card';
import type { CardInstance } from '../types/GachaTypes';
import type {
  AiStrategy,
  BattleCard,
  BattleLogEntry,
  BattleResult,
  BattleSide,
  BattleState,
  EnemyData,
} from '../types/BattleTypes';
import {
  MAX_ROUNDS,
  PLAYER_HP_BASE,
  PLAYER_MP_MAX,
  PLAYER_MP_REGEN,
  PLAYER_MP_START,
} from '../types/BattleTypes';
import { CardDatabase } from './CardDatabase';

// ── Hilfsfunktionen ───────────────────────────────────────────

let logIdCounter = 0;

function makeLogId(): number { return ++logIdCounter; }

function log(
  round:    number,
  actor:    BattleLogEntry['actor'],
  cardName: string,
  damage:   number,
  mpSpent:  number,
  text:     string,
): BattleLogEntry {
  return { id: makeLogId(), round, actor, cardName, damage, mpSpent, text };
}

/** Schaden auf eine Seite anwenden. HP unterschreitet nie 0. */
function applyDamage(side: BattleSide, rawDamage: number): BattleSide {
  const actual = Math.max(0, rawDamage);
  return { ...side, hp: Math.max(0, side.hp - actual) };
}

/** MP verbrauchen — MP unterschreitet nie 0. */
function spendMP(side: BattleSide, cost: number): BattleSide {
  return { ...side, mp: Math.max(0, side.mp - cost) };
}

/** MP regenerieren — MP überschreitet nie mpMax. */
function regenMP(side: BattleSide): BattleSide {
  return { ...side, mp: Math.min(side.mpMax, side.mp + side.mpRegen) };
}

/** Schaden = Angreifer ATK − Verteidiger DEF (min. 1). */
function calcDamage(attackerAtk: number, defenderDef: number): number {
  // In dieser Phase: DEF hat noch keinen Einfluss, nur ATK.
  // DEF wird in Combo-Phase aktiviert.
  void defenderDef;
  return Math.max(1, attackerAtk);
}

// ── Spieler-Seite aufbauen ────────────────────────────────────

function buildPlayerSide(
  instances: CardInstance[],
): BattleSide {
  const hand: BattleCard[] = instances.map(inst => {
    const card: Card | undefined = CardDatabase.getById(inst.cardId);
    return {
      instanceId: inst.uuid,
      sourceId:   inst.cardId,
      name:       card?.name ?? inst.cardId,
      atk:        card?.stats.atk   ?? 0,
      def:        card?.stats.def   ?? 0,
      hp:         card?.stats.hp    ?? 1000,
      hpMax:      card?.stats.hp    ?? 1000,
      mpCost:     card?.stats.mpCost ?? 50,
      image:      card?.image ?? '',
      card,
      played:     false,
      destroyed:  false,
    };
  });

  return {
    hp:      PLAYER_HP_BASE,
    hpMax:   PLAYER_HP_BASE,
    mp:      PLAYER_MP_START,
    mpMax:   PLAYER_MP_MAX,
    mpRegen: PLAYER_MP_REGEN,
    hand,
  };
}

// ── Gegner-Seite aufbauen ─────────────────────────────────────

function buildEnemySide(enemy: EnemyData): BattleSide {
  const hand: BattleCard[] = enemy.cards.map(ec => ({
    instanceId: `enemy_${ec.id}`,
    sourceId:   ec.id,
    name:       ec.name,
    atk:        ec.atk,
    def:        ec.def,
    hp:         ec.hp,
    hpMax:      ec.hp,
    mpCost:     ec.mpCost,
    image:      ec.image,
    played:     false,
    destroyed:  false,
  }));

  return {
    hp:      enemy.stats.hp,
    hpMax:   enemy.stats.hp,
    mp:      enemy.stats.mpMax,
    mpMax:   enemy.stats.mpMax,
    mpRegen: enemy.stats.mpRegen,
    hand,
  };
}

// ── KI-Kartenauswahl ──────────────────────────────────────────

function aiPickCard(
  hand:     BattleCard[],
  mp:       number,
  strategy: AiStrategy,
): BattleCard | null {
  const available = hand.filter(c => !c.played && !c.destroyed && c.mpCost <= mp);
  if (available.length === 0) return null;

  switch (strategy) {
    case 'highest_atk_first':
      return available.reduce((best, c) => c.atk > best.atk ? c : best);
    case 'lowest_mp_first':
      return available.reduce((best, c) => c.mpCost < best.mpCost ? c : best);
    case 'random':
      return available[Math.floor(Math.random() * available.length)];
    default:
      return available[0];
  }
}

// ── Sieg/Niederlage prüfen ────────────────────────────────────

function checkResult(state: BattleState): BattleResult | null {
  if (state.enemy.hp <= 0) {
    return {
      outcome:         'victory',
      rewardXp:        state.enemyData.rewardXp,
      rewardCrystals:  state.enemyData.rewardCrystals,
    };
  }
  if (state.player.hp <= 0) {
    return { outcome: 'defeat', reason: 'hp' };
  }
  if (state.round > MAX_ROUNDS) {
    return { outcome: 'defeat', reason: 'rounds' };
  }
  return null;
}

// ── Öffentliche API ───────────────────────────────────────────

/** Erstellt einen frischen BattleState. */
function initBattle(
  playerInstances: CardInstance[],
  enemy:           EnemyData,
): BattleState {
  logIdCounter = 0;
  const state: BattleState = {
    phase:     'player_turn',
    round:     1,
    player:    buildPlayerSide(playerInstances),
    enemy:     buildEnemySide(enemy),
    log:       [log(0, 'system', '', 0, 0, `Battle gegen ${enemy.name} beginnt! Runde 1`)],
    result:    null,
    enemyData: enemy,
  };
  return state;
}

/**
 * Spieler spielt eine Karte. Gibt neuen State zurück.
 * damageMultiplier wird vom ComboSystem berechnet (Standard: 1.0).
 */
function playPlayerCard(
  state:            BattleState,
  instanceId:       string,
  damageMultiplier: number = 1.0,
): BattleState {
  if (state.phase !== 'player_turn' || state.result) return state;

  const cardIdx = state.player.hand.findIndex(c => c.instanceId === instanceId);
  if (cardIdx === -1) return state;

  const card = state.player.hand[cardIdx];
  if (card.played || card.destroyed)            return state;
  if (state.player.mp < card.mpCost)            return state;

  const damage = Math.round(calcDamage(card.atk, 0) * Math.max(0.01, damageMultiplier));

  // Hand aktualisieren
  const newHand = state.player.hand.map((c, i) =>
    i === cardIdx ? { ...c, played: true } : c
  );

  const newPlayer = spendMP({ ...state.player, hand: newHand }, card.mpCost);
  const newEnemy  = applyDamage(state.enemy, damage);

  const entry = log(
    state.round, 'player', card.name, damage, card.mpCost,
    `${card.name} → ${damage.toLocaleString('de-DE')} Schaden`
  );

  const newState: BattleState = {
    ...state,
    player: newPlayer,
    enemy:  newEnemy,
    log:    [...state.log, entry],
  };

  // Sofortiger Sieg-Check
  const result = checkResult(newState);
  if (result) return { ...newState, phase: 'ended', result };

  return newState;
}

/** Spieler beendet seinen Zug → Gegner ist dran. */
function endPlayerTurn(state: BattleState): BattleState {
  if (state.phase !== 'player_turn' || state.result) return state;

  const sysLog = log(state.round, 'system', '', 0, 0, 'Spieler beendet Zug. Gegnerzug beginnt …');
  return { ...state, phase: 'enemy_turn', log: [...state.log, sysLog] };
}

/**
 * Kompletter Gegner-Zug (synchron, alle Karten in einem Schritt).
 * Wird nach endPlayerTurn() aufgerufen.
 */
function runEnemyTurn(state: BattleState): BattleState {
  if (state.phase !== 'enemy_turn' || state.result) return state;

  let current = { ...state };
  const strategy = current.enemyData.aiStrategy;

  // Gegner spielt alle Karten die er sich leisten kann
  let limit = current.enemy.hand.length + 1; // Sicherheits-Guard
  while (limit-- > 0) {
    const card = aiPickCard(current.enemy.hand, current.enemy.mp, strategy);
    if (!card) break;

    const damage   = calcDamage(card.atk, 0);
    const newEHand = current.enemy.hand.map(c =>
      c.instanceId === card.instanceId ? { ...c, played: true } : c
    );

    const newEnemy  = spendMP({ ...current.enemy, hand: newEHand }, card.mpCost);
    const newPlayer = applyDamage(current.player, damage);

    const entry = log(
      current.round, 'enemy', card.name, damage, card.mpCost,
      `${card.name} → ${damage.toLocaleString('de-DE')} Schaden am Spieler`
    );

    current = {
      ...current,
      player: newPlayer,
      enemy:  newEnemy,
      log:    [...current.log, entry],
    };

    // Niederlage-Check nach jeder Karte
    const result = checkResult(current);
    if (result) return { ...current, phase: 'ended', result };
  }

  return { ...current, phase: 'round_end' };
}

/**
 * Rundenabschluss: MP regenerieren, played-Flags zurücksetzen, Runde erhöhen.
 */
function resolveRoundEnd(state: BattleState): BattleState {
  if (state.phase !== 'round_end' || state.result) return state;

  const nextRound = state.round + 1;

  // Runden-Limit prüfen
  if (nextRound > MAX_ROUNDS) {
    const result: BattleResult = { outcome: 'defeat', reason: 'rounds' };
    const entry = log(state.round, 'system', '', 0, 0,
      `Maximale Rundenzahl (${MAX_ROUNDS}) erreicht. Niederlage!`);
    return { ...state, phase: 'ended', result, log: [...state.log, entry] };
  }

  // MP regenerieren + played zurücksetzen
  const newPlayer: BattleSide = {
    ...regenMP(state.player),
    hand: state.player.hand.map(c => ({ ...c, played: false })),
  };
  const newEnemy: BattleSide = {
    ...regenMP(state.enemy),
    hand: state.enemy.hand.map(c => ({ ...c, played: false })),
  };

  const entry = log(nextRound, 'system', '', 0, 0,
    `Runde ${nextRound} beginnt. MP regeneriert.`);

  return {
    ...state,
    round:  nextRound,
    phase:  'player_turn',
    player: newPlayer,
    enemy:  newEnemy,
    log:    [...state.log, entry],
  };
}

// ── Export ────────────────────────────────────────────────────

export const BattleManager = {
  initBattle,
  playPlayerCard,   // accepts optional damageMultiplier (default 1.0)
  endPlayerTurn,
  runEnemyTurn,
  resolveRoundEnd,
};
