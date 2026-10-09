/**
 * Camera RAW files (CR2, NEF, DNG, ARW) are TIFF containers that carry full-size JPEG previews.
 * This walks the TIFF directories (including SubIFDs) and returns the largest embedded JPEG.
 * Works on raw bytes only, so it is testable in Node.
 */

interface IfdEntry {
  tag: number;
  type: number;
  count: number;
  valueOffset: number; // offset of the value bytes (inline or pointed to)
}

const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 13: 4, 16: 8 };

export interface RawJpeg {
  offset: number;
  length: number;
}

export function isTiffContainer(b: Uint8Array): boolean {
  return b.length > 8 && ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a) || (b[0] === 0x4d && b[1] === 0x4d && b[3] === 0x2a));
}

export function findLargestJpeg(b: Uint8Array): RawJpeg | null {
  if (!isTiffContainer(b)) return null;
  const little = b[0] === 0x49;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const u16 = (o: number) => dv.getUint16(o, little);
  const u32 = (o: number) => dv.getUint32(o, little);

  const candidates: RawJpeg[] = [];
  const seen = new Set<number>();

  const readValues = (e: IfdEntry): number[] => {
    const size = TYPE_SIZE[e.type] || 1;
    const out: number[] = [];
    const n = Math.min(e.count, 16);
    for (let i = 0; i < n; i++) {
      const o = e.valueOffset + i * size;
      if (o + size > b.length) break;
      out.push(size === 2 ? u16(o) : size === 4 ? u32(o) : b[o]);
    }
    return out;
  };

  const walk = (ifdOffset: number, depth: number) => {
    if (depth > 4 || ifdOffset <= 0 || ifdOffset + 2 > b.length || seen.has(ifdOffset)) return;
    seen.add(ifdOffset);
    const count = u16(ifdOffset);
    if (count > 500) return;

    const entries = new Map<number, IfdEntry>();
    for (let i = 0; i < count; i++) {
      const o = ifdOffset + 2 + i * 12;
      if (o + 12 > b.length) return;
      const type = u16(o + 2);
      const cnt = u32(o + 4);
      const size = (TYPE_SIZE[type] || 1) * cnt;
      entries.set(u16(o), { tag: u16(o), type, count: cnt, valueOffset: size <= 4 ? o + 8 : u32(o + 8) });
    }

    // Classic JPEG preview tags
    const jif = entries.get(0x0201);
    const jifLen = entries.get(0x0202);
    if (jif && jifLen) {
      candidates.push({ offset: readValues(jif)[0], length: readValues(jifLen)[0] });
    }
    // Strips holding a JPEG (compression 6 or 7)
    const comp = entries.get(0x0103);
    const strips = entries.get(0x0111);
    const stripLens = entries.get(0x0117);
    if (comp && strips && stripLens) {
      const c = readValues(comp)[0];
      if (c === 6 || c === 7) {
        const offs = readValues(strips);
        const lens = readValues(stripLens);
        if (offs.length === 1 && lens.length === 1) candidates.push({ offset: offs[0], length: lens[0] });
      }
    }

    // SubIFDs hold the big previews in NEF / DNG / ARW
    const sub = entries.get(0x014a);
    if (sub) {
      const size = (TYPE_SIZE[sub.type] || 4) * sub.count;
      for (let i = 0; i < Math.min(sub.count, 8); i++) {
        const o = (size <= 4 ? sub.valueOffset : sub.valueOffset) + i * 4;
        if (o + 4 <= b.length) walk(u32(o), depth + 1);
      }
    }

    const next = ifdOffset + 2 + count * 12;
    if (next + 4 <= b.length) walk(u32(next), depth + 1);
  };

  walk(u32(4), 0);

  // RAW sensor data is usually a lossless JPEG (SOF3) that no browser can show: only take
  // baseline / extended / progressive JPEGs (SOF0, SOF1, SOF2).
  const isDisplayableJpeg = (offset: number): boolean => {
    let p = offset + 2;
    while (p + 4 < b.length && b[p] === 0xff) {
      const marker = b[p + 1];
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) return true;
      if (marker === 0xc3) return false;
      p += 2 + ((b[p + 2] << 8) | b[p + 3]);
    }
    return false;
  };

  let best: RawJpeg | null = null;
  for (const c of candidates) {
    if (!c.offset || !c.length || c.offset + c.length > b.length) continue;
    if (b[c.offset] !== 0xff || b[c.offset + 1] !== 0xd8) continue;
    if (!isDisplayableJpeg(c.offset)) continue;
    if (!best || c.length > best.length) best = c;
  }
  return best;
}
