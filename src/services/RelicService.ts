/**
 * RelicService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Relikte — permanente Passivboni die durch Achievements
 * und Fortschritt freigeschaltet werden.
 * Bonusse werden bei jedem Kampf angewendet.
 * ─────────────────────────────────────────────────────────────
 */

const KEY = 'ci_relics';

export interface RelicDef {
  id:           string;
  name:         string;
  description:  string;
  icon:         string;
  unlockFrom:   string;   // Text für UI ("Achievement: Erster Sieg")
  // Bonus-Felder (nur gesetzt wenn relevant)
  crystalBonus?:    number;   // additiver % auf Kristall-Belohnungen (0.05 = +5%)
  atkBonus?:        number;   // additiver % auf globalen ATK-Schaden
  xpBonus?:         number;   // additiver % auf XP-Belohnungen
  comboWindowMs?:   number;   // ms die die Combo-Fenster verlängert werden
  bonusStartHpPct?: number;   // % zusätzliche Start-HP (0.1 = +10%)
}

export const RELIC_DEFS: RelicDef[] = [
  {
    id:          'golden_eye',
    name:        'Goldenes Auge',
    description: 'Kampfbelohnungen geben +5% mehr Kristalle.',
    icon:        '👁️',
    unlockFrom:  'Erster Kampfsieg',
    crystalBonus: 0.05,
  },
  {
    id:          'bloody_blade',
    name:        'Blutige Klinge',
    description: 'Alle Kartenangriffe verursachen +3% mehr Schaden.',
    icon:        '🗡️',
    unlockFrom:  '10 Kämpfe gewonnen',
    atkBonus: 0.03,
  },
  {
    id:          'iron_will',
    name:        'Eiserner Wille',
    description: 'Du startest jeden Kampf mit +10% mehr HP.',
    icon:        '🛡️',
    unlockFrom:  '50 Kämpfe gewonnen',
    bonusStartHpPct: 0.10,
  },
  {
    id:          'element_soul',
    name:        'Elementarseele',
    description: 'Elementarvorteil gibt +10% Schadenbonus.',
    icon:        '🔮',
    unlockFrom:  'Erste SSR-Karte gezogen',
    atkBonus: 0.10,   // applied only when element advantage exists — BattleManager handles it
  },
  {
    id:          'tower_spirit',
    name:        'Turmgeist',
    description: 'Kampf-XP aus Turmkämpfen +5% erhöht.',
    icon:        '🗼',
    unlockFrom:  'Etage 10 erreicht',
    xpBonus: 0.05,
  },
  {
    id:          'victor_spirit',
    name:        'Siegergeist',
    description: 'Während einer Siegesserie +10% Kristalle pro Sieg.',
    icon:        '🔥',
    unlockFrom:  '5 Siege in Folge',
    crystalBonus: 0.10,
  },
  {
    id:          'eternal_warrior',
    name:        'Ewiger Krieger',
    description: 'Globaler ATK-Bonus von +5% in PvP-Kämpfen.',
    icon:        '⚔️',
    unlockFrom:  'Erster PvP-Sieg',
    atkBonus: 0.05,
  },
  {
    id:          'collector_greed',
    name:        'Sammlergier',
    description: '+8% Kristalle aus allen Quellen.',
    icon:        '📦',
    unlockFrom:  '20 Karten gesammelt',
    crystalBonus: 0.08,
  },
  {
    id:          'legend_heart',
    name:        'Legendenherz',
    description: '+5% ATK für alle Karten. Die Legende lebt weiter.',
    icon:        '💫',
    unlockFrom:  'Erste LR-Karte',
    atkBonus: 0.05,
  },
  {
    id:          'combo_master_relic',
    name:        'Combo-Maestro',
    description: 'Combo-Fenster dauern 200ms länger.',
    icon:        '🌀',
    unlockFrom:  'Combo-Meister Achievement',
    comboWindowMs: 200,
  },
];

type RelicMap = Record<string, boolean>;

function load(): RelicMap {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RelicMap) : {};
  } catch {
    return {};
  }
}

function save(map: RelicMap): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

/** Schaltet ein Relikt frei (kein Doppel-Unlock). Gibt true zurück wenn neu. */
function unlock(relicId: string): boolean {
  const map = load();
  if (map[relicId]) return false;
  map[relicId] = true;
  save(map);
  return true;
}

function getUnlocked(): RelicDef[] {
  const map = load();
  return RELIC_DEFS.filter(r => map[r.id]);
}

function isUnlocked(relicId: string): boolean {
  return !!load()[relicId];
}

/** Summiert alle Crystal-Bonus-% der aktiven Relikte. */
function totalCrystalBonus(): number {
  return getUnlocked().reduce((s, r) => s + (r.crystalBonus ?? 0), 0);
}

/** Summiert alle ATK-Bonus-% der aktiven Relikte. */
function totalAtkBonus(): number {
  return getUnlocked().reduce((s, r) => s + (r.atkBonus ?? 0), 0);
}

/** Summiert alle XP-Bonus-% der aktiven Relikte. */
function totalXpBonus(): number {
  return getUnlocked().reduce((s, r) => s + (r.xpBonus ?? 0), 0);
}

/** Summiert alle Start-HP-Bonus-% der aktiven Relikte. */
function totalBonusStartHpPct(): number {
  return getUnlocked().reduce((s, r) => s + (r.bonusStartHpPct ?? 0), 0);
}

/** Summiert alle Combo-Fenster-Verlängerungen in ms. */
function totalComboWindowBonus(): number {
  return getUnlocked().reduce((s, r) => s + (r.comboWindowMs ?? 0), 0);
}

export const RelicService = {
  unlock,
  getUnlocked,
  isUnlocked,
  totalCrystalBonus,
  totalAtkBonus,
  totalXpBonus,
  totalBonusStartHpPct,
  totalComboWindowBonus,
  RELIC_DEFS,
};
