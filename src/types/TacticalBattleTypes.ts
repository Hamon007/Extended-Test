// ─────────────────────────────────────────────────────────────────────────────
// TacticalBattleTypes.ts  –  Codex Immortalis Tactical Elite/Boss System
// ─────────────────────────────────────────────────────────────────────────────

import type { Element, Rarity } from './Card';

export type TacticalEnemyType = 'normal' | 'elite' | 'boss' | 'realmBoss';

export type BossIntentType =
  | 'attack' | 'heavyAttack' | 'charge' | 'shield' | 'curse'
  | 'summon' | 'seal' | 'manaDrain' | 'enrage' | 'telegraph';

export type TacticalMechanicType =
  | 'breakShield'       // Break-Leiste muss gefüllt werden um Schild zu brechen
  | 'elementStance'     // Boss wechselt Elemente, beeinflusst Break
  | 'rarityHeat'        // hohe Seltenheiten erzeugen Hitze, Strafe bei Überschreitung
  | 'mirrorPunish'      // Wiederholung von Element/Rarity bestraft
  | 'addSummon'         // Boss beschwört Adds, die ihn schützen
  | 'manaTide'          // periodischer Mana-Drain
  | 'curse'             // verflucht stärkste Karte des Spielers
  | 'sealRarity'        // versiegelt eine Seltenheit für 1 Runde
  | 'telegraphedAttack' // kündigt massiven Angriff an, kann konteriert werden
  | 'enrage'            // bei niedrigem HP: Schaden steigt jede Runde
  | 'bloodMarks'        // zu viel Schaden pro Runde gibt dem Boss Zorn
  | 'antiRepeat';       // erkennt und konteriert wiederholte Strategien

export interface BossIntent {
  type: BossIntentType;
  /** Angezeigter Text für den Spieler */
  label: string;
  /** Kurze Konter-Hinweise */
  counter: string;
  /** Runden bis zur Ausführung (0 = dieser Zug) */
  turnsUntil: number;
  /** Ungefährer Schaden-Faktor (1.0 = normal, 2.0 = doppelt) */
  damageFactor: number;
}

export interface BreakState {
  current: number;
  max: number;
  /** Wenn true: Boss-Schild gebrochen, mehr Schaden für 2 Runden */
  isBroken: boolean;
  brokenRoundsLeft: number;
}

export interface RarityHeatState {
  current: number;
  threshold: number;  // default 10
  active: boolean;    // nur bei passenden Boss-Mechaniken aktiv
}

export interface ElementStanceState {
  current: Element | null;
  resistsOwn: boolean;      // Boss widersteht eigenem Element
  /** Elemente die Break-Bonus gegen diese Stance geben */
  weakTo: Element[];
  roundsLeft: number;       // Runden bis Haltungswechsel
}

export interface SealState {
  sealedRarity: Rarity | null;
  roundsLeft: number;
}

export interface TacticalBattleState {
  enemyType: TacticalEnemyType;
  mechanic: TacticalMechanicType;
  breakState: BreakState;
  heat: RarityHeatState;
  stance: ElementStanceState;
  seal: SealState;
  intent: BossIntent | null;
  phase: number;                // 1, 2, 3
  addCount: number;             // Anzahl aktiver Adds
  /** Blood marks für Blutkoloss */
  bloodMarks: number;
  /** Letzte gespielte Elemente (für Mirror-Check) */
  lastElements: Element[];
  /** Letzte gespielte Seltenheiten (für Mirror-Check) */
  lastRarities: Rarity[];
  /** Wie oft der Spieler dieselbe Strategie wiederholt hat */
  repeatCount: number;
  /** Aktive Flüche auf Spielerkarten */
  cursedCardIds: string[];
  /** Taktische Bonus-Ziele */
  bonusGoals: TacticalBonusGoal[];
}

export interface TacticalBonusGoal {
  id: string;
  label: string;
  achieved: boolean;
}

export interface TacticalEnemyConfig {
  id: string;
  name: string;
  title: string;
  enemyType: TacticalEnemyType;
  mechanic: TacticalMechanicType;
  element: Element;
  breakMax: number;
  /** Boss HP-Schwellwerte für Phasenwechsel [0.6, 0.25] = Phase2 bei 60%, Phase3 bei 25% */
  phaseThresholds: number[];
  /** Schild-Reduktion solange Break nicht gebrochen (0.0–0.7) */
  shieldReduction: number;
  heatThreshold: number;
  /** Stance-Wechsel-Intervall in Runden */
  stanceChangeInterval: number;
  stances: Element[];
  /** Floor auf dem dieser Boss erscheint (0 = Elite, kein fester Floor) */
  bossFloor: number;
  intentSchedule: BossIntent[];
}
