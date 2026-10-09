import { AssetEntry } from '../types';
import { extractPsdThumbnail } from './psdThumb';
import { findLargestJpeg } from './rawPreview';
import { renderEmbeddedPreview, renderWithGhostscript } from './postscriptRender';
import { parsePfb, glyphNameForChar } from './type1';
import { parsePe } from './binaryInfo';

/**
 * Thumbnail makers for formats the browser cannot show directly (fonts, PSD, EPS/AI/INDD, camera
 * RAW, TIFF). Each one reads as little of the file as it can. Returns a JPEG data URL or null.
 * Loaded on demand from ensureThumbnailForEntry so these libraries stay out of the main bundle.
 */

const THUMB_W = 420;

const extOf = (e: AssetEntry): string => {
  const p = e.filePath || e.title || '';
  const m = /\.([a-z0-9]+)$/i.exec(p);
  return (m ? m[1] : e.exts?.[0] || '').toLowerCase();
};

const FONT_EXTS = new Set(['ttf', 'otf', 'woff', 'woff2']);
const PS_EXTS = new Set(['eps', 'ai', 'indd']);
const RAW_EXTS = new Set(['cr2', 'nef', 'dng', 'arw']);
const TIFF_EXTS = new Set(['tif', 'tiff']);
const PSD_EXTS = new Set(['psd', 'psb']);
const EXE_EXTS = new Set(['exe', 'dll']);
const MODEL_EXTS = new Set(['glb', 'gltf', 'vrm', 'obj', 'stl', 'ply', 'fbx', 'dae', '3mf']);

/** True if this module knows how to make a preview for the entry. */
export function hasSpecialThumbnail(e: AssetEntry): boolean {
  const x = extOf(e);
  return (
    FONT_EXTS.has(x) ||
    PS_EXTS.has(x) ||
    RAW_EXTS.has(x) ||
    TIFF_EXTS.has(x) ||
    PSD_EXTS.has(x) ||
    EXE_EXTS.has(x) ||
    MODEL_EXTS.has(x) ||
    x === 'pfb' ||
    x === 'db' ||
    x === 'blend'
  );
}

function fileUrl(e: AssetEntry): string {
  if (e.isZipInnerFile && e.filePath && e.zipInnerPath) {
    return `/api/file?path=${encodeURIComponent(e.filePath)}&entry=${encodeURIComponent(e.zipInnerPath)}`;
  }
  return `/api/file?id=${encodeURIComponent(e.id)}`;
}

async function fetchBytes(url: string, range?: [number, number], maxBytes = 60 * 1024 * 1024): Promise<Uint8Array | null> {
  const res = await fetch(url, range ? { headers: { Range: `bytes=${range[0]}-${range[1]}` } } : undefined);
  if (!res.ok && res.status !== 206) return null;
  const len = Number(res.headers.get('Content-Length') || 0);
  if (!range && len > maxBytes) return null;
  return new Uint8Array(await res.arrayBuffer());
}

function drawToJpeg(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number): string | null {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  draw(ctx, w, h);
  return c.toDataURL('image/jpeg', 0.88);
}

function imageToJpeg(src: Blob | string, maxW = THUMB_W): Promise<string | null> {
  return new Promise((resolve) => {
    const url = typeof src === 'string' ? src : URL.createObjectURL(src);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / (img.width || maxW));
      const out = drawToJpeg(
        (ctx, w, h) => {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
        },
        Math.max(1, Math.round(img.width * scale)),
        Math.max(1, Math.round(img.height * scale))
      );
      if (typeof src !== 'string') URL.revokeObjectURL(url);
      resolve(out);
    };
    img.onerror = () => {
      if (typeof src !== 'string') URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

let fontSeq = 0;

async function fontThumbnail(e: AssetEntry): Promise<string | null> {
  const bytes = await fetchBytes(fileUrl(e), undefined, 15 * 1024 * 1024);
  if (!bytes) return null;
  const family = `arc-thumb-${++fontSeq}`;
  const face = new FontFace(family, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  try {
    await face.load();
    document.fonts.add(face);
    const name = (e.title || '').replace(/\.[^.]+$/, '');
    return drawToJpeg(
      (ctx, w, h) => {
        ctx.fillStyle = '#10161d';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#e9edf2';
        ctx.textBaseline = 'alphabetic';
        ctx.font = `150px "${family}"`;
        ctx.textAlign = 'center';
        ctx.fillText('Aa', w / 2, h * 0.58);
        ctx.font = `28px "${family}"`;
        ctx.fillText('Hamburgefonstiv', w / 2, h * 0.76);
        ctx.font = `12px ui-monospace, Menlo, monospace`;
        ctx.fillStyle = 'rgba(233,237,242,.55)';
        ctx.fillText(name.slice(0, 40), w / 2, h - 14);
      },
      THUMB_W,
      Math.round(THUMB_W * 0.75)
    );
  } catch {
    return null;
  } finally {
    try {
      document.fonts.delete(face);
    } catch {}
  }
}

async function psdThumbnail(e: AssetEntry): Promise<string | null> {
  const url = fileUrl(e);
  let want = 512 * 1024;
  for (let i = 0; i < 4; i++) {
    const bytes = await fetchBytes(url, [0, want - 1]);
    if (!bytes) return null;
    const r = extractPsdThumbnail(bytes);
    if (r.status === 'found') {
      return imageToJpeg(new Blob([r.thumb.jpeg.slice().buffer as ArrayBuffer], { type: 'image/jpeg' }), THUMB_W);
    }
    if (r.status === 'none') return null;
    if (bytes.length < want) return null; // reached end of file
    want = Math.min(r.bytesNeeded + 1024, 16 * 1024 * 1024);
  }
  return null;
}

async function rawThumbnail(e: AssetEntry): Promise<string | null> {
  const url = fileUrl(e);
  // Previews usually sit in the first few MB; try a small window before reading the whole file
  for (const range of [[0, 4 * 1024 * 1024 - 1], undefined] as const) {
    const bytes = await fetchBytes(url, range as [number, number] | undefined, 45 * 1024 * 1024);
    if (!bytes) return null;
    const j = findLargestJpeg(bytes);
    if (j) {
      return imageToJpeg(new Blob([bytes.slice(j.offset, j.offset + j.length).buffer as ArrayBuffer], { type: 'image/jpeg' }));
    }
    if (!range) return null;
  }
  return null;
}

async function tiffThumbnail(e: AssetEntry): Promise<string | null> {
  const bytes = await fetchBytes(fileUrl(e), undefined, 40 * 1024 * 1024);
  if (!bytes) return null;
  const UTIF: any = (await import('utif2')).default || (await import('utif2'));
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const ifds = UTIF.decode(buf);
  if (!ifds.length) return null;
  UTIF.decodeImage(buf, ifds[0]);
  const rgba = UTIF.toRGBA8(ifds[0]);
  const c = document.createElement('canvas');
  c.width = ifds[0].width;
  c.height = ifds[0].height;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), c.width, c.height), 0, 0);
  return new Promise((resolve) => c.toBlob((b) => (b ? imageToJpeg(b).then(resolve) : resolve(null)), 'image/png'));
}

async function postscriptThumbnail(e: AssetEntry): Promise<string | null> {
  const bytes = await fetchBytes(fileUrl(e), undefined, 80 * 1024 * 1024);
  if (!bytes) return null;
  const r = await renderEmbeddedPreview(bytes, THUMB_W);
  if (r) return r.dataUrl;

  // No picture inside the file: EPS files (and only EPS) can be drawn by the Ghostscript module
  if (extOf(e) === 'eps' && !e.isZipInnerFile) {
    const gs = await renderWithGhostscript(`id=${encodeURIComponent(e.id)}`, THUMB_W);
    if (gs) return imageToJpeg(gs.dataUrl);
  }
  return null;
}

/** Type 1 font: "Aa" drawn from the font's own outlines. */
async function type1Thumbnail(e: AssetEntry): Promise<string | null> {
  const bytes = await fetchBytes(fileUrl(e), undefined, 8 * 1024 * 1024);
  if (!bytes) return null;
  const font = parsePfb(bytes);
  if (!font) return null;
  const upm = font.info.unitsPerEm;
  const names = ['A', 'a'].map((c) => glyphNameForChar(c, font.encoding));
  const glyphs = names.map((n) => (n ? font.glyph(n) : null)).filter((g): g is NonNullable<typeof g> => Boolean(g));
  if (glyphs.length === 0) return null;
  const label = (font.info.fullName || font.info.fontName || e.title || '').slice(0, 40);

  return drawToJpeg(
    (ctx, w, h) => {
      ctx.fillStyle = '#10161d';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#e9edf2';
      const px = 150;
      const scale = px / upm;
      const totalWidth = glyphs.reduce((s, g) => s + g.width, 0) * scale;
      let x = (w - totalWidth) / 2;
      for (const g of glyphs) {
        ctx.save();
        ctx.translate(x, h * 0.62);
        ctx.scale(scale, -scale);
        ctx.fill(new Path2D(g.path));
        ctx.restore();
        x += g.width * scale;
      }
      ctx.font = '12px ui-monospace, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(233,237,242,.55)';
      ctx.fillText(label, w / 2, h - 14);
    },
    THUMB_W,
    Math.round(THUMB_W * 0.75)
  );
}

/** Windows program or library: its own icon on the card background. */
async function exeThumbnail(e: AssetEntry): Promise<string | null> {
  const bytes = await fetchBytes(fileUrl(e), undefined, 40 * 1024 * 1024);
  if (!bytes) return null;
  const pe = parsePe(bytes);
  if (!pe || !pe.iconIco) return null;
  const url = URL.createObjectURL(new Blob([pe.iconIco.slice().buffer as ArrayBuffer], { type: 'image/x-icon' }));
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    return drawToJpeg(
      (ctx, w, h) => {
        ctx.fillStyle = '#10161d';
        ctx.fillRect(0, 0, w, h);
        const size = 160;
        // light tile so dark icons stay visible on the dark card
        const tile = 200;
        ctx.fillStyle = '#e9edf2';
        ctx.beginPath();
        ctx.roundRect((w - tile) / 2, (h - tile) / 2 - 10, tile, tile, 22);
        ctx.fill();
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, (w - size) / 2, (h - size) / 2 - 10, size, size);
        ctx.font = '12px ui-monospace, Menlo, monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(233,237,242,.55)';
        ctx.fillText((pe.version.FileDescription || e.title || '').slice(0, 44), w / 2, h - 14);
      },
      THUMB_W,
      Math.round(THUMB_W * 0.75)
    );
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Windows thumbnail cache (Thumbs.db): its first picture. */
async function thumbsDbThumbnail(e: AssetEntry): Promise<string | null> {
  if (!/(^|[\\/])thumbs\.db$/i.test(e.filePath || e.title || '')) return null;
  const bytes = await fetchBytes(fileUrl(e), undefined, 8 * 1024 * 1024);
  if (!bytes) return null;
  const XLSX: any = await import('xlsx');
  const { parseThumbsDb } = await import('./binaryInfo');
  const items = parseThumbsDb(XLSX.CFB.read(bytes, { type: 'array' }));
  if (items.length === 0) return null;
  return imageToJpeg(new Blob([items[0].jpeg.slice().buffer as ArrayBuffer], { type: 'image/jpeg' }));
}

/** Blender project: the preview picture stored in the file (plain and gzip files). */
async function blendThumbnail(e: AssetEntry): Promise<string | null> {
  const { blendCompression, readBlendPreview } = await import('./blendPreview');
  let bytes = await fetchBytes(fileUrl(e), [0, 6 * 1024 * 1024 - 1]);
  if (!bytes) return null;
  const kind = blendCompression(bytes);
  if (kind === 'zstd') return null;
  if (kind === 'gzip') {
    const full = await fetchBytes(fileUrl(e), undefined, 200 * 1024 * 1024);
    if (!full) return null;
    const stream = new Blob([full.slice().buffer as ArrayBuffer]).stream().pipeThrough(new DecompressionStream('gzip'));
    bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  }
  const p = readBlendPreview(bytes);
  if (!p) return null;
  return drawToJpeg(
    (ctx, w, h) => {
      const c = document.createElement('canvas');
      c.width = p.width;
      c.height = p.height;
      c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(p.rgba), p.width, p.height), 0, 0);
      ctx.fillStyle = '#10161d';
      ctx.fillRect(0, 0, w, h);
      const s = Math.min(w / p.width, h / p.height);
      ctx.drawImage(c, (w - p.width * s) / 2, (h - p.height * s) / 2, p.width * s, p.height * s);
    },
    THUMB_W,
    Math.round(THUMB_W * 0.75)
  );
}

async function modelThumbnail(e: AssetEntry): Promise<string | null> {
  const { renderModelThumbnail } = await import('./threeThumbnail');
  return renderModelThumbnail(fileUrl(e), extOf(e));
}

export async function specialThumbnail(e: AssetEntry): Promise<string | null> {
  const x = extOf(e);
  try {
    if (x === 'blend') return await blendThumbnail(e);
    if (MODEL_EXTS.has(x)) return await modelThumbnail(e);
    if (x === 'pfb') return await type1Thumbnail(e);
    if (EXE_EXTS.has(x)) return await exeThumbnail(e);
    if (x === 'db') return await thumbsDbThumbnail(e);
    if (FONT_EXTS.has(x)) return await fontThumbnail(e);
    if (PSD_EXTS.has(x)) return await psdThumbnail(e);
    if (RAW_EXTS.has(x)) return await rawThumbnail(e);
    if (TIFF_EXTS.has(x)) return await tiffThumbnail(e);
    if (PS_EXTS.has(x)) return await postscriptThumbnail(e);
  } catch (err) {
    console.warn('Special thumbnail failed for', e.title, err);
  }
  return null;
}
