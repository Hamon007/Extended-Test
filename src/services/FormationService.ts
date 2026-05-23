import type { Card } from '../types/Card';

export interface FormationBonus {
  tag:            string;
  count:          number;
  damageBoost:    number;   // additive multiplier (0.15 = +15%)
  label:          string;
}

export interface FormationResult {
  bonuses:     FormationBonus[];
  totalBoost:  number;   // sum of all formation damage boosts
}

const TAG_LABEL: Record<string, string> = {
  Shadow:    'Schatten-Formation',
  Infernal:  'Höllen-Formation',
  Spirit:    'Geister-Formation',
  Beast:     'Bestien-Formation',
  Divine:    'Göttliche-Formation',
  Guardian:  'Wächter-Formation',
  Storm:     'Sturm-Formation',
  Titan:     'Titanen-Formation',
  Trickster: 'Trickster-Formation',
  Sea:       'Meeres-Formation',
};

export const FormationService = {
  compute(cards: Card[]): FormationResult {
    const counts = new Map<string, number>();
    for (const c of cards) {
      const seenTags = new Set<string>();
      for (const combo of c.combos ?? []) {
        if (seenTags.has(combo.tag)) continue;
        seenTags.add(combo.tag);
        counts.set(combo.tag, (counts.get(combo.tag) ?? 0) + 1);
      }
    }

    const bonuses: FormationBonus[] = [];
    for (const [tag, count] of counts) {
      if (count < 3) continue;
      const boost = count >= 5 ? 0.25 : count >= 4 ? 0.20 : 0.15;
      bonuses.push({
        tag,
        count,
        damageBoost: boost,
        label: TAG_LABEL[tag] ?? `${tag}-Formation`,
      });
    }
    bonuses.sort((a, b) => b.damageBoost - a.damageBoost);

    const totalBoost = bonuses.reduce((sum, b) => sum + b.damageBoost, 0);
    return { bonuses, totalBoost };
  },

  /** Returns the cumulative damage multiplier from all matching formations. */
  damageMultiplier(formation: FormationResult | null, card: Card | undefined): number {
    if (!formation || !card) return 1.0;
    let bonus = 0;
    const cardTags = new Set(card.combos.map(c => c.tag));
    for (const f of formation.bonuses) {
      if (cardTags.has(f.tag)) bonus += f.damageBoost;
    }
    return 1.0 + bonus;
  },
};
