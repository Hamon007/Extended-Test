// ─────────────────────────────────────────────────────────────────────────────
// BattleTypes.ts  –  Codex Immortalis Battle-System (minimal, ohne Combo)
// ─────────────────────────────────────────────────────────────────────────────

import type { Card } from './Card';

// ── Rohdaten aus enemies.json ─────────────────────────────────────────────────

export type AiStrategy = 'highest_atk_first' | 'lowest_mp_first' | 'random';

/** Eine mögliche Karten-Belohnung nach Sieg */
export interface RewardCard {
  cardId:  string;   // muss in cards.json existieren
  chance:  number;   // 0.0 – 1.0 Ziehwahrscheinlichkeit
}

export interface EnemyCardData {
  id:     string;
  name:   string;
  atk:    number;
  def:    number;
  hp:     number;
  mpCost: number;
  image:  string;
}

export interface EnemyData {
  id:              string;
  name:            string;
  title:           string;
  tier:            number;
  element:         string;
  image:           string;
  stats: {
    hp:       number;
    mpMax:    number;
    mpRegen:  number;
  };
  cards:           EnemyCardData[];
  aiStrategy:      AiStrategy;
  rewardXp:        number;
  rewardCrystals:  number;
  rewardCards?:    RewardCard[];   // optional; kein Crash wenn fehlt
}

// ── Live-Battle-State ─────────────────────────────────────────────────────────

/** Eine Karte wie sie im Battle existiert — mit Live-HP und gespielt-Flag */
export interface BattleCard {
  instanceId: string;      // uuid (Spieler) oder 'enemy_<cardId>' (Gegner)
  sourceId:   string;      // Card.id (Spieler) oder EnemyCardData.id (Gegner)
  name:       string;
  atk:        number;
  def:        number;
  hp:         number;
  hpMax:      number;
  mpCost:     number;
  image:      string;
  card?:      Card;        // vollständige Kartendaten (nur Spieler-Karten)
  played:     boolean;     // wurde diese Runde bereits gespielt?
  destroyed:  boolean;     // HP <= 0
}

/** Seite im Kampf */
export interface BattleSide {
  hp:      number;     // Gesamt-HP der Seite (sinkt bei Schaden)
  hpMax:   number;
  mp:      number;
  mpMax:   number;
  mpRegen: number;     // MP-Regen pro Runde
  hand:    BattleCard[];  // verfügbare Karten diese Runde
}

/** Gesamter Battle-State */
export interface BattleState {
  phase:   BattlePhase;
  round:   number;        // 1-10
  player:  BattleSide;
  enemy:   BattleSide;
  log:     BattleLogEntry[];
  result:  BattleResult | null;
  enemyData: EnemyData;   // Rohdaten für Anzeige
}

export type BattlePhase =
  | 'player_turn'   // Spieler wählt Karten
  | 'enemy_turn'    // KI spielt automatisch
  | 'round_end'     // kurze Pause zwischen Runden
  | 'ended';        // Kampf beendet

export type BattleResult =
  | { outcome: 'victory';  rewardXp: number; rewardCrystals: number }
  | { outcome: 'defeat';   reason: 'hp' | 'rounds' }
  | { outcome: 'draw' };

// ── Battle-Log ────────────────────────────────────────────────────────────────

export type LogActorType = 'player' | 'enemy' | 'system';

export interface BattleLogEntry {
  id:        number;
  round:     number;
  actor:     LogActorType;
  cardName:  string;
  damage:    number;
  mpSpent:   number;
  text:      string;
}

// ── Konstanten ────────────────────────────────────────────────────────────────

export const MAX_ROUNDS       = 10;
export const PLAYER_HP_BASE   = 50000;   // Gesamt-HP des Spielers
export const PLAYER_MP_MAX    = 100;
export const PLAYER_MP_REGEN  = 30;      // MP-Regen pro Runde
export const PLAYER_MP_START  = 100;     // MP zu Beginn des Kampfes
