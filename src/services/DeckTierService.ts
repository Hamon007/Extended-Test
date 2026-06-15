/**
 * DeckTierService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Maps deck combat power to an anime-inspired tier label.
 * Shows players a clear sense of their current "level" in the
 * world — from Schwächling all the way to Gottesrang.
 * ─────────────────────────────────────────────────────────────
 */

export interface DeckTier {
  minPower: number;
  label:    string;
  icon:     string;
  color:    string;
}

export const DECK_TIERS: DeckTier[] = [
  { minPower: 0,       label: 'Schwächling',    icon: '🥚', color: '#888888' },
  { minPower: 500,     label: 'Anfänger',        icon: '⚔',  color: '#8aad70' },
  { minPower: 2_000,   label: 'Kämpfer',         icon: '🗡',  color: '#5588cc' },
  { minPower: 5_000,   label: 'Krieger',          icon: '🛡',  color: '#4477aa' },
  { minPower: 12_000,  label: 'Elite-Krieger',   icon: '⚡',  color: '#cc8833' },
  { minPower: 25_000,  label: 'Super-Krieger',   icon: '💥',  color: '#cc5533' },
  { minPower: 50_000,  label: 'Meister der Klinge', icon: '👑', color: '#cc44aa' },
  { minPower: 100_000, label: 'Legende',          icon: '🌟',  color: '#ff9900' },
  { minPower: 200_000, label: 'Gottesrang',       icon: '🔥',  color: '#ff3300' },
];

export function getDeckTier(power: number): DeckTier {
  let result = DECK_TIERS[0]!;
  for (const t of DECK_TIERS) {
    if (power >= t.minPower) result = t;
  }
  return result;
}

export function getNextTier(power: number): DeckTier | null {
  const current = getDeckTier(power);
  const idx = DECK_TIERS.findIndex(t => t.minPower === current.minPower);
  return DECK_TIERS[idx + 1] ?? null;
}
