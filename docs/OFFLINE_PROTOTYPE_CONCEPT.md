# Offline-Prototype — Konzept & Scope

> **Status: Aktiv.**  
> Dieses Dokument beschreibt den aktuellen Projektzustand als bewusst begrenzten
> Offline-Prototypen — keine Server, kein Login, kein Echtgeld.

---

## 1. Was dieser Prototyp ist

**Codex Immortalis** ist ein guild-zentriertes Social-Gacha-RPG als
vollständig offline-fähige Progressive Web App (PWA).

Technischer Stack:
- **React 18** + **TypeScript** + **Vite** (SPA)
- **vite-plugin-pwa** (Workbox, `generateSW`) — Service Worker, Manifest
- **localStorage** (kein Backend, kein Auth, kein Netzwerk-Request zur Laufzeit)
- Statische Daten: `src/data/cards.json`, `src/data/enemies.json`

Deployment: GitHub Pages (`/Extended-Test/`), HTTPS → PWA-Installation möglich.

---

## 2. Was bewusst NICHT enthalten ist

| Nicht im Scope | Begründung |
|---|---|
| Server / API | Prototyp soll ohne Backend lauffähig sein |
| Login / Accounts | Kein Nutzermanagement in dieser Phase |
| Multiplayer / Gilden-PvP | Erfordert Echtzeit-Backend |
| In-App-Käufe (IAP) | Nicht für Prototyp vorgesehen |
| Push-Notifications | Kein Server, kein FCM |
| Analytics / Telemetrie | Datenschutz, kein Backend |
| Echte Gacha-Preise | Alpha-Modus: `STARTING_CRYSTALS = 999_999` |

---

## 3. Datenhaltung

Alle Spielstände werden im `localStorage` gespeichert (tatsächliche Keys aus dem Code):

```
ci_gacha_state       → GachaState    (SaveService: Inventory, Crystals, PityCounter)
ci_deck_main         → Deck          (SaveService: aktives Deck des Spielers)
ci_settings          → Settings      (SaveService: App-Einstellungen)
ci_last_login        → string        (SaveService: ISO-Datum letzter Login)
ci_battle_energy     → EnergyState   (EnergyService: Energie, Tränke, Regeneration)
ci_daily_bonus_date  → string        (ProgressionService: Datum letzter Tagesbonus)
ci_guild_state       → GuildState    (GuildService: Boss-HP, Angriffe, Level)
ci_account_state     → AccountState  (SaveService: Account-Level, XP, Ausdauer-Max, Mana-Max)
```

`BattleResult` (Kampf-Ergebnis) wird **nicht** persistiert — nur im React-State der laufenden Session.

Keine Cloud-Synchronisation. Spielstand bleibt im Browser des Nutzers.
Löschen via "App-Daten löschen" in den Browser-Einstellungen.

---

## 4. Karten- & Gegner-Daten

| Datei | Inhalt | Geladen durch |
|---|---|---|
| `src/data/cards.json` | Alle Karten: Stats, Skills, Combos, Synergien | `CardDatabase` (Singleton) |
| `src/data/enemies.json` | Gegner: HP, ATK, Element, Skill-Texte | `BattleManager` direkt |

Karten werden beim App-Start einmalig geladen und im Speicher gehalten.
Kein dynamisches Nachladen, keine API-Calls.

---

## 4a. Account-Level-System

Das Account-Level-System ist **getrennt** vom Karten-Level-System und läuft parallel dazu.

| Eigenschaft | Details |
|---|---|
| Startwert | Level 1, 0 XP |
| Keine harte Obergrenze | Level unbegrenzt (Formel: `100 × level^1.35 + level × 50` XP pro Level) |
| Ausdauer-Maximum | `5 + floor((level - 1) / 5)` — steigt alle 5 Level um 1 |
| Mana-Maximum | `500 + (level - 1) × 25` — steigt jedes Level um 25 |
| XP-Quellen | Battle-Sieg (`rewardXp`), Niederlage (Trost: `ACCOUNT_CONSOLATION_XP = 10`) |
| Level-Up-Effekt | Ausdauer und Mana werden auf neues Maximum aufgefüllt |
| localStorage-Key | `ci_account_state` (via `SaveService.loadAccountState` / `saveAccountState`) |
| Karten-Level | **Unabhängig** — bleibt unverändert, separates System |
| Gacha | **Unverändert** — Alpha/Testmodus bleibt bestehen |

MainScreen zeigt Account-Level, XP-Fortschrittsbalken, aktuelle Ausdauer und Mana live an.

---

## 5. Alpha-/Testmodus Gacha

Der Gacha-Test-Modus ist **bewusst aktiviert und bleibt unverändert** bis echte Balancing-Tests
stattgefunden haben. Keine Änderungen an `GachaSystem`, `GachaTypes` oder `SaveService`
ohne explizite Entscheidung nach dem Playtest.

| Konstante | Wert | Zweck |
|---|---|---|
| `STARTING_CRYSTALS` | `999_999` | Alle Karten testbar ohne Grinding |
| `PULL_COST_SINGLE` | `100` | Normal |
| `PULL_COST_MULTI` | `1_000` | Normal (10× Zug) |
| `PITY_THRESHOLD` | `100` | Pity nach 100 Zügen ohne LR |

## 5a. Decksystem (aktueller Stand)

| Konstante | Wert | Bedeutung |
|---|---|---|
| `DECK_SIZE` | `10` | Ein Deck besteht aus genau 10 Karten |
| `MAX_DECK_COST` | `800` | Maximale Gesamt-MP aller Karten im Deck (Budget-Regel) |
| `HAND_LIMIT` | `5` | Max. gleichzeitig sichtbare Karten in der Kampf-Hand |

Das Deck-Budget (`MAX_DECK_COST`) begrenzt welche Karten-Kombinationen möglich sind —
teure Karten (hohe `mpCost`) belegen mehr Budget.

**Hand & Nachziehen im Kampf:** Von den 10 Deck-Karten sind zu Beginn nur die ersten
`HAND_LIMIT` (5) in der Hand. Die übrigen liegen im Nachzieh-Stapel (chronologische
Reihenfolge des Decks). Wird eine Karte gespielt, verlässt sie die Hand und die nächste
Karte aus dem Stapel rückt nach, bis wieder 5 (oder weniger, falls Stapel leer) in der
Hand sind. Konstante: `HAND_LIMIT` in `GameConfig.ts`.

**Kein aktives MR/5-Karten-Limit:** Ein früheres Konzept sah vor, MR/LR-Karten auf 5 pro Deck
zu begrenzen. Diese Regel ist im aktuellen Code **nicht aktiv** — alle Karten werden gleich
behandelt, einzig `DECK_SIZE = 10` und `MAX_DECK_COST = 800` gelten.

---

## 6. PWA-Offline-Verhalten

```
Erste Nutzung (online):
  → App-Shell (JS/CSS/HTML) wird pre-gecacht beim SW-Install
  → Karten-Artworks werden beim ersten Anzeigen in card-images gecacht
  → Enemies-Bilder → enemy-images (CacheFirst, 7 Tage)

Folgende Nutzung (offline möglich):
  → App startet aus workbox-precache
  → Bereits geladene Artworks verfügbar aus card-images
  → Nicht geladene Artworks zeigen Emoji-Fallback (CardThumbnail)
  → localStorage-Daten vollständig verfügbar

Netzwerk-Anforderung zur Laufzeit: KEINE
```

---

## 7. Prototype-Ziel

> Den vollständigen Gacha → Deck → Battle → Progression Loop offline spielbar zu machen,
> um Balancing-Entscheidungen (Combo-System, Rarity-Werte, Energie-Kosten)
> mit echten Spielsessions zu validieren, bevor eine Server-Infrastruktur gebaut wird.

Nächster Meilenstein: **Erster Playtest** (intern, 1–3 Spieler, 20–30 Sessions).  
Danach: Auswertung `docs/combo-design.md` Offene Fragen, Balancing-Anpassungen.
