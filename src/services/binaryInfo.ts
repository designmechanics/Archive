/**
 * Byte-level inspection for files that have no real viewer: Windows programs and libraries (PE),
 * QuarkXPress documents, unknown binaries, and Windows thumbnail caches (Thumbs.db).
 * Raw bytes only (no DOM), so it can be tested in Node.
 */

// ---------------------------------------------------------------------------------------------
// Sniffing
// ---------------------------------------------------------------------------------------------

export type BinaryKind = 'pe' | 'sqlite' | 'ole' | 'quark' | 'zip' | 'unknown';

export function sniffBinary(b: Uint8Array): BinaryKind {
  if (b.length > 64 && b[0] === 0x4d && b[1] === 0x5a) return 'pe';
  if (b.length > 16 && String.fromCharCode(...b.subarray(0, 15)) === 'SQLite format 3') return 'sqlite';
  if (b.length > 8 && b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) return 'ole';
  if (b.length > 4 && b[0] === 0x50 && b[1] === 0x4b) return 'zip';
  // QuarkXPress: two zero bytes, then "II" (Windows) or "MM" (Mac), then an "XPR" tag
  if (b.length > 12) {
    const order = String.fromCharCode(b[2], b[3]);
    const tag = String.fromCharCode(b[4], b[5], b[6], b[7]);
    if ((order === 'II' || order === 'MM') && tag.startsWith('XP')) return 'quark';
    if ((order === 'II' || order === 'MM') && tag.endsWith('PX')) return 'quark';
  }
  return 'unknown';
}

export function describeQuarkHeader(b: Uint8Array): [string, string][] {
  const rows: [string, string][] = [];
  const order = String.fromCharCode(b[2], b[3]);
  const tag = String.fromCharCode(b[4], b[5], b[6], b[7]);
  rows.push(['Created on', order === 'II' ? 'Windows (Intel byte order)' : 'Mac (Motorola byte order)']);
  rows.push(['Format tag', tag]);
  const known: Record<string, string> = { XPR3: 'QuarkXPress 3 or 4 document', '3RPX': 'QuarkXPress 3 or 4 document', XPRS: 'QuarkXPress 5 or later document' };
  if (known[tag]) rows.push(['Format', known[tag]]);
  return rows;
}

// ---------------------------------------------------------------------------------------------
// Strings, hex, embedded pictures
// ---------------------------------------------------------------------------------------------

/** Printable text runs: ASCII and UTF-16LE, at least `min` characters long. */
export function extractStrings(b: Uint8Array, min = 6, limit = 3000): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (s: string) => {
    const t = s.trim();
    if (t.length >= min && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  };
  let cur = '';
  for (let i = 0; i < b.length && out.length < limit; i++) {
    const c = b[i];
    if ((c >= 0x20 && c < 0x7f) || c === 0x09) cur += String.fromCharCode(c);
    else {
      if (cur.length >= min) push(cur);
      cur = '';
    }
  }
  if (cur.length >= min) push(cur);

  // UTF-16LE: printable char, 0x00, printable char, 0x00...
  cur = '';
  for (let i = 0; i + 1 < b.length && out.length < limit; i += 1) {
    if (b[i + 1] === 0 && b[i] >= 0x20 && b[i] < 0x7f) {
      cur += String.fromCharCode(b[i]);
      i++;
    } else {
      if (cur.length >= min) push(cur);
      cur = '';
    }
  }
  if (cur.length >= min) push(cur);
  return out;
}

export function hexDump(b: Uint8Array, length = 512): string {
  const lines: string[] = [];
  const end = Math.min(b.length, length);
  for (let o = 0; o < end; o += 16) {
    const row = b.subarray(o, Math.min(end, o + 16));
    const hex = Array.from(row)
      .map((x) => x.toString(16).padStart(2, '0'))
      .join(' ');
    const ascii = Array.from(row)
      .map((x) => (x >= 0x20 && x < 0x7f ? String.fromCharCode(x) : '.'))
      .join('');
    lines.push(`${o.toString(16).padStart(8, '0')}  ${hex.padEnd(47, ' ')}  ${ascii}`);
  }
  return lines.join('\n');
}

export interface EmbeddedImage {
  mime: string;
  offset: number;
  bytes: Uint8Array;
}

/** Finds whole JPEG and PNG pictures stored inside a binary (up to `max`). */
export function findEmbeddedImages(b: Uint8Array, max = 12): EmbeddedImage[] {
  const found: EmbeddedImage[] = [];
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i + 12 < b.length && found.length < max; i++) {
    if (b[i] === 0xff && b[i + 1] === 0xd8 && b[i + 2] === 0xff && (b[i + 3] === 0xe0 || b[i + 3] === 0xe1 || b[i + 3] === 0xdb)) {
      // JPEG: scan to the end marker (FFD9), at least 1 KB in
      let end = -1;
      const limit = Math.min(b.length - 1, i + 8_000_000);
      for (let j = i + 1024; j < limit; j++) {
        if (b[j] === 0xff && b[j + 1] === 0xd9) {
          end = j + 2;
          break;
        }
      }
      if (end > 0) {
        found.push({ mime: 'image/jpeg', offset: i, bytes: b.subarray(i, end) });
        i = end - 1;
      }
    } else if (b[i] === png[0] && png.every((v, k) => b[i + k] === v)) {
      // PNG: walk chunks to IEND
      let p = i + 8;
      let ok = false;
      while (p + 12 <= b.length && p < i + 12_000_000) {
        const len = (b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3];
        const type = String.fromCharCode(b[p + 4], b[p + 5], b[p + 6], b[p + 7]);
        p += 12 + len;
        if (type === 'IEND') {
          ok = true;
          break;
        }
        if (len < 0) break;
      }
      if (ok) {
        found.push({ mime: 'image/png', offset: i, bytes: b.subarray(i, p) });
        i = p - 1;
      }
    }
  }
  return found;
}

// ---------------------------------------------------------------------------------------------
// Windows executables (PE)
// ---------------------------------------------------------------------------------------------

export interface PeInfo {
  machine: string;
  bits: 32 | 64;
  isDll: boolean;
  subsystem: string;
  timestamp: string;
  sections: { name: string; virtualSize: number; rawSize: number }[];
  imports: string[];
  version: Record<string, string>;
  /** a ready-to-display .ico file built from the program's icon resources */
  iconIco: Uint8Array | null;
}

const MACHINES: Record<number, string> = {
  0x14c: 'x86 (32-bit)',
  0x8664: 'x64 (64-bit)',
  0x1c0: 'ARM',
  0xaa64: 'ARM64',
  0x200: 'Itanium'
};
const SUBSYSTEMS: Record<number, string> = {
  1: 'Native',
  2: 'Windows GUI',
  3: 'Windows console',
  5: 'OS/2 console',
  7: 'POSIX console',
  9: 'Windows CE',
  10: 'EFI application'
};

export function parsePe(b: Uint8Array): PeInfo | null {
  if (b.length < 0x100 || b[0] !== 0x4d || b[1] !== 0x5a) return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const peOff = dv.getUint32(0x3c, true);
  if (peOff + 24 > b.length || dv.getUint32(peOff, true) !== 0x00004550) return null;

  const machine = dv.getUint16(peOff + 4, true);
  const numSections = dv.getUint16(peOff + 6, true);
  const timestamp = dv.getUint32(peOff + 8, true);
  const optSize = dv.getUint16(peOff + 20, true);
  const characteristics = dv.getUint16(peOff + 22, true);
  const opt = peOff + 24;
  const magic = dv.getUint16(opt, true);
  const is64 = magic === 0x20b;
  const subsystem = dv.getUint16(opt + 68, true);
  const dirBase = opt + (is64 ? 112 : 96);

  const sectionTable = opt + optSize;
  const sections: { name: string; vaddr: number; vsize: number; rawPtr: number; rawSize: number }[] = [];
  for (let i = 0; i < numSections && sectionTable + i * 40 + 40 <= b.length; i++) {
    const o = sectionTable + i * 40;
    let name = '';
    for (let k = 0; k < 8 && b[o + k]; k++) name += String.fromCharCode(b[o + k]);
    sections.push({
      name,
      vsize: dv.getUint32(o + 8, true),
      vaddr: dv.getUint32(o + 12, true),
      rawSize: dv.getUint32(o + 16, true),
      rawPtr: dv.getUint32(o + 20, true)
    });
  }

  const rvaToOff = (rva: number): number => {
    for (const s of sections) {
      if (rva >= s.vaddr && rva < s.vaddr + Math.max(s.vsize, s.rawSize)) return rva - s.vaddr + s.rawPtr;
    }
    return -1;
  };
  const cstr = (off: number, max = 128): string => {
    let s = '';
    for (let i = off; i >= 0 && i < b.length && i < off + max && b[i]; i++) s += String.fromCharCode(b[i]);
    return s;
  };

  // Imports
  const imports: string[] = [];
  const importRva = dv.getUint32(dirBase + 8, true);
  const importOff = importRva ? rvaToOff(importRva) : -1;
  if (importOff > 0) {
    for (let i = 0; i < 200; i++) {
      const o = importOff + i * 20;
      if (o + 20 > b.length) break;
      const nameRva = dv.getUint32(o + 12, true);
      if (!nameRva) break;
      const n = rvaToOff(nameRva);
      if (n > 0) imports.push(cstr(n));
    }
  }

  // Resources: icons and version strings
  const resRva = dv.getUint32(dirBase + 16, true);
  const resBase = resRva ? rvaToOff(resRva) : -1;
  const version: Record<string, string> = {};
  let iconIco: Uint8Array | null = null;

  if (resBase > 0) {
    type Leaf = { type: number; id: number; data: Uint8Array };
    const leaves: Leaf[] = [];

    const readDir = (dirOff: number, level: number, type: number, id: number) => {
      if (level > 2 || resBase + dirOff + 16 > b.length) return;
      const o = resBase + dirOff;
      const named = dv.getUint16(o + 12, true);
      const ids = dv.getUint16(o + 14, true);
      const total = Math.min(named + ids, 64);
      for (let i = 0; i < total; i++) {
        const e = o + 16 + i * 8;
        if (e + 8 > b.length) break;
        const nameOrId = dv.getUint32(e, true);
        const target = dv.getUint32(e + 4, true);
        const entryId = nameOrId & 0x80000000 ? -1 : nameOrId;
        if (target & 0x80000000) {
          readDir(target & 0x7fffffff, level + 1, level === 0 ? entryId : type, level === 1 ? entryId : id);
        } else {
          const de = resBase + target;
          if (de + 16 > b.length) continue;
          const dataRva = dv.getUint32(de, true);
          const size = dv.getUint32(de + 4, true);
          const off = rvaToOff(dataRva);
          if (off > 0 && size > 0 && off + size <= b.length) {
            leaves.push({ type: level === 0 ? entryId : type, id: level === 1 ? entryId : id, data: b.subarray(off, off + size) });
          }
        }
      }
    };
    try {
      readDir(0, 0, -1, -1);
    } catch {
      // resources are optional
    }

    // Icon: pick the largest entry of the first icon group
    const group = leaves.find((l) => l.type === 14);
    if (group && group.data.length >= 6) {
      const gdv = new DataView(group.data.buffer, group.data.byteOffset, group.data.byteLength);
      const count = gdv.getUint16(4, true);
      let best: { id: number; area: number; bits: number; w: number; h: number; colors: number; planes: number } | null = null;
      for (let i = 0; i < count && 6 + i * 14 + 14 <= group.data.length; i++) {
        const o = 6 + i * 14;
        const w = group.data[o] || 256;
        const h = group.data[o + 1] || 256;
        const bits = gdv.getUint16(o + 6, true);
        const id = gdv.getUint16(o + 12, true);
        const area = w * h;
        if (w <= 256 && (!best || area > best.area || (area === best.area && bits > best.bits))) {
          best = { id, area, bits, w, h, colors: group.data[o + 2], planes: gdv.getUint16(o + 4, true) };
        }
      }
      const iconLeaf = best ? leaves.find((l) => l.type === 3 && l.id === best!.id) : undefined;
      if (best && iconLeaf) {
        const ico = new Uint8Array(22 + iconLeaf.data.length);
        const idv = new DataView(ico.buffer);
        idv.setUint16(2, 1, true); // type: icon
        idv.setUint16(4, 1, true); // count
        ico[6] = best.w === 256 ? 0 : best.w;
        ico[7] = best.h === 256 ? 0 : best.h;
        ico[8] = best.colors;
        idv.setUint16(10, best.planes || 1, true);
        idv.setUint16(12, best.bits || 32, true);
        idv.setUint32(14, iconLeaf.data.length, true);
        idv.setUint32(18, 22, true);
        ico.set(iconLeaf.data, 22);
        iconIco = ico;
      }
    }

    // Version info: walk the VS_VERSIONINFO blocks for the string table
    const ver = leaves.find((l) => l.type === 16);
    if (ver) {
      const u16 = (o: number) => (o + 2 <= ver.data.length ? ver.data[o] | (ver.data[o + 1] << 8) : 0);
      const utf16 = (o: number, max = 256): { text: string; next: number } => {
        let s = '';
        let p = o;
        for (let n = 0; n < max && p + 2 <= ver.data.length; n++, p += 2) {
          const c = u16(p);
          if (!c) {
            p += 2;
            break;
          }
          s += String.fromCharCode(c);
        }
        return { text: s, next: p };
      };
      const align4 = (n: number) => (n + 3) & ~3;
      const walk = (start: number, end: number, depth: number) => {
        let p = start;
        while (p + 6 <= end && depth < 4) {
          const len = u16(p);
          const valLen = u16(p + 2);
          const isText = u16(p + 4) === 1;
          if (len < 6) break;
          const key = utf16(p + 6, 64);
          const bodyStart = align4(key.next);
          const blockEnd = Math.min(end, p + len);
          if (isText && depth >= 2 && valLen > 0) {
            const val = utf16(bodyStart, valLen + 1);
            if (key.text && val.text) version[key.text] = val.text;
          } else if (key.text === 'StringFileInfo' || /^[0-9a-fA-F]{8}$/.test(key.text) || key.text === 'VS_VERSION_INFO') {
            const childStart = key.text === 'VS_VERSION_INFO' ? align4(bodyStart + valLen) : bodyStart;
            walk(childStart, blockEnd, depth + 1);
          }
          p = align4(p + len);
        }
      };
      try {
        walk(0, ver.data.length, 0);
      } catch {
        // optional
      }
    }
  }

  return {
    machine: MACHINES[machine] || '0x' + machine.toString(16),
    bits: is64 ? 64 : 32,
    isDll: (characteristics & 0x2000) !== 0,
    subsystem: SUBSYSTEMS[subsystem] || String(subsystem),
    timestamp: timestamp ? new Date(timestamp * 1000).toISOString().slice(0, 10) : '',
    sections: sections.map((s) => ({ name: s.name, virtualSize: s.vsize, rawSize: s.rawSize })),
    imports,
    version,
    iconIco
  };
}

// ---------------------------------------------------------------------------------------------
// Thumbs.db (Windows thumbnail cache, an OLE container of small JPEGs)
// ---------------------------------------------------------------------------------------------

export interface ThumbsDbEntry {
  name: string;
  jpeg: Uint8Array;
}

interface OleLike {
  FullPaths: string[];
  FileIndex: { content?: Uint8Array | number[] }[];
}

const asBytes = (c: Uint8Array | number[] | undefined): Uint8Array | null =>
  !c ? null : c instanceof Uint8Array ? c : Uint8Array.from(c);

/** Reads the catalog (index to file name) and every stream's JPEG. */
export function parseThumbsDb(cfb: OleLike): ThumbsDbEntry[] {
  const names = new Map<string, string>();
  const catalogIdx = cfb.FullPaths.findIndex((p) => /\/Catalog$/i.test(p) || p.toLowerCase().endsWith('catalog'));
  const catalog = catalogIdx >= 0 ? asBytes(cfb.FileIndex[catalogIdx].content) : null;
  if (catalog && catalog.length > 16) {
    const dv = new DataView(catalog.buffer, catalog.byteOffset, catalog.byteLength);
    const headerSize = dv.getUint16(0, true);
    const count = dv.getUint32(4, true);
    let p = headerSize;
    for (let i = 0; i < count && p + 20 < catalog.length; i++) {
      const entryLen = dv.getUint32(p, true);
      if (entryLen < 20) break;
      const index = dv.getUint32(p + 4, true);
      const raw = catalog.subarray(p + 16, p + entryLen);
      const name = new TextDecoder('utf-16le').decode(raw).split(String.fromCharCode(0))[0];
      names.set(String(index), name);
      p += entryLen;
    }
  }

  const out: ThumbsDbEntry[] = [];
  cfb.FullPaths.forEach((path, i) => {
    const leaf = path.replace(/\/+$/, '').split('/').pop() || '';
    if (leaf.toLowerCase() === 'catalog' || path.endsWith('/')) return;
    const data = asBytes(cfb.FileIndex[i].content);
    if (!data || data.length < 40) return;
    // JPEG starts after a small stream header (12 bytes in XP-era files, more in later ones)
    let start = -1;
    for (let k = 0; k < Math.min(64, data.length - 3); k++) {
      if (data[k] === 0xff && data[k + 1] === 0xd8 && data[k + 2] === 0xff) {
        start = k;
        break;
      }
    }
    if (start < 0) return;
    // stream names are the catalog index, sometimes with a size prefix ("256_1")
    const key = leaf.replace(/^\d+_/, '');
    out.push({ name: names.get(key) || names.get(leaf) || leaf, jpeg: data.subarray(start) });
  });
  return out;
}
