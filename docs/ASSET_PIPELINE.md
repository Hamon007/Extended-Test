# Asset-Pipeline — Codex Immortalis

> Stand: 2026-05-22  
> Betrifft: Karten-Artworks, UI-Assets, Hintergründe, Charakter-Grafiken

---

## 1. Das Problem

Karten-IDs und Dateinamen können sich ändern (Rename, Refactor).  
`artwork_key` in `cards.json` bleibt **stabil** — nur `ArtworkMapper.ts` muss angepasst werden,
wenn ein Artwork eintrifft oder umbenannt wird. `cards.json` bleibt unverändert.

---

## 2. Artwork-Auflösung (`ArtworkMapper.ts`)

```
card.artwork_key
      │
      ▼
ArtworkMapper.resolveArtwork(key)
      │
      ├─ key vorhanden in ARTWORK_MAP  →  Pfad (z.B. '/Extended-Test/assets/cards/azazel.png')
      └─ key fehlt / undefined         →  ARTWORK_PLACEHOLDER ('')
                                              │
                                              ▼
                                        CardThumbnail zeigt Emoji-Fallback
```

**Datei:** `src/services/ArtworkMapper.ts`

Drei exportierte Funktionen:

| Funktion | Rückgabe | Zweck |
|---|---|---|
| `resolveArtwork(key)` | `string` | Pfad oder `''` (Placeholder) |
| `hasArtwork(key)` | `boolean` | Prüft ob echtes Artwork existiert |
| `getAllArtworkKeys()` | `string[]` | Alle bekannten Keys (Debug/Admin) |

---

## 3. Neue Artworks eintragen

Wenn ein neues Artwork für eine Karte eintrifft:

1. Datei in `public/assets/cards/` ablegen (z.B. `public/assets/cards/gilgamesh.png`)
2. In `ArtworkMapper.ts` in `ARTWORK_MAP` eintragen:
   ```ts
   gilgamesh_base: `${B}assets/cards/gilgamesh.png`,
   ```
3. `cards.json` **nicht** ändern — `artwork_key` war bereits gesetzt

> Keine neue Komponente, kein Import, kein Rebuild der Kartendaten nötig.

---

## 4. Ordnerstruktur

```
public/
├── assets/
│   ├── cards/           ← Karten-Artworks (.png)
│   │   ├── azazel.png
│   │   ├── loki.png
│   │   └── ...          (35 Artworks vorhanden, Stand 2026-05-22)
│   ├── enemies/         ← Gegner-Bilder (.png / .jpg)
│   ├── ui/              ← UI-Elemente, Buttons, Icons, Rahmen
│   ├── backgrounds/     ← Hintergrundbilder für Screens
│   ├── characters/      ← Charakter-Artwork (Gilde, Profil, Story)
│   └── title_bg.jpg     ← TitleScreen-Hintergrundbild (pre-gecacht)
├── icon-192.png
├── icon-512.png
├── icon-maskable-512.png
└── offline.html
```

---

## 5. PWA-Caching je Asset-Typ

| Ordner | Cache-Strategie | Cache-Name | TTL | Begründung |
|---|---|---|---|---|
| `/assets/cards/` | StaleWhileRevalidate | card-images | 30 Tage | Artworks können aktualisiert werden |
| `/assets/enemies/` | CacheFirst | enemy-images | 7 Tage | Stabil, selten geändert |
| `/assets/ui/` | CacheFirst | ui-assets | 30 Tage | UI-Elemente sehr stabil |
| `/assets/backgrounds/` | CacheFirst | background-images | 30 Tage | Stabil |
| `/assets/characters/` | CacheFirst | character-images | 30 Tage | Stabil |
| `title_bg.jpg` | Pre-Cache (SW-Install) | workbox-precache | Build-Version | Wird beim Start sofort gebraucht |

**StaleWhileRevalidate** (card-images): Sofortige Antwort aus dem Cache, gleichzeitig im
Hintergrund aktualisieren. Sinnvoll für Artworks die sich gelegentlich ändern können.

**CacheFirst** (alle anderen): Aus dem Cache laden, nur bei Cache-Miss Netzwerk.
Sinnvoll für stabile Assets die sich kaum ändern.

---

## 6. Placeholder-Verhalten

Wenn `artwork_key` nicht in `ARTWORK_MAP` vorhanden oder leer:

```
ARTWORK_PLACEHOLDER = ''   (leerer String)
```

`CardThumbnail` erkennt leeren String und zeigt einen elementabhängigen Emoji-Fallback:

```
dark → 🌑    light → ✨    fire → 🔥    ice → ❄️
void → 🌀    earth → ⛰️   water → 🌊   lightning → ⚡
wind → 🌪️   death → 💀   chaos → 🌀
```

Kein Bild-404-Fehler, kein Broken-Image-Icon.

---

## 7. Regeln für neue Assets

- **Karten-Artworks:** Immer in `/public/assets/cards/`, immer per `artwork_key` in `ArtworkMapper.ts` registrieren
- **Keine Spritesheets:** Jedes Asset ist eine einzelne Datei (PWA-Caching funktioniert per URL)
- **Dateinamen:** `snake_case`, keine Leerzeichen, keine Sonderzeichen
- **Format:** `.png` für Karten und UI, `.jpg` für Hintergründe (größere Dateien)
- **Maximale Dateigröße:** Workbox-Limit für Pre-Cache: 5 MiB (konfiguriert in `vite.config.ts`)

---

## 8. Aktueller Stand

| Kategorie | Vorhanden | Fehlend |
|---|---|---|
| Karten-Artworks (`artwork_key` registriert) | 35 | Batch 3 ausstehend (gilgamesh, hercules, …) |
| Karten ohne Artwork (`artwork_key` gesetzt, kein Eintrag in Map) | — | Zeigen Emoji-Fallback |
| Gegner-Bilder | vorhanden | — |
| UI-Assets | vorhanden | — |
| Hintergründe | `title_bg.jpg` | weitere geplant |
