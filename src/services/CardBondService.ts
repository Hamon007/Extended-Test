/**
 * CardBondService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Kartenband-System (anime-style affinity).
 * Jede Karte kann durch Einsatz im Kampf 5 Bond-Stufen erreichen.
 * Höhere Stufen geben permanente ATK-Boni auf diese Karte.
 * ─────────────────────────────────────────────────────────────
 */

const KEY = 'ci_card_bonds';

// Kämpfe pro Stufe: 5 → 15 → 30 → 60 → 100
export const BOND_THRESHOLDS = [0, 5, 15, 30, 60, 100] as const;
export const MAX_BOND = 5;

// ATK-Multiplikator je Stufe (cumulativ, additiv in %)
export const BOND_ATK_BONUS: Record<number, number> = {
  1: 0.05,  // +5%
  2: 0.10,  // +10%
  3: 0.18,  // +18%
  4: 0.28,  // +28%
  5: 0.40,  // +40%
};

export const BOND_NAMES = ['', 'Vertraut', 'Freundschaft', 'Treue', 'Seelenbund', 'Ewige Bindung'];
export const BOND_ICONS = ['', '✦', '★', '❤', '💫', '🔥'];

export interface CardBondData {
  battles: number;
  level:   number;
}

type BondMap = Record<string, CardBondData>;

function load(): BondMap {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as BondMap) : {};
  } catch {
    return {};
  }
}

function save(map: BondMap): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

export interface BondResult {
  cardId:     string;
  oldLevel:   number;
  newLevel:   number;
  battles:    number;
  leveledUp:  boolean;
}

/**
 * Registriert einen Kampfeinsatz für mehrere Karten.
 * Gibt Liste der Karten zurück, die eine Bond-Stufe erreicht haben.
 */
function recordBattle(cardIds: string[]): BondResult[] {
  const map = load();
  const results: BondResult[] = [];

  for (const cardId of cardIds) {
    const old = map[cardId] ?? { battles: 0, level: 0 };
    const newBattles = old.battles + 1;

    // Stufe berechnen
    let newLevel = old.level;
    while (newLevel < MAX_BOND && newBattles >= BOND_THRESHOLDS[newLevel + 1]) {
      newLevel++;
    }

    map[cardId] = { battles: newBattles, level: newLevel };

    results.push({
      cardId,
      oldLevel:  old.level,
      newLevel,
      battles:   newBattles,
      leveledUp: newLevel > old.level,
    });
  }

  save(map);
  return results;
}

function getCardBond(cardId: string): CardBondData {
  const map = load();
  return map[cardId] ?? { battles: 0, level: 0 };
}

function getAllBonds(): BondMap {
  return load();
}

/** Prozent bis zur nächsten Stufe (0–1). */
function progressToNext(bond: CardBondData): number {
  if (bond.level >= MAX_BOND) return 1;
  const from = BOND_THRESHOLDS[bond.level];
  const to   = BOND_THRESHOLDS[bond.level + 1];
  return Math.min(1, (bond.battles - from) / (to - from));
}

/** ATK-Multiplikator basierend auf Bond-Stufe (z.B. 1.18 für Stufe 3). */
function getAtkMultiplier(cardId: string): number {
  const bond = getCardBond(cardId);
  return 1 + (BOND_ATK_BONUS[bond.level] ?? 0);
}

export const CardBondService = {
  recordBattle,
  getCardBond,
  getAllBonds,
  progressToNext,
  getAtkMultiplier,
  BOND_THRESHOLDS,
  BOND_NAMES,
  BOND_ICONS,
};
