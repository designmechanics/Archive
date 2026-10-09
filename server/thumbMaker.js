import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import * as fontkit from 'fontkit';

/**
 * Server-side thumbnails. Doing this here (libvips, fontkit) instead of in the browser keeps the
 * page responsive: nothing large crosses the network and no canvas work runs on the UI thread.
 *
 *  - raster images: read, resize, write JPEG
 *  - fonts (ttf, otf, woff, woff2, ttc): "Aa" drawn from the font's own outlines
 *  - PSD / PSB: the small JPEG preview Photoshop stores near the start of the file
 */

const RASTER_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.tif', '.tiff']);
const FONT_EXTS = new Set(['.ttf', '.otf', '.woff', '.woff2', '.ttc']);
const PSD_EXTS = new Set(['.psd', '.psb']);

export const SHARP_EXTS = new Set([...RASTER_EXTS, ...FONT_EXTS, ...PSD_EXTS]);

const extOf = (filePath) => {
  const dot = (filePath || '').lastIndexOf('.');
  return dot >= 0 ? filePath.slice(dot).toLowerCase() : '';
};

export function canMakeThumbnail(filePath) {
  return SHARP_EXTS.has(extOf(filePath));
}

const W = 420;
const H = 315;

async function rasterThumbnail(inputPath, outputPath) {
  await sharp(inputPath, { failOn: 'none', limitInputPixels: 1_000_000_000, sequentialRead: true })
    .rotate() // honour EXIF orientation
    .resize({ width: W, withoutEnlargement: true })
    .flatten({ background: '#ffffff' }) // transparent PNG/GIF/WebP onto white, as JPEG has no alpha
    .jpeg({ quality: 85 })
    .toFile(outputPath);
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function fontThumbnail(inputPath, outputPath) {
  const stat = await fs.promises.stat(inputPath);
  if (stat.size > 20 * 1024 * 1024) throw new Error('font too large');
  const buf = await fs.promises.readFile(inputPath);
  const created = fontkit.create(buf);
  const font = created.fonts ? created.fonts[0] : created;

  const upm = font.unitsPerEm || 1000;
  const size = 170; // px for the big "Aa"
  const scale = size / upm;
  const run = font.layout('Aa');
  let x = 0;
  const paths = [];
  run.glyphs.forEach((g, i) => {
    const pos = run.positions[i];
    paths.push(
      `<path transform="translate(${(x + pos.xOffset) * scale} 0) scale(${scale} ${-scale})" d="${g.path.toSVG()}"/>`
    );
    x += pos.xAdvance;
  });
  const width = x * scale;
  const startX = (W - width) / 2;
  const baseline = H * 0.58;

  // second line: a short pangram at a small size
  const small = font.layout('Hamburgefonstiv');
  const ssize = 26;
  const sscale = ssize / upm;
  let sx = 0;
  const spaths = [];
  small.glyphs.forEach((g, i) => {
    const pos = small.positions[i];
    spaths.push(`<path transform="translate(${(sx + pos.xOffset) * sscale} 0) scale(${sscale} ${-sscale})" d="${g.path.toSVG()}"/>`);
    sx += pos.xAdvance;
  });
  const swidth = sx * sscale;

  const label = esc((font.fullName || font.familyName || path.basename(inputPath)).slice(0, 44));
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="${W}" height="${H}" fill="#10161d"/>` +
    `<g fill="#e9edf2"><g transform="translate(${startX} ${baseline})">${paths.join('')}</g>` +
    `<g transform="translate(${(W - swidth) / 2} ${H * 0.78})">${spaths.join('')}</g></g>` +
    `<text x="${W / 2}" y="${H - 14}" text-anchor="middle" font-size="12" fill="#8d96a0" font-family="monospace">${label}</text>` +
    `</svg>`;
  await sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toFile(outputPath);
}

/** Finds the JPEG in a PSD's image-resource block (resource 1036, or the older BGR 1033). */
function psdPreviewJpeg(b) {
  if (b.length < 30 || b.toString('latin1', 0, 4) !== '8BPS') return { status: 'none' };
  let pos = 26;
  if (pos + 4 > b.length) return { status: 'need-more', bytesNeeded: pos + 4 };
  pos += 4 + b.readUInt32BE(pos); // colour mode data
  if (pos + 4 > b.length) return { status: 'need-more', bytesNeeded: pos + 4 };
  const resEnd = pos + 4 + b.readUInt32BE(pos);
  pos += 4;
  while (pos + 12 <= resEnd) {
    if (pos + 12 > b.length) return { status: 'need-more', bytesNeeded: Math.min(resEnd, pos + 12) };
    if (b.toString('latin1', pos, pos + 4) !== '8BIM') break;
    const id = b.readUInt16BE(pos + 4);
    const nameLen = b[pos + 6];
    let p = pos + 7 + nameLen;
    if ((nameLen + 1) % 2 === 1) p += 1;
    if (p + 4 > b.length) return { status: 'need-more', bytesNeeded: p + 4 };
    const size = b.readUInt32BE(p);
    const start = p + 4;
    const end = start + size;
    if (id === 1036 || id === 1033) {
      if (end > b.length) return { status: 'need-more', bytesNeeded: end };
      if (b.readUInt32BE(start) === 1 && size > 28) return { status: 'found', jpeg: b.subarray(start + 28, end) };
      return { status: 'none' };
    }
    pos = end + (size % 2);
  }
  return { status: 'none' };
}

async function psdThumbnail(inputPath, outputPath) {
  const fh = await fs.promises.open(inputPath, 'r');
  try {
    const { size } = await fh.stat();
    let want = Math.min(size, 512 * 1024);
    for (let attempt = 0; attempt < 4; attempt++) {
      const buf = Buffer.alloc(want);
      const { bytesRead } = await fh.read(buf, 0, want, 0);
      const r = psdPreviewJpeg(buf.subarray(0, bytesRead));
      if (r.status === 'found') {
        await sharp(r.jpeg, { failOn: 'none' }).resize({ width: W, withoutEnlargement: true }).jpeg({ quality: 88 }).toFile(outputPath);
        return;
      }
      if (r.status === 'none' || want >= size) break;
      want = Math.min(size, r.bytesNeeded + 1024, 16 * 1024 * 1024);
    }
    throw new Error('no preview stored in this PSD');
  } finally {
    await fh.close();
  }
}

/** Writes a JPEG thumbnail of `inputPath` to `outputPath`. Throws if it cannot be made. */
export async function makeThumbnail(inputPath, outputPath) {
  const ext = extOf(inputPath);
  if (RASTER_EXTS.has(ext)) return rasterThumbnail(inputPath, outputPath);
  if (FONT_EXTS.has(ext)) return fontThumbnail(inputPath, outputPath);
  if (PSD_EXTS.has(ext)) return psdThumbnail(inputPath, outputPath);
  throw new Error('unsupported type');
}

// kept for callers that only deal with raster images
export const makeImageThumbnail = makeThumbnail;
