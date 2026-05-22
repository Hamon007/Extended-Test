# QA-Report — Codex Immortalis

> Erstellt: 2026-05-22 · Aktualisiert: 2026-05-22  
> Branch: `claude/chat-access-check-2WFVw` (→ main nach Merge)  
> Build: `tsc && vite build` ✅ (0 Fehler, 0 Warnungen)  
>
> **Änderungen (Update):**  
> - localStorage-Schlüssel korrigiert (waren `codex_*`, sind `ci_*`)  
> - `BattleResult` als nicht-persistent dokumentiert  
> - README_PWA Caching-Tabelle mit `vite.config.ts` synchronisiert (7 Regeln, `title_bg.jpg` Precache)  
> - Gacha unverändert (Alpha/Testmodus bleibt)

---

## Build-Status

| Prüfung | Ergebnis | Details |
|---|---|---|
| TypeScript (`tsc`) | ✅ | 0 Fehler |
| Vite Build | ✅ | 10.95s, 5 Ausgabedateien |
| Precache-Einträge | ✅ | 10 Einträge, 429 KiB |
| SW generiert | ✅ | `dist/sw.js` + `dist/workbox-*.js` |
| Manifest generiert | ✅ | `dist/manifest.webmanifest` |
| Bundle-Größe | ✅ | JS: 328 KiB (95 KiB gzip), CSS: 100 KiB (16 KiB gzip) |

---

## PWA-Konfiguration

| Prüfung | Ergebnis | Details |
|---|---|---|
| generateSW-Modus | ✅ | Workbox generiert SW automatisch |
| registerType: autoUpdate | ✅ | SW aktualisiert ohne Nutzereingriff |
| clientsClaim + skipWaiting | ✅ | Neue SW-Version übernimmt sofort |
| navigateFallback | ✅ | `/index.html` für SPA-Routing |
| devOptions.enabled: false | ✅ | SW nur im Produktionsbuild |
| Maximale Cache-Dateigröße | ✅ | 5 MiB Limit konfiguriert |

---

## Precache-Einträge

| Typ | Erwartete Einträge |
|---|---|
| JS-Chunks | ✅ |
| CSS | ✅ |
| HTML | ✅ |
| icon-192.png | ✅ |
| icon-512.png | ✅ |
| icon-maskable-512.png | ✅ |
| assets/title_bg.jpg | ✅ (neu hinzugefügt) |
| offline.html | ✅ |
| manifest.webmanifest | ✅ |

---

## Runtime-Caching (7 Regeln)

| Cache-Name | URL-Pattern | Strategie | Status |
|---|---|---|---|
| card-images | `/assets/cards/*.{png,jpg,webp}` | StaleWhileRevalidate | ✅ |
| enemy-images | `/assets/enemies/*.{png,jpg,webp}` | CacheFirst | ✅ |
| ui-assets | `/assets/ui/*.{png,jpg,svg}` | CacheFirst | ✅ |
| background-images | `/assets/backgrounds/*.{png,jpg,svg}` | CacheFirst | ✅ |
| character-images | `/assets/characters/*.{png,jpg,svg}` | CacheFirst | ✅ |
| google-fonts-stylesheets | `fonts.googleapis.com` | StaleWhileRevalidate | ✅ |
| google-fonts-webfonts | `fonts.gstatic.com` | CacheFirst | ✅ |

---

## Karten-Daten (`src/data/cards.json`)

| Prüfung | Ergebnis | Details |
|---|---|---|
| Geladen durch | ✅ | `CardDatabase` Singleton |
| Pflichfelder vorhanden | ✅ | id, name, rarity, element, type, stats, skills, passives, combos, synergies |
| ComboTag-Klassen | ✅ | lowercase (Fraktions) + UPPER_SNAKE (Ketten) |
| Synergy-Einträge | ⚠️ | 70 Einträge vorhanden, im Battle **nicht ausgewertet** (by design) |
| artwork_key registriert | ✅ | 35 Keys in ArtworkMapper.ts |
| Karten ohne Artwork | ✅ | Zeigen Emoji-Fallback (kein Fehler) |

---

## Gegner-Daten (`src/data/enemies.json`)

| Prüfung | Ergebnis | Details |
|---|---|---|
| Geladen durch | ✅ | `BattleManager` direkt |
| Pflichtfelder | ✅ | id, name, hp, atk, element |
| Element vorhanden | ✅ | Element-Vorteil wird im `ComboSystem` geprüft |

---

## localStorage-Schlüssel (tatsächliche Keys aus dem Code)

| Schlüssel | Typ | Service | Status |
|---|---|---|---|
| `ci_gacha_state` | GachaState | `SaveService` | ✅ |
| `ci_deck_main` | Deck | `SaveService` | ✅ |
| `ci_settings` | Settings | `SaveService` | ✅ |
| `ci_last_login` | string (ISO-Datum) | `SaveService` | ✅ |
| `ci_battle_energy` | EnergyState | `EnergyService` | ✅ |
| `ci_daily_bonus_date` | string (YYYY-MM-DD) | `ProgressionService` | ✅ |
| `ci_guild_state` | GuildState | `GuildService` | ✅ |

> `BattleResult` wird **nicht** in localStorage gespeichert — nur im React-State der Session.

---

## CardDatabase

| Prüfung | Ergebnis |
|---|---|
| Singleton-Pattern | ✅ |
| `getById(id)` vorhanden | ✅ |
| `getAll()` vorhanden | ✅ |
| Wird geladen bei App-Start | ✅ |

---

## ArtworkMapper

| Prüfung | Ergebnis | Details |
|---|---|---|
| `resolveArtwork(key)` | ✅ | Gibt Pfad oder `''` zurück |
| `hasArtwork(key)` | ✅ | Boolean-Check |
| BASE_URL korrekt | ✅ | `import.meta.env.BASE_URL` — funktioniert lokal + GitHub Pages |
| Fehlende Keys | ✅ | Geben `ARTWORK_PLACEHOLDER = ''` zurück → kein Fehler |

---

## Alpha-Gacha

| Prüfung | Ergebnis | Details |
|---|---|---|
| `STARTING_CRYSTALS = 999_999` | ✅ | Unverändert (by design) |
| Gacha-Modus | ✅ | Alpha/Test — keine Änderung ohne Playtest |
| Pull-Kosten-Logik | ✅ | Unverändert |
| Pity-System | ✅ | `PITY_THRESHOLD = 100` |

---

## Combo-System

| Prüfung | Ergebnis | Details |
|---|---|---|
| Status | ✅ | Eingefroren (MVP) bis Playtest |
| `hasTagSynergy` | ✅ | Alle Tags gleich behandelt (by design) |
| `synergies`-Auswertung | ⚠️ | Nicht implementiert (by design, Phase 2) |
| Design-Dokument | ✅ | `docs/combo-design.md` |

---

## GameConfig.ts

| Prüfung | Ergebnis | Details |
|---|---|---|
| Zentrale Konstanten-Datei | ✅ | `src/config/GameConfig.ts` |
| Alle Typ-Dateien re-exportieren | ✅ | BattleTypes, DeckTypes, GachaTypes, ComboTypes, ProgressionTypes |
| Alle Service-Dateien importieren | ✅ | EnergyService, LevelSystem, FusionSystem, AwakeningSystem, GuildService |

---

## Offene Punkte (kein Blocker)

| Punkt | Priorität | Details |
|---|---|---|
| `synergies`-Auswertung im Battle | Mittel | Wartet auf Playtest-Entscheidung → `docs/combo-design.md` §3 |
| Drei-Stufen-Combo-Design | Mittel | Wartet auf Playtest → `docs/combo-design.md` §4 |
| Karten-Artworks Batch 3 | Niedrig | Gilgamesh, Hercules etc. ausstehend |
| Gegner-Bilder vollständig offline | Niedrig | CacheFirst nur nach erstem Laden verfügbar |
| Element-Beats vollständig definiert | Prüfen | `ELEMENT_BEATS` in `ComboTypes.ts` auf Vollständigkeit prüfen |
| iOS PWA: kein Install-Banner | Bekannt | iOS-Limit, nur manuell über Share-Menü |

---

## Fazit

Der aktuelle Build ist **stabil und deploybar**.  
Alle bekannten Blocker sind behoben.  
Offene Punkte sind bewusste Design-Entscheidungen die auf den Playtest warten.
