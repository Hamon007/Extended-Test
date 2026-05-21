# Codex Immortalis — PWA Setup & Testanleitung

## Was wurde konfiguriert

| Datei | Inhalt |
|-------|--------|
| `vite.config.ts`          | `VitePWA`-Plugin: generateSW, Manifest, Workbox-Caching |
| `public/icon-192.png`     | App-Icon 192×192 (any) |
| `public/icon-512.png`     | App-Icon 512×512 (any) |
| `public/icon-maskable-512.png` | Maskable Icon 512×512 |
| `public/offline.html`     | Statische Offline-Fallback-Seite |
| `src/pwa.ts`              | SW-Registrierung + Update-Handling |
| `src/main.tsx`            | ruft `initPWA()` beim Start |
| `index.html`              | Apple-Meta-Tags, theme-color, apple-touch-icon |

---

## Build & Start

```bash
# Abhängigkeiten installieren
npm install

# Produktionsbuild (SW + Manifest werden generiert)
npm run build

# Vorschau mit lokalem Server (nötig für SW-Test)
npm run preview
# → http://localhost:4173
```

> ⚠️ Der Service Worker läuft **nur im Produktionsbuild** (`npm run build`).  
> `npm run dev` hat den SW deaktiviert (devOptions.enabled: false) — das ist Absicht.

---

## Generierte SW-Dateien (in `dist/`)

| Datei | Beschreibung |
|-------|-------------|
| `dist/sw.js`              | Haupt-Service-Worker (Workbox) |
| `dist/workbox-*.js`       | Workbox-Runtime |
| `dist/manifest.webmanifest` | Web App Manifest |

---

## Caching-Strategie

| Ressource | Strategie | Cache-Name | TTL |
|-----------|-----------|------------|-----|
| JS / CSS / HTML | Pre-Cache (Vite-Bundle) | workbox-precache | Build-Version |
| Icons + offline.html | Pre-Cache | workbox-precache | Build-Version |
| `/assets/cards/*.png` | StaleWhileRevalidate | card-images | 30 Tage |
| `/assets/enemies/*.png` | CacheFirst | enemy-images | 7 Tage |
| Google Fonts CSS | StaleWhileRevalidate | google-fonts-stylesheets | ∞ |
| Google Fonts Dateien | CacheFirst | google-fonts-webfonts | 1 Jahr |
| SPA-Navigation | navigateFallback → `/index.html` | — | — |

**Karten-Artworks** (3–4 MB pro Datei) werden **nicht** pre-gecacht, sondern beim ersten
Abrufen im Browser in `card-images` gespeichert und danach offline verfügbar.

---

## PWA-Test mit Chrome DevTools

1. `npm run build && npm run preview`
2. Chrome → `http://localhost:4173`
3. DevTools → **Lighthouse** → Kategorie **Progressive Web App** → Analyse starten

### Erwartetes Ergebnis (Lighthouse)

| Check | Erwartung |
|-------|-----------|
| Installierbar | ✓ |
| Web App Manifest | ✓ |
| Service Worker | ✓ |
| HTTPS (localhost gilt) | ✓ |
| Offline-Startseite | ✓ |
| Icons (192 + 512) | ✓ |
| theme-color | ✓ |

---

## Offline-Test (Schritt für Schritt)

```
1. npm run preview → Browser öffnen
2. App einmal vollständig laden (alle Tabs aufrufen)
3. DevTools → Application → Service Workers → prüfen ob "Activated and running"
4. DevTools → Network → Throttling auf "Offline" setzen
5. Seite neu laden (F5)
   → App startet aus dem Cache
   → Karten die bereits angezeigt wurden, laden aus "card-images" Cache
6. DevTools → Application → Cache Storage → "card-images" prüfen
```

---

## Installationstest (Android Chrome)

```
1. Produktionsserver starten (oder ngrok-Tunnel für HTTPS):
   npx serve dist -p 3000
   # oder: npx ngrok http 3000

2. Auf Android-Chrome die ngrok-URL öffnen

3. Nach ~30 Sekunden erscheint Banner:
   "Codex Immortalis zu Startbildschirm hinzufügen"

4. Alternativ: Browser-Menü → "Zum Startbildschirm hinzufügen"

5. App öffnet sich in standalone-Mode (ohne Browser-UI)
```

---

## Installationstest (iOS Safari)

```
1. Produktionsserver per HTTPS erreichbar machen (ngrok)
2. Safari → URL öffnen
3. Teilen-Button → "Zum Home-Bildschirm" 
4. App-Name: "Immortalis" (short_name)
5. Öffnet sich ohne Safari-UI
```

---

## Update-Verhalten

Der SW ist auf **autoUpdate** konfiguriert:
- Wenn ein neuer Build deployed wird, erkennt der SW die Änderung
- `onNeedRefresh` wird aufgerufen → SW übernimmt sofort (kein Nutzereingriff)
- Beim nächsten Seitenaufruf ist die neue Version aktiv

---

## Bekannte Einschränkungen

| Einschränkung | Grund |
|---------------|-------|
| Karten-Artworks offline erst nach erstem Laden | Zu groß für Pre-Cache (3–4 MB/Stück) |
| iOS Safari: keine Push-Notifications | Plattform-Limit |
| iOS Safari: kein "Install"-Banner | Nur manuell über Share-Menü |
| Google Fonts offline erst nach erstem Laden | Externe Domain |

---

## Ordnerstruktur (PWA-relevante Dateien)

```
codex-cards/
├── public/
│   ├── icon-192.png           ← App-Icon
│   ├── icon-512.png           ← App-Icon groß
│   ├── icon-maskable-512.png  ← Maskable für Android
│   └── offline.html           ← Statische Offline-Seite
├── src/
│   ├── pwa.ts                 ← SW-Registrierung
│   └── main.tsx               ← initPWA() Aufruf
├── vite.config.ts             ← VitePWA-Konfiguration
└── index.html                 ← Apple-Meta-Tags
```

---

## Manifest-Übersicht

```json
{
  "name":             "Codex Immortalis",
  "short_name":       "Immortalis",
  "theme_color":      "#0D0B0F",
  "background_color": "#050307",
  "display":          "standalone",
  "orientation":      "portrait",
  "start_url":        "/"
}
```
