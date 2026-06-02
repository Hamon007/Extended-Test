/**
 * ComboSystem.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Reine Funktionen — kein State, kein React, kein Timer.
 * Berechnet Combo-Schaden, Synergy-Bonus und Element-Vorteil.
 *
 * ⚠ DESIGN-STATUS: MVP-Implementierung, eingefroren bis Playtest.
 *   Die aktuelle `hasTagSynergy`-Logik behandelt alle Tags gleich
 *   (Fraktions-Tags wie "Shadow" = Ketten-Tags wie "DARK_CHAIN").
 *   Das ist bewusste Vereinfachung — nicht das Zieldesign.
 *
 *   Zieldesign (drei Stufen): → docs/combo-design.md
 *   Nicht ändern bis erster Playtest abgeschlossen.
 * ─────────────────────────────────────────────────────────────
 */

import type { Element } from '../types/Card';
import type { BattleCard } from '../types/BattleTypes';
import type { ComboCalcResult } from '../types/ComboTypes';
import {
  COMBO_MULTIPLIERS,
  ELEMENT_ADV_BONUS,
  ELEMENT_BEATS,
  MAX_COMBO,
  SYNERGY_BONUS_MS,
  SYNERGY_DAMAGE_BONUS,
} from '../types/ComboTypes';
import { RelicService } from './RelicService';

// ── Combo-Multiplikator ───────────────────────────────────────

function getComboMultiplier(count: number): number {
  const clamped = Math.max(1, Math.min(MAX_COMBO, count));
  return COMBO_MULTIPLIERS[clamped] ?? 1.0;
}

// ── Element-Vorteil ───────────────────────────────────────────

/**
 * Prüft ob `attackerElement` einen Vorteil gegen `defenderElement` hat.
 * Vergleich ist case-insensitiv und robust gegen undefined/null.
 */
function hasElementAdvantage(
  attackerElement: string | undefined,
  defenderElement: string | undefined,
): boolean {
  if (!attackerElement || !defenderElement) return false;
  const beaten = ELEMENT_BEATS[attackerElement as Element];
  return beaten !== undefined && beaten === defenderElement;
}

// ── Synergy-Tag-Check ─────────────────────────────────────────

/**
 * MVP: prüft ob prevCard und currentCard irgendeinen gemeinsamen Tag teilen.
 *
 * BEKANNTE VEREINFACHUNG: Fraktions-Tags ("Shadow", "Beast" …) und
 * gezielte Ketten-Tags ("DARK_CHAIN", "WARRIOR_SYNC" …) werden gleich
 * behandelt. Das Zieldesign sieht unterschiedliche Boni vor.
 * → Vollständige Spezifikation: docs/combo-design.md
 *
 * NICHT EINGEBAUT (noch): card.synergies — explizite Kartenpaare
 * (z.B. Azazel + Satan = Hölleneid). Die Daten existieren in cards.json,
 * werden aber hier nicht ausgewertet.
 */
function hasTagSynergy(
  prevCard:    BattleCard | null,
  currentCard: BattleCard,
): boolean {
  if (!prevCard?.card || !currentCard.card) return false;
  const prevTags = new Set(prevCard.card.combos.map(c => c.tag));
  return currentCard.card.combos.some(c => prevTags.has(c.tag));
}

// ── Gesamt-Berechnung ─────────────────────────────────────────

/**
 * Berechnet den finalen Schaden einer Karte inklusive aller Combo-Boni.
 *
 * @param baseDamage      - Rohschaden (card.atk)
 * @param comboCount      - Combo-Stufe nach dieser Karte (1–5)
 * @param prevCard        - zuletzt gespielte Karte (null wenn Combo neu)
 * @param currentCard     - aktuell gespielte Karte
 * @param defenderElement - Element des Gegners (aus enemyData.element)
 */
function calculate(
  baseDamage:      number,
  comboCount:      number,
  prevCard:        BattleCard | null,
  currentCard:     BattleCard,
  defenderElement: string,
): ComboCalcResult {
  const comboMultiplier = getComboMultiplier(comboCount);

  const hasSynergy   = hasTagSynergy(prevCard, currentCard);
  const hasElementAdv = hasElementAdvantage(
    currentCard.card?.element,
    defenderElement,
  );

  const synergyBonus = hasSynergy   ? SYNERGY_DAMAGE_BONUS : 0;
  const elementBonus = hasElementAdv ? ELEMENT_ADV_BONUS   : 0;

  // Gesamtmultiplikator: Combo × (1 + additive Boni)
  const totalMultiplier = comboMultiplier * (1 + synergyBonus + elementBonus);
  const finalDamage     = Math.max(1, Math.round(baseDamage * totalMultiplier));
  const relicWindowBonus = RelicService.totalComboWindowBonus();
  const windowExtension = (hasSynergy ? SYNERGY_BONUS_MS : 0) + relicWindowBonus;

  return {
    baseDamage,
    comboMultiplier,
    synergyBonus,
    elementBonus,
    totalMultiplier,
    finalDamage,
    windowExtension,
    hasSynergy,
    hasElementAdv,
  };
}

// ── Combo-Stufe für Anzeige ───────────────────────────────────

/** Gibt den Multiplikator für eine gegebene Stufe zurück (für UI-Tabellen). */
function multiplierForCount(count: number): number {
  return getComboMultiplier(count);
}

// ── Export ────────────────────────────────────────────────────

export const ComboSystem = {
  calculate,
  hasElementAdvantage,
  hasTagSynergy,
  multiplierForCount,
  getComboMultiplier,
};
