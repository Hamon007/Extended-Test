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
  HAND_LIMIT,
} from '../types/BattleTypes';
import { GUARD_MP_COST, GUARD_REDUCTION } from '../config/GameConfig';
import { CardDatabase } from './CardDatabase';
import { FusionSystem } from './FusionSystem';
import { LeaderService, type LeaderBonus }     from './LeaderService';
import { FormationService, type FormationResult } from './FormationService';
import { AwakeningService }                    from './AwakeningService';
import { CardBondService }                     from './CardBondService';
import { RelicService }                        from './RelicService';
import type { DailyModifier }                  from './DailyTrialService';

// ── Hilfsfunktionen ───────────────────────────────────────────

function applyDailyDamageMod(
  cardElement: string | undefined,
  mod: DailyModifier | null,
): number {
  if (!mod) return 1.0;
  if (mod.kind === 'element_curse') {
    return cardElement === mod.element ? 1.0 : 0.4;
  }
  return 1.0;
}


let logIdCounter = 0;

function makeLogId(): number { return ++logIdCounter; }

function log(
  round:    number,
  actor:    BattleLogEntry['actor'],
  cardName: string,
  damage:   number,
  mpSpent:  number,
  text:     string,
  extra?:   { quote?: string; isSuper?: boolean },
): BattleLogEntry {
  return { id: makeLogId(), round, actor, cardName, damage, mpSpent, text, ...extra };
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
  const cards: BattleCard[] = instances.map(inst => {
    const card: Card | undefined = CardDatabase.getById(inst.cardId);
    // Effektive Werte inkl. Fusion (Instanz-Rarität kann über Basis liegen).
    const stats = card ? FusionSystem.getEffectiveStats(card, inst.rarity) : undefined;
    return {
      instanceId: inst.uuid,
      sourceId:   inst.cardId,
      name:       card?.name ?? inst.cardId,
      atk:        stats?.atk    ?? 0,
      def:        stats?.def    ?? 0,
      hp:         stats?.hp     ?? 1000,
      hpMax:      stats?.hp     ?? 1000,
      mpCost:     stats?.mpCost ?? 50,
      image:      card?.image ?? '',
      card,
      played:     false,
      destroyed:  false,
    };
  });

  // Hand zeigt nur HAND_LIMIT Karten; Rest wandert in den Nachzieh-Stapel.
  const relicHpBonus = Math.round(PLAYER_HP_BASE * RelicService.totalBonusStartHpPct());
  const playerHp = PLAYER_HP_BASE + relicHpBonus;
  return {
    hp:      playerHp,
    hpMax:   playerHp,
    mp:      PLAYER_MP_START,
    mpMax:   PLAYER_MP_MAX,
    mpRegen: PLAYER_MP_REGEN,
    hand:    cards.slice(0, HAND_LIMIT),
    deck:    cards.slice(HAND_LIMIT),
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
    deck:    [],   // Gegner zieht nicht nach
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
  const maxR = state.maxRounds ?? MAX_ROUNDS;
  if (state.round > maxR) {
    return { outcome: 'defeat', reason: 'rounds' };
  }
  return null;
}

// ── Öffentliche API ───────────────────────────────────────────

export interface BattleMeta {
  leaderBonus?:    LeaderBonus | null;
  formation?:      FormationResult | null;
  dailyModifier?:  DailyModifier | null;
  maxRounds?:      number;
}

/** Erstellt einen frischen BattleState. */
function initBattle(
  playerInstances: CardInstance[],
  enemy:           EnemyData,
  meta:            BattleMeta = {},
): BattleState {
  logIdCounter = 0;
  let player = buildPlayerSide(playerInstances);
  let enemySide = buildEnemySide(enemy);

  // Leader-Bonus: zusätzliche Start-MP
  if (meta.leaderBonus?.startMpBonus) {
    player = { ...player, mp: Math.min(player.mpMax, player.mp + meta.leaderBonus.startMpBonus) };
  }

  // Berserker: ATK ×2, HP ×0.5 (Spieler + Gegner)
  if (meta.dailyModifier?.kind === 'berserker') {
    player = {
      ...player,
      hp:    Math.round(player.hp * 0.5),
      hpMax: Math.round(player.hpMax * 0.5),
      hand:  player.hand.map(c => ({ ...c, atk: Math.round(c.atk * 2) })),
      deck:  player.deck.map(c => ({ ...c, atk: Math.round(c.atk * 2) })),
    };
    enemySide = {
      ...enemySide,
      hp:    Math.round(enemySide.hp * 0.5),
      hpMax: Math.round(enemySide.hpMax * 0.5),
      hand:  enemySide.hand.map(c => ({ ...c, atk: Math.round(c.atk * 2) })),
    };
  }

  const initialLog: BattleLogEntry[] = [log(0, 'system', '', 0, 0, `Battle gegen ${enemy.name} beginnt! Runde 1`)];
  if (meta.leaderBonus) {
    initialLog.push(log(0, 'system', '', 0, 0,
      `👑 ${meta.leaderBonus.leaderName} führt das Team an (${meta.leaderBonus.element}: +${Math.round(meta.leaderBonus.elementDamageBoost * 100)}%)`));
  }
  if (meta.formation?.bonuses.length) {
    for (const f of meta.formation.bonuses) {
      initialLog.push(log(0, 'system', '', 0, 0,
        `✦ ${f.label} (${f.count}×): +${Math.round(f.damageBoost * 100)}% Schaden`));
    }
  }
  if (meta.dailyModifier) {
    initialLog.push(log(0, 'system', '', 0, 0,
      `⚠ Tagesprüfung aktiv: ${describeDailyModifier(meta.dailyModifier)}`));
  }

  const state: BattleState = {
    phase:         'player_turn',
    round:         1,
    player,
    enemy:         enemySide,
    log:           initialLog,
    result:        null,
    enemyData:     enemy,
    leaderBonus:   meta.leaderBonus   ?? null,
    formation:     meta.formation     ?? null,
    dailyModifier: meta.dailyModifier ?? null,
    maxRounds:     meta.maxRounds,
    awakenedIds:   [],
  };
  return state;
}

function describeDailyModifier(m: DailyModifier): string {
  switch (m.kind) {
    case 'time_trial':    return `Max ${m.maxRounds} Runden`;
    case 'element_curse': return `Element-Fluch (${m.element})`;
    case 'mirror':        return 'Spiegel — 40% Rückschlag';
    case 'silence':       return 'Stille — keine MP-Regen für 2 Runden';
    case 'berserker':     return 'Berserker — ATK ×2 / HP ×0,5';
  }
}

/**
 * Spieler spielt eine Karte. Gibt neuen State zurück.
 * damageMultiplier wird vom ComboSystem berechnet (Standard: 1.0).
 */
function playPlayerCard(
  state:            BattleState,
  instanceId:       string,
  damageMultiplier: number = 1.0,
  comboCount:       number = 1,
): BattleState {
  if (state.phase !== 'player_turn' || state.result) return state;

  const cardIdx = state.player.hand.findIndex(c => c.instanceId === instanceId);
  if (cardIdx === -1) return state;

  const card = state.player.hand[cardIdx];
  if (card.played || card.destroyed)            return state;
  if (state.player.mp < card.mpCost)            return state;

  // Meta-Multiplikatoren: Leader + Formation + Daily + Bond + Awakening
  const leaderMult    = LeaderService.damageMultiplier(state.leaderBonus ?? null, card.card?.element);
  const formationMult = FormationService.damageMultiplier(state.formation ?? null, card.card);
  const dailyMult     = applyDailyDamageMod(card.card?.element, state.dailyModifier ?? null);
  const bondMult      = card.card ? CardBondService.getAtkMultiplier(card.card.id) : 1.0;
  const relicAtkMult  = 1 + RelicService.totalAtkBonus();

  // Awakening-Check
  let awakeningMult = 1.0;
  let newlyAwakened = false;
  let isAwakened    = false;
  if (card.card) {
    const playerHpPct = state.player.hpMax > 0 ? state.player.hp / state.player.hpMax : 1;
    const enemyHpPct  = state.enemy.hpMax  > 0 ? state.enemy.hp  / state.enemy.hpMax  : 1;
    const wasAwakened = state.awakenedIds?.includes(card.sourceId) ?? false;
    const profile = AwakeningService.getAwakeningProfile(card.card);
    if (profile) {
      isAwakened = wasAwakened || AwakeningService.checkAwakened(card.card, {
        comboCount, playerHpPct, enemyHpPct,
      });
      if (isAwakened) {
        awakeningMult = 1.0 + profile.damageBoost;
        if (!wasAwakened) newlyAwakened = true;
      }
    }
  }

  // ── Super-Angriff: erwachte Karte in 3er+ Kombo ──
  const isSuper = isAwakened && comboCount >= 3;
  const superMult = isSuper ? 3.0 : 1.0;

  const totalMult = damageMultiplier * leaderMult * formationMult * dailyMult * bondMult * relicAtkMult * awakeningMult * superMult;
  const damage    = Math.round(calcDamage(card.atk, 0) * Math.max(0.01, totalMult));

  // Karte in der Hand als gespielt markieren (bleibt sichtbar mit ✓-Overlay).
  // Karten werden NICHT entfernt — das Deck bleibt diese Runde intakt.
  // resolveRoundEnd() recycelt am Rundenende die gesamte Hand + Deck.
  const newHand = state.player.hand.map((c, i) =>
    i === cardIdx ? { ...c, played: true } : c,
  );

  let newPlayer = spendMP({ ...state.player, hand: newHand }, card.mpCost);
  let newEnemy  = applyDamage(state.enemy, damage);

  // Mirror-Modus: 40% Rückschlag auf den Spieler
  if (state.dailyModifier?.kind === 'mirror') {
    const recoil = Math.round(damage * 0.4);
    newPlayer = applyDamage(newPlayer, recoil);
  }

  const logText = isSuper
    ? `▼ SUPER: ${card.name} → ${damage.toLocaleString('de-DE')} Schaden!`
    : newlyAwakened
      ? `✨ ${card.name} ERWACHT! → ${damage.toLocaleString('de-DE')} Schaden`
      : `${card.name} → ${damage.toLocaleString('de-DE')} Schaden`;

  const entry = log(state.round, 'player', card.name, damage, card.mpCost, logText, {
    quote:   isSuper ? card.card?.quote : undefined,
    isSuper,
  });

  const awakenedIds = newlyAwakened
    ? [...(state.awakenedIds ?? []), card.sourceId]
    : state.awakenedIds;

  const newState: BattleState = {
    ...state,
    player: newPlayer,
    enemy:  newEnemy,
    log:    [...state.log, entry],
    awakenedIds,
    maxComboReached: Math.max(state.maxComboReached ?? 0, comboCount),
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
 * Spieler nimmt eine Verteidigungs-Haltung ein und beendet den Zug.
 * Kostet GUARD_MP_COST MP und halbiert den Schaden des nächsten Gegnerzugs.
 */
function guardAndEndTurn(state: BattleState): BattleState {
  if (state.phase !== 'player_turn' || state.result) return state;
  if (state.player.mp < GUARD_MP_COST) return state;

  const newPlayer = spendMP(state.player, GUARD_MP_COST);
  const sysLog = log(state.round, 'system', '', 0, GUARD_MP_COST,
    `🛡 Verteidigung! Eingehender Schaden −${Math.round((1 - GUARD_REDUCTION) * 100)}%.`);
  return {
    ...state,
    player:   newPlayer,
    guarding: true,
    phase:    'enemy_turn',
    log:      [...state.log, sysLog],
  };
}

/**
 * Schätzt den Schaden, den der Gegner im nächsten Zug verursacht
 * (deterministische KI → exakt; 'random' → Obergrenze). Rein für die UI.
 */
function forecastEnemyDamage(state: BattleState): number {
  const hand = state.enemy.hand.map(c => ({ ...c }));
  let mp = state.enemy.mp;
  let total = 0;
  let limit = hand.length + 1;
  while (limit-- > 0) {
    const card = aiPickCard(hand, mp, state.enemyData.aiStrategy);
    if (!card) break;
    total += calcDamage(card.atk, 0);
    mp -= card.mpCost;
    const idx = hand.findIndex(c => c.instanceId === card.instanceId);
    if (idx >= 0) hand[idx].played = true;
  }
  return state.guarding ? Math.round(total * GUARD_REDUCTION) : total;
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

    const rawDamage = calcDamage(card.atk, 0);
    const damage    = current.guarding ? Math.round(rawDamage * GUARD_REDUCTION) : rawDamage;
    const newEHand  = current.enemy.hand.map(c =>
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
  const maxR      = state.maxRounds ?? MAX_ROUNDS;

  // Runden-Limit prüfen
  if (nextRound > maxR) {
    const result: BattleResult = { outcome: 'defeat', reason: 'rounds' };
    const entry = log(state.round, 'system', '', 0, 0,
      `Maximale Rundenzahl (${maxR}) erreicht. Niederlage!`);
    return { ...state, phase: 'ended', result, log: [...state.log, entry] };
  }

  // Karten nachziehen: Deck + verbliebene Hand mischen, dann neue Hand ziehen
  const recycled = [...state.player.deck, ...state.player.hand.map(c => ({ ...c, played: false }))];
  for (let i = recycled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [recycled[i], recycled[j]] = [recycled[j], recycled[i]];
  }
  const newHand = recycled.slice(0, HAND_LIMIT);
  const newDeck = recycled.slice(HAND_LIMIT);

  // Silence-Modus: in den ersten 2 Runden keine MP-Regen für den Spieler
  const skipPlayerRegen = state.dailyModifier?.kind === 'silence' && nextRound <= 3;

  const newPlayer: BattleSide = {
    ...(skipPlayerRegen ? state.player : regenMP(state.player)),
    hand: newHand,
    deck: newDeck,
  };
  const newEnemy: BattleSide = {
    ...regenMP(state.enemy),
    hand: state.enemy.hand.map(c => ({ ...c, played: false })),
  };

  const entry = log(nextRound, 'system', '', 0, 0,
    `Runde ${nextRound} beginnt. Neue Karten gezogen.`);

  return {
    ...state,
    round:    nextRound,
    phase:    'player_turn',
    player:   newPlayer,
    enemy:    newEnemy,
    guarding: false,
    log:      [...state.log, entry],
  };
}

// ── Export ────────────────────────────────────────────────────

export const BattleManager = {
  initBattle,
  playPlayerCard,   // accepts optional damageMultiplier (default 1.0)
  endPlayerTurn,
  guardAndEndTurn,
  forecastEnemyDamage,
  runEnemyTurn,
  resolveRoundEnd,
};
