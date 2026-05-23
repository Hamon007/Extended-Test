/**
 * Konvertiert alle Karten-Artworks in public/assets/cards/ nach WebP.
 *
 * - Einheitliche Zielauflösung: 800x1200 (2:3) — reicht für Detail-Modal in voller Größe
 *   auf Retina-Displays und ist >10x kleiner als die 1024x1536 PNG-Originale.
 * - WebP Quality 85 — visuell verlustfrei für Artworks, sehr kleine Dateien.
 * - PNG- und JPG-Originale werden nach erfolgreicher Konvertierung gelöscht
 *   (Backup liegt im Branch `backup/card-images-png-original`).
 *
 * Aufruf: node scripts/optimize-cards.mjs
 */
import { readdir, stat, unlink } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import sharp from 'sharp';

const SRC_DIR        = 'public/assets/cards';
const TARGET_WIDTH   = 800;
const TARGET_HEIGHT  = 1200;
const WEBP_QUALITY   = 85;
const SOURCE_FORMATS = new Set(['.png', '.jpg', '.jpeg']);

async function fileSize(path) {
  const s = await stat(path);
  return s.size;
}

function fmt(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function convertOne(srcPath) {
  const ext  = extname(srcPath).toLowerCase();
  const base = basename(srcPath, ext);
  const dest = join(SRC_DIR, `${base}.webp`);

  const srcSize = await fileSize(srcPath);

  await sharp(srcPath)
    .resize(TARGET_WIDTH, TARGET_HEIGHT, { fit: 'cover', position: 'top' })
    .webp({ quality: WEBP_QUALITY, effort: 6 })
    .toFile(dest);

  const destSize = await fileSize(dest);
  await unlink(srcPath);

  return { name: `${base}${ext}`, srcSize, destSize };
}

async function main() {
  const entries = await readdir(SRC_DIR);
  const sources = entries.filter(f => SOURCE_FORMATS.has(extname(f).toLowerCase()));

  if (sources.length === 0) {
    console.log('Keine PNG/JPG-Quelldateien gefunden — nichts zu tun.');
    return;
  }

  console.log(`→ ${sources.length} Bild(er) werden auf ${TARGET_WIDTH}×${TARGET_HEIGHT} WebP (q${WEBP_QUALITY}) konvertiert…\n`);

  let totalSrc  = 0;
  let totalDest = 0;
  for (const file of sources) {
    const result = await convertOne(join(SRC_DIR, file));
    totalSrc  += result.srcSize;
    totalDest += result.destSize;
    const ratio = ((1 - result.destSize / result.srcSize) * 100).toFixed(1);
    console.log(`  ${result.name.padEnd(34)} ${fmt(result.srcSize).padStart(10)} → ${fmt(result.destSize).padStart(10)}  (-${ratio}%)`);
  }

  const savings = ((1 - totalDest / totalSrc) * 100).toFixed(1);
  console.log(`\n✓ Gesamt: ${fmt(totalSrc)} → ${fmt(totalDest)}  (-${savings}%)`);
}

main().catch(err => {
  console.error('Fehler:', err);
  process.exit(1);
});
