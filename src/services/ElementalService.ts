/**
 * ElementalService.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Elemental advantage/weakness table.
 * Attacker advantage = 1.25× damage.
 * ─────────────────────────────────────────────────────────────
 */

export type Element = string;

// attackerElement → defender elements it beats
const ADVANTAGE: Record<string, string[]> = {
  fire:      ['ice',   'earth', 'wind'],
  ice:       ['wind',  'lightning'],
  water:     ['fire',  'earth'],
  lightning: ['water', 'wind'],
  wind:      ['earth', 'lightning'],
  earth:     ['water', 'ice'],
  light:     ['dark',  'void'],
  dark:      ['light', 'void'],
  void:      ['death', 'chaos'],
  death:     ['void'],
  chaos:     ['death', 'dark'],
};

const ADVANTAGE_MULT = 1.25;
const WEAKNESS_MULT  = 0.85;

/**
 * Returns the elemental multiplier for an attacker vs. defender.
 * 1.25 if attacker has advantage, 0.85 if at disadvantage, 1.0 neutral.
 */
function getMultiplier(attackerElement: string, defenderElement: string): number {
  if (!attackerElement || !defenderElement) return 1.0;
  const advantages  = ADVANTAGE[attackerElement] ?? [];
  if (advantages.includes(defenderElement)) return ADVANTAGE_MULT;

  // Check if defender beats attacker (weakness)
  const defAdv = ADVANTAGE[defenderElement] ?? [];
  if (defAdv.includes(attackerElement)) return WEAKNESS_MULT;

  return 1.0;
}

/**
 * Returns 'advantage' | 'weakness' | 'neutral' for display purposes.
 */
function getMatchup(attackerElement: string, defenderElement: string): 'advantage' | 'weakness' | 'neutral' {
  const mult = getMultiplier(attackerElement, defenderElement);
  if (mult > 1.0) return 'advantage';
  if (mult < 1.0) return 'weakness';
  return 'neutral';
}

export const ElementalService = {
  getMultiplier,
  getMatchup,
  ADVANTAGE_MULT,
  WEAKNESS_MULT,
};
