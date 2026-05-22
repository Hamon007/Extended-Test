# Combo- & Synergiesystem — Designentscheidung

> **Status: EINGEFROREN bis Playtest.**  
> Keine Änderungen am `ComboSystem.ts` oder `hasTagSynergy` bis erste
> Spieltests gelaufen sind. Dieses Dokument ist die Entscheidungsgrundlage.

---

## 1. Was der Code heute tut

```
hasTagSynergy(prevCard, currentCard):
  → true wenn beide Karten mindestens einen gemeinsamen ComboTag teilen
  → Effekt: +15 % Schaden (SYNERGY_DAMAGE_BONUS) + 300 ms Timer-Verlängerung
  → Alle Tags werden gleich behandelt
```

Das heißt: Azazel (Shadow) → irgendeiner der 11 anderen Shadow-Karten
löst exakt denselben Bonus aus wie Loki (TRICK_LINK) → eine der
2 TRICK_LINK-Karten. Das war nie so geplant.

Die `synergies`-Liste jeder Karte (explizite Paareffekte wie
„Hölleneid: Azazel + Satan = +25 % Schaden für beide") wird im
Battle **gar nicht gelesen**. Sie existiert nur in der Kartendaten.

---

## 2. Was die Datenlage zeigt — zwei Tag-Klassen

Die `combos`-Tags in `cards.json` sind faktisch zwei verschiedene Dinge:

### Klasse A — Fraktions-/Archetypentags (`lowercase`)

| Tag | Anzahl Karten |
|---|---|
| Shadow | 11 |
| Infernal | 10 |
| Spirit | 10 |
| Beast | 8 |
| Divine | 7 |
| Guardian | 7 |
| Storm | 7 |
| Titan | 6 |
| … | … |

Diese Tags klassifizieren Karten nach Archetype oder Fraktion.
Sie sind für Deckbuilder-Filterung, UI-Badges und evtl. passive Boni gedacht.
Ein Bonus von +15 % bei einem Match ist zu stark und zu häufig (jede Shadow-Karte
nach einer anderen Shadow-Karte = Bonus).

### Klasse B — Gezielte Ketten-Tags (`UPPER_SNAKE_CASE`)

| Tag | Karten |
|---|---|
| DARK_CHAIN | 4 |
| WARRIOR_SYNC | 2 |
| VOID_HUNGER | 2 |
| CHAOS_WEAVE | 2 |
| TRICK_LINK | 2 |
| DEATH_BRIDGE | 2 |
| FALLEN_SYNC | 1+1 |
| ABYSSAL_SYNC | 1+1 |
| CROWN_RESONANCE | 1 |
| … | … |

Diese Tags definieren **designte Combo-Sequenzen** zwischen 2–4 konkreten Karten.
Sie sind selten, exklusiv und für meaningful Battle-Boni gedacht.

---

## 3. Was die `synergies`-Liste bedeutet

Neben den Tags gibt es ein separates `synergies`-Feld pro Karte:

```json
"synergies": [
  { "cardId": "satan",    "description": "Hölleneid: Beide erhalten +25% Schaden wenn gleichzeitig im Feld." },
  { "cardId": "azgaroth", "description": "Ursprung der Finsternis: Azazels Krit-Rate steigt um 15%." }
]
```

Das sind **Kompositionssynergien** — Boni die davon abhängen, dass
beide Karten gleichzeitig in der Hand (oder im Deck) sind, nicht von der
Spielreihenfolge. Sie sind unabhängig vom Chain-Bonus.

Derzeit: 70 Synergy-Einträge in der DB, 0 davon im Battle wirksam.

---

## 4. Drei-Stufen-Design (Zielbild nach Playtest)

```
Stufe 1 — Fraktions-Tag (lowercase)
  Bedingung : prevCard und currentCard teilen einen Klasse-A-Tag
  Effekt     : +5 % Schaden (klein, häufig, Stacking-Anreiz im Deckbau)
  Beispiel   : Shadow → Shadow: +5 %

Stufe 2 — Ketten-Tag (UPPER_SNAKE_CASE)
  Bedingung : prevCard und currentCard teilen einen Klasse-B-Tag
  Effekt     : +15 % Schaden + 300 ms Combo-Fenster (aktuelles Verhalten)
  Beispiel   : Loki (TRICK_LINK) → Azgaroth (TRICK_LINK): +15 %

Stufe 3 — Explizite Paarsynergie (synergies-Liste)
  Bedingung : beide Karten befinden sich gleichzeitig in der Hand
  Effekt     : kartenspezifisch (z. B. Hölleneid: +25 % ATK für Azazel + Satan)
  Trigger    : passiv, wirkt die ganze Runde, kein Reihenfolge-Abhängigkeit
  Priorität  : additiv auf Stufe 1 + 2, NICHT multiplikativ
```

Kombination Beispiel (Azazel → Satan):
- Stufe 1: Shadow-Match → +5 %  
- Stufe 2: FALLEN_SYNC-Match → +15 %  
- Stufe 3: Hölleneid (beide in Hand) → +25 %  
- **Gesamt: +45 % Bonus-Multiplikator auf den Combo-Schaden**  
  (additiv: comboMult × (1 + 0.45 + elementBonus))

---

## 5. Was sich im Code ändern muss (NACH Playtest)

| Datei | Änderung |
|---|---|
| `ComboSystem.ts` | `hasTagSynergy` aufteilen: `hasFactionTag` (lowercase) und `hasChainTag` (UPPER_SNAKE). Separate Boni zurückgeben. |
| `ComboSystem.ts` | `hasPairSynergy(hand, currentCard)` — prüft synergies-Liste gegen aktive Hand. |
| `ComboCalcResult` | `factionBonus`, `chainBonus`, `pairBonus` statt einfachem `synergyBonus`. |
| `BattleManager.ts` | Hand-State an ComboSystem übergeben, damit Stufe 3 prüfbar ist. |
| `BattleScreen.tsx` | Synergy-Anzeige für Stufe 3 (passive Badge an Karte wenn Paar in Hand). |

---

## 6. Was NICHT geändert wird

- `DARK_CHAIN` und ähnliche Tags auf vorhandenen Karten bleiben wie sie sind.  
  Das Drei-Stufen-System ist **additiv kompatibel** mit dem jetzigen Datenmodell.
- `COMBO_MULTIPLIERS [0, 1.0, 1.3, 1.7, 2.2, 3.0]` bleibt unberührt.
- `ComboTag.description`-Felder in der DB sind bereits korrekt befüllt — nur
  das Battle-System muss lernen, sie auszuwerten.

---

## 7. Offene Fragen für den Playtest

1. **Ist +5 % für Fraktions-Tags zu schwach um wahrgenommen zu werden?**  
   Alternative: 0 % Bonus, Tags nur für Deckbuilder-Filterung.

2. **Soll Stufe 3 die Runde über wirken oder nur im Moment des Ausspielen?**  
   „In der Hand" (passiv die ganze Runde) ist stärker als „gleichzeitig ausgespielt".

3. **Soll die maximale Combo-Zahl (5) mit einem Drei-Stufen-System angepasst werden?**  
   Bei +45 % Synergiestack ist Combo×5 sehr stark (3.0 × 1.45 = 4.35×).

4. **Element-Vorteil (+20 %) vs. Ketten-Tag (+15 %) — ist die Gewichtung korrekt?**  
   Derzeit sind Element-Boni wertvoller als designte Ketten.

---

*Letzte Überarbeitung: 2026-05-22. Nicht ändern ohne Eintrag hier.*
