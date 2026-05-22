# Kartenschema — Codex Immortalis

> Quelle: `src/types/Card.ts`  
> Stand: 2026-05-22

---

## Haupt-Interface `Card`

```ts
interface Card {
  // Identität
  id:           string;    // Eindeutig, snake_case (z.B. 'jeanne_darc')
  number:       string;    // Katalognummer wie auf der Karte (z.B. '011')
  name:         string;
  title:        string;    // Untertitel / Epitheton
  quote:        string;    // Zitat auf der Karte
  rarity:       Rarity;
  element:      Element;
  type:         CardType;

  // Fraktion / Lore
  faction?:      string;   // z.B. 'Äsir', 'Rashōmon'
  factionLabel?: string;   // Anzeigename der Fraktion

  // Kampfwerte
  stats:    CardStats;
  skills:   Skill[];
  passives: Passive[];

  // Combo- & Synergiesystem
  combos:    ComboTag[];   // Tags die diese Karte trägt/auslöst
  synergies: Synergy[];    // Explizite Karten-Paar-Synergien

  // Progression
  awakening?: string;      // ID der Awakening-Form (z.B. 'loki_crowned')
  maxLevel?:  number;      // Standard: 100

  // Asset
  image:        string;    // Pfad relativ zu /public
  artwork_key?: string;    // Stabiler Schlüssel → ArtworkMapper.ts

  // Wirtschaft / Handelssystem
  tradeable:    boolean;   // SSR und darunter = true
  globalLimit?: number;    // Weltweites Limit (null = unbegrenzt)

  // Gacha-Parameter
  gachaWeight?: number;    // Relative Ziehwahrscheinlichkeit
  eventOnly?:   boolean;   // Nur während Events verfügbar

  // Deckbuilder-Parameter
  deckLimit?:   number;    // Max. Kopien pro Deck (Standard: 1)
  deckCost?:    number;    // Deck-Slot-Kosten
}
```

---

## Unter-Interfaces

### `CardStats`

```ts
interface CardStats {
  atk:    number;   // Angriffswert
  def:    number;   // Verteidigungswert
  hp:     number;   // Trefferpunkte
  mpCost: number;   // MP-Kosten zum Einsetzen
  spd?:   number;   // Geschwindigkeit (für späteres Battle-Ordering)
  crit?:  number;   // Krit-Chance in % (0–100)
}
```

### `Skill`

```ts
interface Skill {
  name:        string;
  description: string;
  mpCost:      number;
  cooldown?:   number;       // in Runden
  targetType?: TargetType;
  trigger?:    SkillTrigger;
  damage?:     number;       // Schadensmultiplikator (1.0 = 100%)
  effectTag?:  string;       // z.B. 'burn', 'freeze', 'stun'
}
```

### `Passive`

```ts
interface Passive {
  name:        string;
  description: string;
  trigger?:    SkillTrigger;
  condition?:  string;       // z.B. 'hp_below_50', 'on_combo_3+'
  effectTag?:  string;
}
```

### `ComboTag`

```ts
interface ComboTag {
  tag:         string;       // z.B. 'DARK_CHAIN', 'Shadow'
  description: string;       // Was dieser Tag im Combo-System bewirkt
}
```

Zwei Tag-Klassen (→ Details: `docs/combo-design.md`):
- **Klasse A** `lowercase` — Fraktions-/Archetypentags (`Shadow`, `Beast`, …) — 7–11 Karten pro Tag
- **Klasse B** `UPPER_SNAKE_CASE` — Gezielte Ketten-Tags (`DARK_CHAIN`, `WARRIOR_SYNC`, …) — 2–4 Karten pro Tag

### `Synergy`

```ts
interface Synergy {
  cardId:      string;       // ID der Synergie-Karte
  description: string;       // Was die Kombo bewirkt
}
```

> **Hinweis:** 70 Synergy-Einträge existieren in `cards.json`, werden aber derzeit im Battle **nicht ausgewertet**.  
> Geplant für Phase 2 (nach Playtest). → `docs/combo-design.md` §3.

---

## Typen

### `Rarity` (24 Stufen)

```
N | N+ | N++ | N+++
R | R+ | R++ | R+++
SR | SR+ | SR++ | SR+++
SSR | SSR+ | SSR++ | SSR+++
MR | MR+ | MR++ | MR+++
LR | LR+ | LR++ | LR+++
```

Hilfsfunktionen: `rarityMajor('MR++')` → `'MR'`, `raritySubLevel('MR++')` → `2`

### `Element` (11 Typen)

| Wert | Bedeutung |
|---|---|
| `dark` | Finsternis |
| `light` | Licht / Heilig |
| `fire` | Feuer |
| `ice` | Eis / Kälte |
| `void` | Leere / Eldritch |
| `earth` | Erde / Natur |
| `water` | Wasser |
| `lightning` | Blitz / Sturm |
| `wind` | Wind |
| `death` | Tod / Nekromantie |
| `chaos` | Chaos / Wandel |

Element-Vorteile: definiert in `ELEMENT_BEATS` (→ `src/types/ComboTypes.ts`).

### `CardType` (4 Typen)

| Wert | Bedeutung |
|---|---|
| `attacker` | Schaden, Hauptangreifer |
| `vanguard` | Vorhut, Tank, Frontlinie |
| `support` | Buffs, Debuffs, Heilung |
| `combo_builder` | Combo-Aufbau, MP-Regen |

### `SkillTrigger` (6 Typen)

`active` · `on_enter` · `on_attack` · `on_death` · `on_combo` · `passive`

### `TargetType` (6 Typen)

`single` · `all` · `self` · `ally` · `all_allies` · `random`

---

## Fusion & Progression

Fusionswerte werden **nicht in `cards.json` gespeichert**, sondern zur Laufzeit berechnet:

| System | Datei | Methode |
|---|---|---|
| Fusion-Stats (+/++/+++) | `FusionSystem.ts` | `getEffectiveStats(card, rarity, level)` |
| Level-Boni | `LevelSystem.ts` | `getEffectiveStats(card, rarity, level)` |
| Awakening-Form | `AwakeningSystem.ts` | `awaken(state, uuid)` |

`cards.json` enthält immer nur die **Basis-Stats** (Stufe 1, unaufgestiegen).

---

## Artwork-Auflösung

```
card.image         → direkter Pfad (für Abwärtskompatibilität)
card.artwork_key   → stabiler Schlüssel → ArtworkMapper.resolveArtwork(key)
                     → ARTWORK_PLACEHOLDER ('') wenn kein Artwork vorhanden
                     → CardThumbnail zeigt dann Emoji-Fallback
```

→ Details: `docs/ASSET_PIPELINE.md`
