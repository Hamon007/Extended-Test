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

/**
 * Zuordnung artwork_key → relativer Pfad unter /public.
 * Nur Karten eintragen die ein echtes Artwork haben.
 */
const ARTWORK_MAP: Record<string, string> = {
  // ── Bestehende Karten ─────────────────────────────────────
  azazel_base:            '/assets/cards/azazel.png',
  loki_base:              '/assets/cards/loki.png',
  satan_base:             '/assets/cards/satan.png',
  xal_zoth_base:          '/assets/cards/xal_zoth.png',
  azgaroth_base:          '/assets/cards/azgaroth.png',
  jeanne_darc_base:       '/assets/cards/jeanne_darc.png',
  garuda_base:            '/assets/cards/garuda.png',
  leonidas_base:          '/assets/cards/leonidas.png',
  hel_base:               '/assets/cards/hel.png',
  yuki_onna_base:         '/assets/cards/yuki_onna.png',
  baron_samedi_base:      '/assets/cards/baron_samedi.png',
  gor_thul_base:          '/assets/cards/gor_thul.png',
  kaizen_ryujin_base:     '/assets/cards/kaizen_ryujin.png',
  medousa_basileia_base:  '/assets/cards/medousa_basileia.png',
  shuten_doji_base:       '/assets/cards/shuten_doji.png',

  // ── Neue Karten (Batch 2) ─────────────────────────────────
  khepri_base:            '/assets/cards/khepri.png',
  ishtar_base:            '/assets/cards/ishtar.png',
  nidhoggr_base:          '/assets/cards/nidhoggr.png',
  cerberus_base:          '/assets/cards/cerberus.png',
  minotauros_basileus_base: '/assets/cards/minotauros_basileus.png',
  anzu_base:              '/assets/cards/anzu.png',
  nian_base:              '/assets/cards/nian.png',
  wendigo_base:           '/assets/cards/wendigo.png',
  kagutsuchi_base:        '/assets/cards/kagutsuchi.png',
  tomoe_gozen_base:       '/assets/cards/tomoe_gozen.png',
  raijin_base:            '/assets/cards/raijin.png',
  cipactli_base:          '/assets/cards/cipactli.png',
  nergal_base:            '/assets/cards/nergal.png',
  scylla_base:            '/assets/cards/scylla.png',
  arachne_base:           '/assets/cards/arachne.png',
  koschei_base:           '/assets/cards/koschei.png',
  balor_base:             '/assets/cards/balor.png',
  pazuzu_base:            '/assets/cards/pazuzu.png',
  camazotz_base:          '/assets/cards/camazotz.png',
  pele_base:              '/assets/cards/pele.png',

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
