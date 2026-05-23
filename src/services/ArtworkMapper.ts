/**
 * ArtworkMapper.ts  –  Codex Immortalis
 * ─────────────────────────────────────────────────────────────
 * Mappt stabile artwork_key-Bezeichner auf tatsächliche
 * Bilddateipfade. Fehlende Einträge → PLACEHOLDER.
 *
 * artwork_key bleibt stabil — nur diese Datei muss angepasst
 * werden wenn neue Artworks eintreffen. cards.json bleibt
 * unverändert.
 * ─────────────────────────────────────────────────────────────
 */

/** Pfad zur Placeholder-Grafik (immer vorhanden) */
export const ARTWORK_PLACEHOLDER = '';   // leerer String → CardThumbnail zeigt Emoji-Fallback

// Vite-BASE_URL endet immer mit '/' — funktioniert lokal ('/') und auf GitHub Pages ('/Extended-Test/')
const B = import.meta.env.BASE_URL;

/**
 * Zuordnung artwork_key → relativer Pfad unter /public.
 * Nur Karten eintragen die ein echtes Artwork haben.
 */
const ARTWORK_MAP: Record<string, string> = {
  // ── Bestehende Karten ─────────────────────────────────────
  azazel_base:            `${B}assets/cards/azazel.webp`,
  loki_base:              `${B}assets/cards/loki.webp`,
  satan_base:             `${B}assets/cards/satan.webp`,
  xal_zoth_base:          `${B}assets/cards/xal_zoth.webp`,
  azgaroth_base:          `${B}assets/cards/azgaroth.webp`,
  jeanne_darc_base:       `${B}assets/cards/jeanne_darc.webp`,
  garuda_base:            `${B}assets/cards/garuda.webp`,
  leonidas_base:          `${B}assets/cards/leonidas.webp`,
  hel_base:               `${B}assets/cards/hel.webp`,
  yuki_onna_base:         `${B}assets/cards/yuki_onna.webp`,
  baron_samedi_base:      `${B}assets/cards/baron_samedi.webp`,
  gor_thul_base:          `${B}assets/cards/gor_thul.webp`,
  kaizen_ryujin_base:     `${B}assets/cards/kaizen_ryujin.webp`,
  medousa_basileia_base:  `${B}assets/cards/medousa_basileia.webp`,
  shuten_doji_base:       `${B}assets/cards/shuten_doji.webp`,

  // ── Neue Karten (Batch 2) ─────────────────────────────────
  khepri_base:            `${B}assets/cards/khepri.webp`,
  ishtar_base:            `${B}assets/cards/ishtar.webp`,
  nidhoggr_base:          `${B}assets/cards/nidhoggr.webp`,
  cerberus_base:          `${B}assets/cards/cerberus.webp`,
  minotauros_basileus_base: `${B}assets/cards/minotauros_basileus.webp`,
  anzu_base:              `${B}assets/cards/anzu.webp`,
  nian_base:              `${B}assets/cards/nian.webp`,
  wendigo_base:           `${B}assets/cards/wendigo.webp`,
  kagutsuchi_base:        `${B}assets/cards/kagutsuchi.webp`,
  tomoe_gozen_base:       `${B}assets/cards/tomoe_gozen.webp`,
  raijin_base:            `${B}assets/cards/raijin.webp`,
  cipactli_base:          `${B}assets/cards/cipactli.webp`,
  nergal_base:            `${B}assets/cards/nergal.webp`,
  scylla_base:            `${B}assets/cards/scylla.webp`,
  arachne_base:           `${B}assets/cards/arachne.webp`,
  koschei_base:           `${B}assets/cards/koschei.webp`,
  balor_base:             `${B}assets/cards/balor.webp`,
  pazuzu_base:            `${B}assets/cards/pazuzu.webp`,
  camazotz_base:          `${B}assets/cards/camazotz.webp`,
  pele_base:              `${B}assets/cards/pele.webp`,

  // ── Zukünftige Karten (Artworks ausstehend) ───────────────
  // gilgamesh_base: '/assets/cards/gilgamesh.webp',
  // hercules_base:  '/assets/cards/hercules.webp',
  // ... weiteres nach Lieferung hier eintragen
};

/**
 * Gibt den Bildpfad für einen artwork_key zurück.
 * Gibt ARTWORK_PLACEHOLDER zurück wenn kein Eintrag vorhanden.
 */
export function resolveArtwork(key: string | undefined): string {
  if (!key) return ARTWORK_PLACEHOLDER;
  return ARTWORK_MAP[key] ?? ARTWORK_PLACEHOLDER;
}

/**
 * Prüft ob ein artwork_key ein echtes Bild hat.
 */
export function hasArtwork(key: string | undefined): boolean {
  if (!key) return false;
  return key in ARTWORK_MAP;
}

/**
 * Gibt alle bekannten artwork_keys zurück (für Debug/Admin).
 */
export function getAllArtworkKeys(): string[] {
  return Object.keys(ARTWORK_MAP);
}
