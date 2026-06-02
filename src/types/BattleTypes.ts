// ─────────────────────────────────────────────────────────────────────────────
// BattleTypes.ts  –  Codex Immortalis Battle-System (minimal, ohne Combo)
// ─────────────────────────────────────────────────────────────────────────────

import type { Card } from './Card';
import type { LeaderBonus }      from '../services/LeaderService';
import type { FormationResult }  from '../services/FormationService';
import type { DailyModifier }    from '../services/DailyTrialService';

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
  hand:    BattleCard[];  // sichtbare Karten (max. HAND_LIMIT)
  deck:    BattleCard[];  // Nachzieh-Stapel (chronologisch); leer beim Gegner
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
  // ── Meta-Bonusse ──
  leaderBonus?:    LeaderBonus | null;
  formation?:      FormationResult | null;
  dailyModifier?:  DailyModifier | null;
  maxRounds?:      number;                  // overrides MAX_ROUNDS if set
  awakenedIds?:    string[];                // sourceIds awakened this battle (persisted)
  guarding?:       boolean;                 // Verteidigungs-Haltung: halbiert nächsten Gegnerschaden
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
  quote?:    string;
  isSuper?:  boolean;
}

// ── Konstanten (Werte zentral in GameConfig.ts) ───────────────────────────────

export {
  MAX_ROUNDS,
  PLAYER_HP_BASE,
  PLAYER_MP_MAX,
  PLAYER_MP_REGEN,
  PLAYER_MP_START,
  HAND_LIMIT,
} from '../config/GameConfig';
