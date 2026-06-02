/**
 * ExpeditionService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Karten-Expeditionssystem: Schicke Karten auf Erkundungsreisen.
 * Nach Ablauf kehren sie mit Kristallen und Materialien zurück.
 * Max. 3 gleichzeitige Expeditionen.
 * ─────────────────────────────────────────────────────────────
 */

import { SaveService } from './SaveService';

const KEY = 'ci_expeditions';
export const MAX_EXPEDITIONS = 3;

export interface ExpeditionDef {
  id:          string;
  name:        string;
  description: string;
  icon:        string;
  durationMs:  number;           // Dauer in Millisekunden
  rewards: {
    crystalsMin: number;
    crystalsMax: number;
    crystalCardChance?: number;  // 0–1
    potionChance?: number;       // 0–1
  };
  requiredRarity?: string[];     // Optional: Seltenheitsbeschränkung
}

export const EXPEDITION_DEFS: ExpeditionDef[] = [
  {
    id:   'forest_ruins',
    name: 'Waldruinen',
    description: 'Uralte Ruinen tief im verwunschenen Wald. Kurze Reise, kleine Schätze.',
    icon: '🌳',
    durationMs: 2 * 60 * 60 * 1000, // 2 Stunden
    rewards: { crystalsMin: 80, crystalsMax: 200 },
  },
  {
    id:   'cursed_temple',
    name: 'Verfluchter Tempel',
    description: 'Ein Tempel voll dunkler Energie. Mittlere Gefahr, mittlere Beute.',
    icon: '⛩️',
    durationMs: 4 * 60 * 60 * 1000, // 4 Stunden
    rewards: { crystalsMin: 200, crystalsMax: 500, potionChance: 0.25 },
  },
  {
    id:   'shadow_realm',
    name: 'Schattenreich',
    description: 'Eine Dimension jenseits des Lichts. Nur die Stärksten überleben.',
    icon: '🌑',
    durationMs: 8 * 60 * 60 * 1000, // 8 Stunden
    rewards: { crystalsMin: 500, crystalsMax: 1200, crystalCardChance: 0.3, potionChance: 0.4 },
    requiredRarity: ['SR', 'SSR', 'MR', 'LR'],
  },
  {
    id:   'celestial_peak',
    name: 'Himmelsgipfel',
    description: 'Der Thron der alten Götter. Legendäre Beute wartet auf Würdige.',
    icon: '⛰️',
    durationMs: 12 * 60 * 60 * 1000, // 12 Stunden
    rewards: { crystalsMin: 1000, crystalsMax: 3000, crystalCardChance: 0.6, potionChance: 0.6 },
    requiredRarity: ['SSR', 'MR', 'LR'],
  },
];

export interface ActiveExpedition {
  expeditionId: string;
  cardUuid:     string;
  cardId:       string;
  cardName:     string;
  startedAt:    number;   // Unix timestamp
  endsAt:       number;   // Unix timestamp
  collected:    boolean;
}

export interface ExpeditionState {
  active: ActiveExpedition[];
}

export interface ExpeditionReward {
  crystals:     number;
  potions:      number;
  crystalCards: number;
}

function load(): ExpeditionState {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ExpeditionState) : { active: [] };
  } catch {
    return { active: [] };
  }
}

function save(st: ExpeditionState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(st));
  } catch { /* ignore */ }
}

/** Sendet eine Karte auf Expedition. Gibt false zurück wenn bereits 3 laufen. */
function startExpedition(
  expeditionId: string,
  cardUuid: string,
  cardId: string,
  cardName: string,
): boolean {
  const st = load();
  const active = st.active.filter(e => !e.collected);
  if (active.length >= MAX_EXPEDITIONS) return false;

  // Karte darf nicht bereits auf Expedition sein
  if (active.some(e => e.cardUuid === cardUuid)) return false;

  const def = EXPEDITION_DEFS.find(d => d.id === expeditionId);
  if (!def) return false;

  const now = Date.now();
  const newExp: ActiveExpedition = {
    expeditionId,
    cardUuid,
    cardId,
    cardName,
    startedAt: now,
    endsAt:    now + def.durationMs,
    collected: false,
  };

  save({ active: [...active, newExp] });
  return true;
}

/** Bricht eine Expedition vorzeitig ab (keine Belohnung). */
function cancelExpedition(cardUuid: string): void {
  const st = load();
  save({ active: st.active.filter(e => e.cardUuid !== cardUuid || e.collected) });
}

/** Sammelt Belohnungen einer abgeschlossenen Expedition. */
function collectReward(cardUuid: string): ExpeditionReward | null {
  const st = load();
  const idx = st.active.findIndex(e => e.cardUuid === cardUuid && !e.collected);
  if (idx === -1) return null;

  const exp = st.active[idx]!;
  if (Date.now() < exp.endsAt) return null; // Noch nicht fertig

  const def = EXPEDITION_DEFS.find(d => d.id === exp.expeditionId);
  if (!def) return null;

  // Belohnung würfeln
  const crystals = Math.round(
    def.rewards.crystalsMin + Math.random() * (def.rewards.crystalsMax - def.rewards.crystalsMin)
  );
  const potions     = (def.rewards.potionChance ?? 0) > Math.random() ? 1 : 0;
  const crystalCards = (def.rewards.crystalCardChance ?? 0) > Math.random() ? 1 : 0;

  // Belohnung anwenden
  const gs = SaveService.loadGachaState();
  SaveService.saveGachaState({
    ...gs,
    crystals: gs.crystals + crystals,
    crystalCards: crystalCards > 0
      ? { ...gs.crystalCards, small: gs.crystalCards.small + crystalCards }
      : gs.crystalCards,
  });

  // Als gesammelt markieren
  st.active[idx] = { ...exp, collected: true };
  save(st);

  return { crystals, potions, crystalCards };
}

/** Alle aktiven (nicht gesammelten) Expeditionen. */
function getActive(): ActiveExpedition[] {
  const st = load();
  return st.active.filter(e => !e.collected);
}

/** UUIDs der Karten die gerade auf Expedition sind. */
function getExpeditionedCardUuids(): Set<string> {
  return new Set(getActive().map(e => e.cardUuid));
}

/** Fertige (abgelaufene, noch nicht gesammelte) Expeditionen. */
function getCompleted(): ActiveExpedition[] {
  const now = Date.now();
  return getActive().filter(e => now >= e.endsAt);
}

/** Formatiert Restzeit für UI. */
function formatTimeLeft(endsAt: number): string {
  const ms = Math.max(0, endsAt - Date.now());
  if (ms === 0) return 'Bereit!';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

export const ExpeditionService = {
  startExpedition,
  cancelExpedition,
  collectReward,
  getActive,
  getCompleted,
  getExpeditionedCardUuids,
  formatTimeLeft,
  EXPEDITION_DEFS,
  MAX_EXPEDITIONS,
};
