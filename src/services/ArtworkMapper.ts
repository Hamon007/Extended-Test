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
  azazel_base:            `${B}assets/cards/azazel.png`,
  loki_base:              `${B}assets/cards/loki.png`,
  satan_base:             `${B}assets/cards/satan.png`,
  xal_zoth_base:          `${B}assets/cards/xal_zoth.png`,
  azgaroth_base:          `${B}assets/cards/azgaroth.png`,
  jeanne_darc_base:       `${B}assets/cards/jeanne_darc.png`,
  garuda_base:            `${B}assets/cards/garuda.png`,
  leonidas_base:          `${B}assets/cards/leonidas.png`,
  hel_base:               `${B}assets/cards/hel.png`,
  yuki_onna_base:         `${B}assets/cards/yuki_onna.png`,
  baron_samedi_base:      `${B}assets/cards/baron_samedi.png`,
  gor_thul_base:          `${B}assets/cards/gor_thul.png`,
  kaizen_ryujin_base:     `${B}assets/cards/kaizen_ryujin.png`,
  medousa_basileia_base:  `${B}assets/cards/medousa_basileia.png`,
  shuten_doji_base:       `${B}assets/cards/shuten_doji.png`,

  // ── Neue Karten (Batch 2) ─────────────────────────────────
  khepri_base:            `${B}assets/cards/khepri.png`,
  ishtar_base:            `${B}assets/cards/ishtar.png`,
  nidhoggr_base:          `${B}assets/cards/nidhoggr.png`,
  cerberus_base:          `${B}assets/cards/cerberus.png`,
  minotauros_basileus_base: `${B}assets/cards/minotauros_basileus.png`,
  anzu_base:              `${B}assets/cards/anzu.png`,
  nian_base:              `${B}assets/cards/nian.png`,
  wendigo_base:           `${B}assets/cards/wendigo.png`,
  kagutsuchi_base:        `${B}assets/cards/kagutsuchi.png`,
  tomoe_gozen_base:       `${B}assets/cards/tomoe_gozen.png`,
  raijin_base:            `${B}assets/cards/raijin.png`,
  cipactli_base:          `${B}assets/cards/cipactli.png`,
  nergal_base:            `${B}assets/cards/nergal.png`,
  scylla_base:            `${B}assets/cards/scylla.png`,
  arachne_base:           `${B}assets/cards/arachne.png`,
  koschei_base:           `${B}assets/cards/koschei.png`,
  balor_base:             `${B}assets/cards/balor.png`,
  pazuzu_base:            `${B}assets/cards/pazuzu.png`,
  camazotz_base:          `${B}assets/cards/camazotz.png`,
  pele_base:              `${B}assets/cards/pele.png`,

  // ── Zukünftige Karten (Artworks ausstehend) ───────────────
  // gilgamesh_base: '/assets/cards/gilgamesh.png',
  // hercules_base:  '/assets/cards/hercules.png',
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
