/**
 * CardMasteryService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Playing cards in battle earns mastery XP (play counts).
 * Higher mastery grants permanent ATK bonuses for that card.
 * Creates long-term investment in specific cards.
 * ─────────────────────────────────────────────────────────────
 */

const KEY = 'ci_card_mastery';

export interface MasteryLevel {
  level:     number;
  plays:     number;    // plays required to reach this level
  atkBonus:  number;    // flat ATK bonus granted
  stars:     string;    // display stars
}

export const MASTERY_LEVELS: MasteryLevel[] = [
  { level: 0, plays: 0,    atkBonus: 0,   stars: '☆☆☆☆☆' },
  { level: 1, plays: 10,   atkBonus: 8,   stars: '★☆☆☆☆' },
  { level: 2, plays: 40,   atkBonus: 20,  stars: '★★☆☆☆' },
  { level: 3, plays: 120,  atkBonus: 45,  stars: '★★★☆☆' },
  { level: 4, plays: 300,  atkBonus: 90,  stars: '★★★★☆' },
  { level: 5, plays: 750,  atkBonus: 180, stars: '★★★★★' },
];

const MAX_MASTERY = MASTERY_LEVELS.length - 1;

interface MasteryState {
  plays: Record<string, number>;
}

function load(): MasteryState {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as MasteryState) : { plays: {} };
  } catch { return { plays: {} }; }
}

function save(st: MasteryState): void {
  localStorage.setItem(KEY, JSON.stringify(st));
}

function getLevelForPlays(plays: number): number {
  let level = 0;
  for (const ml of MASTERY_LEVELS) {
    if (plays >= ml.plays) level = ml.level;
  }
  return Math.min(level, MAX_MASTERY);
}

export interface MasteryInfo {
  level:         number;
  plays:         number;
  atkBonus:      number;
  stars:         string;
  nextThreshold: number | null;
}

function getMasteryInfo(cardId: string): MasteryInfo {
  const st = load();
  const plays = st.plays[cardId] ?? 0;
  const level = getLevelForPlays(plays);
  const atkBonus = MASTERY_LEVELS[level]?.atkBonus ?? 0;
  const stars = MASTERY_LEVELS[level]?.stars ?? '☆☆☆☆☆';
  const nextLevel = MASTERY_LEVELS[level + 1];
  return {
    level,
    plays,
    atkBonus,
    stars,
    nextThreshold: nextLevel?.plays ?? null,
  };
}

function getAtkBonus(cardId: string): number {
  const st = load();
  const plays = st.plays[cardId] ?? 0;
  const level = getLevelForPlays(plays);
  return MASTERY_LEVELS[level]?.atkBonus ?? 0;
}

function recordPlays(cardId: string, count: number): { leveledUp: boolean; newLevel: number; oldLevel: number } {
  const st = load();
  const oldPlays = st.plays[cardId] ?? 0;
  const oldLevel = getLevelForPlays(oldPlays);
  st.plays[cardId] = oldPlays + count;
  const newLevel = getLevelForPlays(st.plays[cardId]);
  save(st);
  return { leveledUp: newLevel > oldLevel, newLevel, oldLevel };
}

export const CardMasteryService = {
  getMasteryInfo,
  getAtkBonus,
  recordPlays,
  MASTERY_LEVELS,
};
