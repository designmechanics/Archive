/**
 * Reads the small JPEG preview that Photoshop stores in a PSD's image-resource block (resource
 * 1036, or the older BGR variant 1033). It sits near the start of the file, so a thumbnail only
 * needs the first few hundred KB, not the whole (sometimes 100+ MB) document.
 * Works on raw bytes only, so it is testable in Node.
 */

export interface PsdThumbnail {
  jpeg: Uint8Array;
  width: number;
  height: number;
}

export type PsdThumbResult =
  | { status: 'found'; thumb: PsdThumbnail }
  | { status: 'need-more'; bytesNeeded: number }
  | { status: 'none' };

export function psdHeader(b: Uint8Array): { width: number; height: number; large: boolean } | null {
  if (b.length < 26 || b[0] !== 0x38 || b[1] !== 0x42 || b[2] !== 0x50 || b[3] !== 0x53) return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { width: dv.getUint32(18), height: dv.getUint32(14), large: dv.getUint16(4) === 2 };
}

/** `b` is the start of the file (as many bytes as have been fetched). */
export function extractPsdThumbnail(b: Uint8Array): PsdThumbResult {
  if (!psdHeader(b)) return { status: 'none' };
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);

  let pos = 26;
  if (pos + 4 > b.length) return { status: 'need-more', bytesNeeded: pos + 4 };
  pos += 4 + dv.getUint32(pos); // colour mode data
  if (pos + 4 > b.length) return { status: 'need-more', bytesNeeded: pos + 4 };

  const resLen = dv.getUint32(pos);
  pos += 4;
  const resEnd = pos + resLen;

  while (pos + 12 <= resEnd) {
    // "8BIM" signature
    if (pos + 12 > b.length) return { status: 'need-more', bytesNeeded: Math.min(resEnd, pos + 12) };
    if (b[pos] !== 0x38 || b[pos + 1] !== 0x42 || b[pos + 2] !== 0x49 || b[pos + 3] !== 0x4d) break;
    const id = dv.getUint16(pos + 4);
    const nameLen = b[pos + 6];
    let p = pos + 7 + nameLen;
    if ((nameLen + 1) % 2 === 1) p += 1; // pascal string padded to even length
    if (p + 4 > b.length) return { status: 'need-more', bytesNeeded: p + 4 };
    const size = dv.getUint32(p);
    const dataStart = p + 4;
    const dataEnd = dataStart + size;

    if (id === 1036 || id === 1033) {
      if (dataEnd > b.length) return { status: 'need-more', bytesNeeded: dataEnd };
      // 28-byte header: format, width, height, widthbytes, totalsize, compressedsize, bpp, planes
      const format = dv.getUint32(dataStart);
      const width = dv.getUint32(dataStart + 4);
      const height = dv.getUint32(dataStart + 8);
      if (format === 1 && size > 28) {
        return { status: 'found', thumb: { jpeg: b.subarray(dataStart + 28, dataEnd), width, height } };
      }
      return { status: 'none' };
    }

    pos = dataEnd + (size % 2);
  }
  return { status: 'none' };
}
