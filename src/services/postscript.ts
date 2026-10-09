/**
 * Helpers for EPS / Illustrator files: pull out the preview image they usually carry, and read
 * their header comments. Everything here works on raw bytes (no DOM), so it can be tested in Node.
 */

export type EmbeddedPreview =
  | { kind: 'tiff'; bytes: Uint8Array }
  | { kind: 'jpeg'; bytes: Uint8Array }
  | { kind: 'bitmap'; width: number; height: number; rgba: Uint8ClampedArray };

export interface DscInfo {
  title?: string;
  creator?: string;
  creationDate?: string;
  forWho?: string;
  boundingBox?: [number, number, number, number];
  hiResBoundingBox?: [number, number, number, number];
  languageLevel?: string;
  pages?: string;
  dosHeader: boolean;
  pdfBased: boolean;
}

const latin1 = (bytes: Uint8Array, start = 0, end = bytes.length): string => {
  let s = '';
  const stop = Math.min(end, bytes.length);
  for (let i = start; i < stop; i += 8192) {
    s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, Math.min(i + 8192, stop))));
  }
  return s;
};

function u32(b: Uint8Array, o: number): number {
  return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
}

export function isDosEps(b: Uint8Array): boolean {
  return b.length > 30 && b[0] === 0xc5 && b[1] === 0xd0 && b[2] === 0xd3 && b[3] === 0xc6;
}

export function isPdfBased(b: Uint8Array): boolean {
  const head = latin1(b, 0, 1024);
  return head.indexOf('%PDF-') >= 0;
}

/** The PostScript part of the file (skips the binary DOS-EPS header when there is one). */
function psSection(b: Uint8Array): Uint8Array {
  if (isDosEps(b)) {
    const off = u32(b, 4);
    const len = u32(b, 8);
    if (off > 0 && off < b.length) return b.subarray(off, len > 0 ? Math.min(b.length, off + len) : b.length);
  }
  return b;
}

function decodeEpsiBitmap(text: string): EmbeddedPreview | null {
  const m = /%%BeginPreview:\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/.exec(text);
  if (!m) return null;
  const width = parseInt(m[1], 10);
  const height = parseInt(m[2], 10);
  const depth = parseInt(m[3], 10);
  if (!width || !height || ![1, 2, 4, 8].includes(depth) || width * height > 16_000_000) return null;

  const start = text.indexOf('\n', m.index) + 1;
  const end = text.indexOf('%%EndPreview', start);
  if (start <= 0 || end < 0) return null;

  let hex = '';
  for (const line of text.slice(start, end).split(/\r?\n|\r/)) {
    if (line.startsWith('%')) hex += line.slice(1).replace(/[^0-9a-fA-F]/g, '');
  }
  const rowBytes = Math.ceil((width * depth) / 8);
  if (hex.length < rowBytes * height * 2) return null;

  const rgba = new Uint8ClampedArray(width * height * 4);
  const maxVal = (1 << depth) - 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const bitPos = x * depth;
      const byteIndex = y * rowBytes + (bitPos >> 3);
      const byte = parseInt(hex.substr(byteIndex * 2, 2), 16);
      const shift = 8 - depth - (bitPos & 7);
      const v = ((byte >> shift) & maxVal) / maxVal;
      const g = Math.round(v * 255);
      const o = (y * width + x) * 4;
      rgba[o] = rgba[o + 1] = rgba[o + 2] = g;
      rgba[o + 3] = 255;
    }
  }
  return { kind: 'bitmap', width, height, rgba };
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Illustrator and many EPS exporters keep a JPEG thumbnail inside the XMP packet. */
function xmpThumbnail(text: string): EmbeddedPreview | null {
  const m = /<xmpGImg:image>([\s\S]*?)<\/xmpGImg:image>/.exec(text);
  if (!m) return null;
  const clean = m[1].replace(/&#x[0-9A-Fa-f]+;|&#\d+;|\s+/g, '');
  try {
    const bytes = base64ToBytes(clean);
    if (bytes.length > 100) return { kind: 'jpeg', bytes };
  } catch {
    // ignore bad base64
  }
  return null;
}

/**
 * Searches the whole file for an XMP thumbnail. InDesign (and some other) files put the XMP packet
 * anywhere in the file, not near the start, so this scans every byte.
 */
export function findXmpThumbnailAnywhere(b: Uint8Array): EmbeddedPreview | null {
  const open = '<xmpGImg:image>';
  const close = '</xmpGImg:image>';
  const first = open.charCodeAt(0);
  outer: for (let i = 0; i < b.length - open.length; i++) {
    if (b[i] !== first) continue;
    for (let k = 1; k < open.length; k++) if (b[i + k] !== open.charCodeAt(k)) continue outer;
    const startAt = i + open.length;
    // thumbnails are small; look at most 400 KB ahead
    const chunk = latin1(b, startAt, Math.min(b.length, startAt + 400_000));
    const end = chunk.indexOf(close);
    if (end < 0) return null;
    return xmpThumbnail(open + chunk.slice(0, end) + close);
  }
  return null;
}

/** Finds the best preview image inside an EPS / AI file, or null if it carries none. */
export function findEmbeddedPreview(b: Uint8Array): EmbeddedPreview | null {
  if (isDosEps(b)) {
    const tiffOff = u32(b, 20);
    const tiffLen = u32(b, 24);
    if (tiffOff > 0 && tiffLen > 0 && tiffOff + tiffLen <= b.length) {
      return { kind: 'tiff', bytes: b.subarray(tiffOff, tiffOff + tiffLen) };
    }
  }
  const text = latin1(psSection(b), 0, 4_000_000);
  return decodeEpsiBitmap(text) || xmpThumbnail(text);
}

function box(s: string | undefined): [number, number, number, number] | undefined {
  if (!s) return undefined;
  const n = s.trim().split(/\s+/).map(Number);
  return n.length === 4 && n.every((v) => !isNaN(v)) ? (n as [number, number, number, number]) : undefined;
}

export function parseDsc(b: Uint8Array): DscInfo {
  const text = latin1(psSection(b), 0, 65536);
  const get = (key: string) => {
    const m = new RegExp(`^%%${key}:\\s*(.*)$`, 'm').exec(text);
    return m ? m[1].replace(/\r$/, '').trim() : undefined;
  };
  const unparen = (s?: string) => (s ? s.replace(/^\((.*)\)$/, '$1') : s);
  return {
    title: unparen(get('Title')),
    creator: unparen(get('Creator')),
    creationDate: unparen(get('CreationDate')),
    forWho: unparen(get('For')),
    boundingBox: box(get('BoundingBox')),
    hiResBoundingBox: box(get('HiResBoundingBox')),
    languageLevel: get('LanguageLevel'),
    pages: get('Pages'),
    dosHeader: isDosEps(b),
    pdfBased: isPdfBased(b)
  };
}

/** Printable view of the PostScript source (binary preview data is cut off). */
export function sourceText(b: Uint8Array, limit = 200_000): string {
  const s = latin1(psSection(b), 0, limit);
  return s.replace(/[^\x09\x0a\x0d\x20-\x7e -ÿ]/g, '·');
}
