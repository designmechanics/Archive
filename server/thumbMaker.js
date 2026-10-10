import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import * as fontkit from 'fontkit';
import { sniffFile, NOT_A_PICTURE_NOTE } from './sniff.js';
import { readPsdMerged } from './psdMerged.js';

/**
 * Server-side thumbnails. Doing this here (libvips, fontkit) instead of in the browser keeps the
 * page responsive: nothing large crosses the network and no canvas work runs on the UI thread.
 *
 *  - raster images: read, resize, write JPEG
 *  - fonts (ttf, otf, woff, woff2, ttc): "Aa" drawn from the font's own outlines
 *  - PSD / PSB: the full merged image (PhotoCraft's reader, `psdMerged.js`), colour managed;
 *    the small JPEG Photoshop stores near the start of the file only when there is no merged image
 *
 * libvips runs as WebAssembly (wasm-vips). The native build (sharp) crashed the whole server now
 * and then (0xC0000409, random files, only with several images at once); in WebAssembly a fault is
 * an exception. Its calls are synchronous, so `makeThumbnail` is only called inside the thumbnail
 * process (`thumbWorker.js`, managed by `thumbProcess.js`), never in the server itself.
 * Only `canMakeThumbnail` is meant for the server.
 */

const RASTER_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.tif', '.tiff']);
const FONT_EXTS = new Set(['.ttf', '.otf', '.woff', '.woff2', '.ttc']);
const PSD_EXTS = new Set(['.psd', '.psb']);

export const THUMB_EXTS = new Set([...RASTER_EXTS, ...FONT_EXTS, ...PSD_EXTS]);

const require = createRequire(import.meta.url);
const MAX_INPUT_BYTES = 400 * 1024 * 1024; // bigger files are read from disk, not into memory

/** An error whose `note` is the plain reason shown on the grid tile. */
const noted = (note) => Object.assign(new Error(note), { note });

let vipsReady = null;
function getVips() {
  if (!vipsReady) {
    vipsReady = import('wasm-vips').then(async ({ default: Vips }) => {
      const vips = await Vips({ dynamicLibraries: ['vips-heif.wasm', 'vips-resvg.wasm'] }); // AVIF, SVG
      vips.Cache.max(0); // every file is seen once; a cache only holds memory
      return vips;
    });
  }
  return vipsReady;
}

/**
 * Resized to 420 px wide (never enlarged), EXIF-rotated, transparency on `background`, as JPEG.
 * `input` is a Buffer, or a file path for files too big to hold in memory (read from disk,
 * shrinking while it loads).
 */
async function writeJpeg(input, outputPath, { quality, background = [255, 255, 255] }) {
  const vips = await getVips();
  const opts = { height: 100000, size: 'down', fail_on: 'none' };
  const im = typeof input === 'string' ? vips.Image.thumbnail(input, W, opts) : vips.Image.thumbnailBuffer(input, W, opts);
  const keep = [im];
  try {
    let out = im;
    if (!['srgb', 'b-w'].includes(out.interpretation)) keep.push((out = out.colourspace('srgb'))); // CMYK, 16-bit, Lab
    if (out.hasAlpha()) keep.push((out = out.flatten({ background })));
    await fs.promises.writeFile(outputPath, out.writeToBuffer('.jpg', { Q: quality }));
  } finally {
    for (const i of keep) i.delete(); // wasm memory is not garbage-collected
  }
}

const extOf = (filePath) => {
  const dot = (filePath || '').lastIndexOf('.');
  return dot >= 0 ? filePath.slice(dot).toLowerCase() : '';
};

export function canMakeThumbnail(filePath) {
  return THUMB_EXTS.has(extOf(filePath));
}

const W = 420;
const H = 315;

async function rasterThumbnail(inputPath, outputPath) {
  const { size } = await fs.promises.stat(inputPath);
  // transparent PNG/GIF/WebP go onto white, as JPEG has no alpha
  const input = size > MAX_INPUT_BYTES ? inputPath : await fs.promises.readFile(inputPath);
  await writeJpeg(input, outputPath, { quality: 85 });
}

// Liberation Sans (SIL OFL) ships with pdf.js, which the app already depends on
let labelFont;
function drawLabel(text, px) {
  try {
    labelFont ||= fontkit.create(fs.readFileSync(require.resolve('pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf')));
    const run = labelFont.layout(text);
    const scale = px / labelFont.unitsPerEm;
    let x = 0;
    const svg = run.glyphs
      .map((g, i) => {
        const p = `<path transform="translate(${x * scale} 0) scale(${scale} ${-scale})" d="${g.path.toSVG()}"/>`;
        x += run.positions[i].xAdvance;
        return p;
      })
      .join('');
    return { svg, width: Math.min(x * scale, W - 20) };
  } catch {
    return null;
  }
}

async function fontThumbnail(inputPath, outputPath) {
  const stat = await fs.promises.stat(inputPath);
  if (stat.size > 20 * 1024 * 1024) throw new Error('font too large');
  const buf = await fs.promises.readFile(inputPath);
  let font;
  try {
    const created = fontkit.create(buf);
    font = created.fonts ? created.fonts[0] : created;
  } catch {
    throw noted('Font cannot be read');
  }
  if (!font) throw noted('Font cannot be read');
  const upm = font.unitsPerEm || 1000;

  // Glyphs for `text`, or, for icon and symbol fonts that have no letters, the first glyphs the
  // font actually draws. Returns [{ glyph, advance }].
  const glyphsFor = (text, count) => {
    try {
      const run = font.layout(text);
      const out = run.glyphs.map((glyph, i) => ({ glyph, advance: run.positions[i].xAdvance }));
      if (out.some((g) => g.glyph.id !== 0 && g.glyph.path.commands.length)) return out;
    } catch {}
    const out = [];
    for (let id = 1; id < (font.numGlyphs || 0) && out.length < count; id++) {
      try {
        const glyph = font.getGlyph(id);
        if (glyph.path.commands.length) out.push({ glyph, advance: glyph.advanceWidth || upm });
      } catch {}
    }
    return out;
  };
  const drawRow = (glyphs, px) => {
    const scale = px / upm;
    let x = 0;
    const paths = glyphs.map(({ glyph, advance }) => {
      const p = `<path transform="translate(${x * scale} 0) scale(${scale} ${-scale})" d="${glyph.path.toSVG()}"/>`;
      x += advance;
      return p;
    });
    return { svg: paths.join(''), width: x * scale };
  };

  const big = drawRow(glyphsFor('Aa', 2), 170); // the big "Aa"
  const small = drawRow(glyphsFor('Hamburgefonstiv', 10), 26); // a short pangram below
  if (!big.svg && !small.svg) throw noted('Font has no drawable glyphs');
  const paths = [big.svg];
  const startX = (W - Math.min(big.width, W)) / 2;
  const baseline = H * 0.58;
  const spaths = [small.svg];
  const swidth = Math.min(small.width, W);

  // The font's name, drawn as outlines in Liberation Sans: the WebAssembly SVG renderer has no
  // system fonts, so an SVG <text> would come out blank
  const label = drawLabel((font.fullName || font.familyName || path.basename(inputPath)).slice(0, 44), 12);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="${W}" height="${H}" fill="#10161d"/>` +
    `<g fill="#e9edf2"><g transform="translate(${startX} ${baseline})">${paths.join('')}</g>` +
    `<g transform="translate(${(W - swidth) / 2} ${H * 0.78})">${spaths.join('')}</g></g>` +
    (label ? `<g fill="#8d96a0" transform="translate(${(W - label.width) / 2} ${H - 14})">${label.svg}</g>` : '') +
    `</svg>`;
  await writeJpeg(Buffer.from(svg), outputPath, { quality: 88, background: [16, 22, 29] });
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

/**
 * The PSD's full merged image (PhotoCraft's reader, `psdMerged.js`) shrunk to `maxSide`, colour
 * managed by libvips: CMYK through the file's own ICC profile (vips' built-in CMYK profile when it
 * has none), transparency onto white. Returns false when the file has no usable merged image
 * (saved without "Maximize Compatibility", or all blank), so the caller can fall back.
 */
async function psdMergedJpeg(inputPath, outputPath, maxSide, quality) {
  let m;
  try {
    m = await readPsdMerged(inputPath, maxSide);
  } catch {
    return false;
  }
  const vips = await getVips();
  const keep = [];
  const track = (im) => (keep.push(im), im);
  try {
    let im = track(vips.Image.newFromMemory(m.pixels, m.width, m.height, m.bands, 'uchar'));
    if (m.kind === 'lab') {
      // 8-bit PSD Lab → CIE Lab (L 0..100, a/b −128..127), then libvips converts to sRGB
      const extra = m.bands - 3;
      im = track(im.linear([100 / 255, 1, 1, ...Array(extra).fill(1)], [0, -128, -128, ...Array(extra).fill(0)]));
      im = track(im.copy({ interpretation: 'lab' }));
      im = track(im.colourspace('srgb'));
    }
    im = track(im.copy({ interpretation: m.kind === 'cmyk' ? 'cmyk' : m.kind === 'grey' ? 'b-w' : 'srgb' }));
    if (m.icc) im.setBlob('icc-profile-data', m.icc);
    if (m.kind === 'cmyk') {
      im = track(m.icc ? im.iccTransform('srgb', { embedded: true }) : im.iccTransform('srgb', { input_profile: 'cmyk' }));
    } else if (m.icc && m.kind !== 'lab') {
      try {
        im = track(im.iccTransform('srgb', { embedded: true }));
      } catch {} // a broken profile on an RGB/grey file: use the pixels as they are
    }
    if (im.hasAlpha()) im = track(im.flatten({ background: [255, 255, 255] }));
    if (im.min() >= 250) return false; // blank merged image: the layers were never flattened into it
    await fs.promises.writeFile(outputPath, im.writeToBuffer('.jpg', { Q: quality }));
    return true;
  } finally {
    for (const i of keep) i.delete();
  }
}

/**
 * Large preview of a PSD for the viewer (longest side `maxSide`), as JPEG. Resolves to 'merged',
 * or 'stored' when only the small preview Photoshop stores could be used.
 */
export async function renderPsdPreview(inputPath, outputPath, maxSide) {
  if (await psdMergedJpeg(inputPath, outputPath, maxSide, 90)) return 'merged';
  await psdStoredPreview(inputPath, outputPath);
  return 'stored';
}

async function psdThumbnail(inputPath, outputPath) {
  // twice the tile size, then libvips shrinks it to 420 px wide with a proper filter
  if (await psdMergedJpeg(inputPath, outputPath, W * 2, 88)) {
    await shrinkJpegInPlace(outputPath);
    return;
  }
  await psdStoredPreview(inputPath, outputPath);
}

async function shrinkJpegInPlace(filePath) {
  await writeJpeg(await fs.promises.readFile(filePath), filePath, { quality: 88 });
}

async function psdStoredPreview(inputPath, outputPath) {
  const fh = await fs.promises.open(inputPath, 'r');
  try {
    const { size } = await fh.stat();
    let want = Math.min(size, 512 * 1024);
    for (let attempt = 0; attempt < 4; attempt++) {
      const buf = Buffer.alloc(want);
      const { bytesRead } = await fh.read(buf, 0, want, 0);
      const r = psdPreviewJpeg(buf.subarray(0, bytesRead));
      if (r.status === 'found') {
        await writeJpeg(r.jpeg, outputPath, { quality: 88 });
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

/**
 * Writes a JPEG thumbnail of `inputPath` to `outputPath`. The file's first bytes decide how, not
 * its name (a PSD saved as .jpg is drawn as a PSD). Throws if it cannot be made; when the file is
 * simply not a picture the error carries `note`, the reason shown on its tile.
 */
export async function makeThumbnail(inputPath, outputPath) {
  const kind = await sniffFile(inputPath);
  if (NOT_A_PICTURE_NOTE[kind]) throw noted(NOT_A_PICTURE_NOTE[kind]);
  if (kind === 'psd') return psdThumbnail(inputPath, outputPath);
  if (kind === 'font') return fontThumbnail(inputPath, outputPath);
  return rasterThumbnail(inputPath, outputPath); // jpeg, png, gif, webp, tiff, avif
}
