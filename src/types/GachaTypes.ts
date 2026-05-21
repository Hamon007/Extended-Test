// ─────────────────────────────────────────────────────────────────────────────
// GachaTypes.ts  –  Codex Immortalis Gacha-System
//
// Separate von Card.ts damit das Inventar-System unabhängig
// vom Kartendaten-System weiterentwickelt werden kann.
// ─────────────────────────────────────────────────────────────────────────────

import type { Rarity } from './Card';

// ── Einzelne Instanz einer gezogenen Karte ────────────────────────────────────
// Jede Karte im Inventar ist eine eigene Instanz — Duplikate sind erlaubt.

export interface CardInstance {
  uuid:      string;   // crypto.randomUUID() — global eindeutig
  cardId:    string;   // Referenz auf Card.id in cards.json
  rarity:    Rarity;   // kopiert für schnellen Zugriff ohne DB-Lookup
  pulledAt:  number;   // Unix-Timestamp (Date.now())
  pullIndex: number;   // Gesamtzähler aller Pulls dieses Accounts
  isNew:     boolean;  // für "NEU"-Badge nach Pull — wird vom Screen gesetzt
}

// ── Ergebnis eines einzelnen Pulls ────────────────────────────────────────────

export interface PullResult {
  instance:    CardInstance;
  wasPity:     boolean;   // wurde Pity ausgelöst?
  pityAtPull:  number;    // pityCounter VOR diesem Pull (für Anzeige)
}

// ── Ergebnis eines Multi-Pulls (10 Karten) ────────────────────────────────────

export interface MultiPullResult {
  results:      PullResult[];   // immer genau 10 Einträge
  totalSpent:   number;         // abgezogene Kristalle (immer 1000)
  bestRarity:   Rarity;         // höchste Seltenheit im Pull
}

// ── Persistierter Gacha-State (wird in localStorage gespeichert) ──────────────

export interface GachaState {
  crystals:     number;          // aktuelle Kristalle des Spielers
  pityCounter:  number;          // Pulls seit letztem SSR/MR (0–99)
  totalPulls:   number;          // Gesamtanzahl aller Pulls
  inventory:    CardInstance[];  // alle gezogenen Karten-Instanzen
}

// ── Drop-Rate-Tabelle (Referenz) ──────────────────────────────────────────────

export interface DropRateEntry {
  rarity:      Rarity;
  rate:        number;   // in % (0–100)
  cumulative:  number;   // kumulativ (für Rollberechnung)
}

export const DROP_RATES: DropRateEntry[] = [
  { rarity: 'N',   rate: 60, cumulative: 60  },
  { rarity: 'R',   rate: 25, cumulative: 85  },
  { rarity: 'SR',  rate: 10, cumulative: 95  },
  { rarity: 'SSR', rate:  4, cumulative: 99  },
  { rarity: 'MR',  rate:  1, cumulative: 100 },
];

// ── Kosten ────────────────────────────────────────────────────────────────────

export const PULL_COST_SINGLE = 100;
export const PULL_COST_MULTI  = 1000;
export const MULTI_PULL_COUNT = 10;
export const PITY_THRESHOLD   = 100;      // bei Pull 100 garantierter SSR
export const STARTING_CRYSTALS = 3000;
