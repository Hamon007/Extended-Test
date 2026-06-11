/**
 * NemesisService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Tracks how many times each enemy has defeated the player.
 * The enemy with the most defeats becomes the player's Nemesis
 * and grants +50% bonus crystals when finally slain.
 * ─────────────────────────────────────────────────────────────
 */

const KEY = 'ci_nemesis';

interface NemesisData {
  defeats: Record<string, number>;  // enemyId → defeat count
  avenged: Record<string, number>;  // enemyId → times avenged
}

const DEFAULT: NemesisData = { defeats: {}, avenged: {} };

function load(): NemesisData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    return { ...DEFAULT, ...JSON.parse(raw) as Partial<NemesisData> };
  } catch { return { ...DEFAULT }; }
}

function save(data: NemesisData): void {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

function recordDefeat(enemyId: string): void {
  const d = load();
  d.defeats[enemyId] = (d.defeats[enemyId] ?? 0) + 1;
  save(d);
}

function recordVictory(enemyId: string): boolean {
  const d = load();
  const isNemesis = getNemesisId() === enemyId;
  if (isNemesis) {
    d.avenged[enemyId] = (d.avenged[enemyId] ?? 0) + 1;
    d.defeats[enemyId] = Math.max(0, (d.defeats[enemyId] ?? 0) - 2);
    save(d);
  }
  return isNemesis;
}

function getNemesisId(): string | null {
  const d = load();
  const entries = Object.entries(d.defeats).filter(([, n]) => n >= 2);
  if (entries.length === 0) return null;
  return entries.reduce((best, cur) => cur[1] > best[1] ? cur : best)[0];
}

function getNemesisCount(enemyId: string): number {
  return load().defeats[enemyId] ?? 0;
}

function getAvengedCount(enemyId: string): number {
  return load().avenged[enemyId] ?? 0;
}

export const NEMESIS_CRYSTAL_BONUS = 0.5; // +50% crystals for defeating nemesis

export const NemesisService = {
  recordDefeat,
  recordVictory,
  getNemesisId,
  getNemesisCount,
  getAvengedCount,
};
