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

Alle Spielstände werden über `SaveService` im `localStorage` gespeichert:

```
codex_save           → GachaState (Inventory, Crystals, Deck, Tagesbonus)
codex_guild_save     → GuildState (Boss-HP, Angriffe, Level, Schatz)
codex_energy_save    → EnergyState (Energie, Tränke, letzte Regeneration)
codex_battle_log     → BattleResult[] (letzte Kämpfe)
```

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

## 5. Alpha-/Testmodus Gacha

Der Gacha-Test-Modus ist bewusst aktiviert:

| Konstante | Wert | Zweck |
|---|---|---|
| `STARTING_CRYSTALS` | `999_999` | Alle Karten testbar ohne Grinding |
| `PULL_COST_SINGLE` | `100` | Normal |
| `PULL_COST_MULTI` | `1_000` | Normal (10× Zug) |
| `PITY_THRESHOLD` | `100` | Pity nach 100 Zügen ohne LR |

Der Alpha-Modus **darf nicht geändert werden** bis echte Balancing-Tests stattgefunden haben.
Änderungen nur nach expliziter Entscheidung im Playtest.

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
