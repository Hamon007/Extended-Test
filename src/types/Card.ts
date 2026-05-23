// ─────────────────────────────────────────────────────────────────────────────
// Card.ts  –  Codex Immortalis Kartensystem
//
// Dieses Interface ist bewusst für Gacha, Deckbuilder UND Battle ausgelegt.
// Felder die noch nicht genutzt werden sind optional markiert.
// ─────────────────────────────────────────────────────────────────────────────

// ── Enums / Literal-Typen ────────────────────────────────────────────────────

// Jede Hauptstufe hat Unterstufen: base, +, ++, +++ (durch Fusion).
export type Rarity =
  | 'N'   | 'N+'   | 'N++'   | 'N+++'
  | 'R'   | 'R+'   | 'R++'   | 'R+++'
  | 'SR'  | 'SR+'  | 'SR++'  | 'SR+++'
  | 'SSR' | 'SSR+' | 'SSR++' | 'SSR+++'
  | 'MR'  | 'MR+'  | 'MR++'  | 'MR+++'
  | 'LR'  | 'LR+'  | 'LR++'  | 'LR+++';

export type Element =
  | 'dark'    // Finsternis
  | 'light'   // Licht / Heilig
  | 'fire'    // Feuer
  | 'ice'     // Eis / Kälte
  | 'void'    // Leere / Eldritch
  | 'earth'   // Erde / Natur
  | 'water'   // Wasser
  | 'lightning' // Blitz / Sturm
  | 'wind'    // Wind
  | 'death'   // Tod / Nekromantie
  | 'chaos';  // Chaos / Wandel

export type CardType =
  | 'attacker'      // Schaden, Hauptangreifer
  | 'vanguard'      // Vorhut, Tank, Frontlinie
  | 'support'       // Buffs, Debuffs, Heilung
  | 'combo_builder'; // Combo-Aufbau, MP-Regen

export type TargetType =
  | 'single'    // ein Feind
  | 'all'       // alle Feinde
  | 'self'      // eigene Karte
  | 'ally'      // eine verbündete Karte
  | 'all_allies' // alle verbündeten Karten
  | 'random';   // zufälliges Ziel

export type SkillTrigger =
  | 'active'    // aktiv einsetzbar
  | 'on_enter'  // beim Einsetzen
  | 'on_attack' // bei jedem Angriff
  | 'on_death'  // beim Zerstören
  | 'on_combo'  // bei Combo-Aktivierung
  | 'passive';  // immer aktiv

// ── Unter-Interfaces ─────────────────────────────────────────────────────────

export interface CardStats {
  atk:    number;   // Angriffswert
  def:    number;   // Verteidigungswert
  hp:     number;   // Trefferpunkte
  mpCost: number;   // MP-Kosten zum Einsetzen
  spd?:   number;   // Geschwindigkeit (für späteres Battle-Ordering)
  crit?:  number;   // Krit-Chance in % (0–100)
}

export interface Skill {
  name:        string;
  description: string;
  mpCost:      number;
  cooldown?:   number;       // in Runden
  targetType?: TargetType;
  trigger?:    SkillTrigger;
  // Für späteres Battle-System:
  damage?:     number;       // Schadensmultiplikator (1.0 = 100%)
  effectTag?:  string;       // z.B. 'burn', 'freeze', 'stun'
}

export interface Passive {
  name:        string;
  description: string;
  trigger?:    SkillTrigger;
  // Für späteres Battle-System:
  condition?:  string;       // z.B. 'hp_below_50', 'on_combo_3+'
  effectTag?:  string;
}

export interface ComboTag {
  tag:         string;       // z.B. 'DARK_CHAIN', 'WARRIOR_SYNC'
  description: string;       // was dieser Tag im Combo-System bewirkt
}

export interface Synergy {
  cardId:      string;       // ID der Synergie-Karte
  description: string;       // was die Kombo bewirkt
}

// ── Haupt-Interface ───────────────────────────────────────────────────────────

export interface Card {
  // ── Identität ──────────────────────────────────────────────────────────────
  id:           string;    // eindeutig, snake_case (z.B. 'jeanne_darc')
  number:       string;    // Katalognummer wie auf der Karte (z.B. '011')
  name:         string;
  title:        string;    // Untertitel / Epitheton
  quote:        string;    // Zitat auf der Karte
  rarity:       Rarity;
  element:      Element;
  type:         CardType;

  // ── Fraktion / Lore ────────────────────────────────────────────────────────
  faction?:      string;   // z.B. 'Äsir', 'Rashōmon'
  factionLabel?: string;   // Anzeigename der Fraktion

  // ── Kampfwerte ─────────────────────────────────────────────────────────────
  stats:    CardStats;
  skills:   Skill[];
  passives: Passive[];

  // ── Combo- & Synergiesystem ────────────────────────────────────────────────
  combos:    ComboTag[];   // Tags die diese Karte trägt/auslöst
  synergies: Synergy[];    // explizite Karten-Synergien

  // ── Progression ───────────────────────────────────────────────────────────
  awakening?: string;      // ID der Awakening-Form (z.B. 'loki_crowned')
  maxLevel?:  number;      // Standard: 100

  // ── Asset ─────────────────────────────────────────────────────────────────
  image: string;           // Pfad relativ zu /public (z.B. '/assets/cards/azazel.webp')
  artwork_key?: string;    // Stabiler Schlüssel → ArtworkMapper.ts; wird bei leerem image aufgelöst

  // ── Ökonomie / Handelssystem ───────────────────────────────────────────────
  tradeable:    boolean;   // SSR und darunter = true
  globalLimit?: number;    // weltweites Limit (null = unbegrenzt)

  // ── Gacha-Parameter (für späteres System) ─────────────────────────────────
  gachaWeight?: number;    // relative Ziehwahrscheinlichkeit
  eventOnly?:   boolean;   // nur während Events verfügbar

  // ── Deckbuilder-Parameter (für späteres System) ───────────────────────────
  deckLimit?:   number;    // max. Kopien pro Deck (Standard: 1)
  deckCost?:    number;    // Deck-Slot-Kosten
}

// ── Hilfsfunktionen (reine Typen, kein State) ────────────────────────────────

export const RARITY_ORDER: Rarity[] = [
  'N',   'N+',   'N++',   'N+++',
  'R',   'R+',   'R++',   'R+++',
  'SR',  'SR+',  'SR++',  'SR+++',
  'SSR', 'SSR+', 'SSR++', 'SSR+++',
  'MR',  'MR+',  'MR++',  'MR+++',
  'LR',  'LR+',  'LR++',  'LR+++',
];

/** Die sechs Hauptstufen (ohne Unterstufen). */
export const RARITY_MAJORS: Rarity[] = ['N', 'R', 'SR', 'SSR', 'MR', 'LR'];

/** Hauptstufe einer (Unter-)Rarität, z.B. 'MR++' → 'MR'. */
export function rarityMajor(r: Rarity): Rarity {
  return r.replace(/\+/g, '') as Rarity;
}

/** Anzahl der '+'-Unterstufen, z.B. 'MR++' → 2. */
export function raritySubLevel(r: Rarity): number {
  return (r.match(/\+/g) ?? []).length;
}

const MAJOR_COLOR: Record<string, string> = {
  N:   '#9e9e9e',
  R:   '#4caf50',
  SR:  '#2196f3',
  SSR: '#9c27b0',
  MR:  '#ff9800',
  LR:  '#f0d080',
};

// Alle 24 Stufen erben die Farbe ihrer Hauptstufe.
export const RARITY_COLOR: Record<Rarity, string> = RARITY_ORDER.reduce((acc, r) => {
  acc[r] = MAJOR_COLOR[rarityMajor(r)] ?? '#9e9e9e';
  return acc;
}, {} as Record<Rarity, string>);

export const ELEMENT_LABEL: Record<Element, string> = {
  dark:      '🌑 Dunkel',
  light:     '✨ Licht',
  fire:      '🔥 Feuer',
  ice:       '❄️ Eis',
  void:      '🌀 Leere',
  earth:     '⛰️ Erde',
  water:     '🌊 Wasser',
  lightning: '⚡ Blitz',
  wind:      '🌪️ Wind',
  death:     '💀 Tod',
  chaos:     '🌀 Chaos',
};

export const TYPE_LABEL: Record<CardType, string> = {
  attacker:     '⚔️ Angreifer',
  vanguard:     '🛡️ Vorhut',
  support:      '💫 Support',
  combo_builder:'🔗 Combo',
};
