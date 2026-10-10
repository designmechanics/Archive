/**
 * Blender files carry a small preview image (a "TEST" block near the start). This reads it
 * without needing Blender. Handles plain, gzip and zstd files (Blender 3.0+ with compression on).
 * Raw bytes only, so it is testable in Node.
 */

export interface BlendPreview {
  version: string;
  compressed: 'none' | 'gzip' | 'zstd';
  width: number;
  height: number;
  /** top-down RGBA */
  rgba: Uint8ClampedArray;
}

export interface BlendHeader {
  version: string;
  compressed: 'none' | 'gzip' | 'zstd';
}

export function blendCompression(b: Uint8Array): 'none' | 'gzip' | 'zstd' {
  if (b[0] === 0x1f && b[1] === 0x8b) return 'gzip';
  if (b[0] === 0x28 && b[1] === 0xb5 && b[2] === 0x2f && b[3] === 0xfd) return 'zstd';
  return 'none';
}

/**
 * Decompresses the start of a zstd .blend. Blender writes zstd files as many small independent
 * frames, so the first megabytes of the file decode on their own and hold the preview; a frame cut
 * off at the end of `b` is simply left out.
 */
export async function zstdHead(b: Uint8Array): Promise<Uint8Array> {
  const { Decompress } = await import('fzstd');
  const parts: Uint8Array[] = [];
  const d = new Decompress((chunk: Uint8Array) => parts.push(chunk));
  try {
    d.push(b);
  } catch {
    // the head ends inside a frame: keep what was decoded so far
  }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

const ascii = (b: Uint8Array, s: number, e: number) => String.fromCharCode(...b.subarray(s, e));

/** `b` must already be decompressed. */
export function readBlendPreview(b: Uint8Array): BlendPreview | null {
  if (b.length < 32 || ascii(b, 0, 7) !== 'BLENDER') return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);

  let pos: number;
  let ptrSize: number;
  let little: boolean;
  let version: string;
  let large = false;

  if (b[7] >= 0x30 && b[7] <= 0x39) {
    // Blender 5 header: BLENDER17-01v0500 (header size, "-" = 64-bit pointers, format version, endian, version)
    const headerSize = parseInt(ascii(b, 7, 9), 10);
    ptrSize = 8;
    little = b[headerSize - 5] === 0x76; // 'v'
    version = ascii(b, headerSize - 4, headerSize);
    pos = headerSize;
    large = true;
  } else {
    ptrSize = b[7] === 0x2d ? 8 : 4; // '_' = 4 bytes, '-' = 8 bytes
    little = b[8] === 0x76; // 'v' little, 'V' big
    version = ascii(b, 9, 12);
    pos = 12;
  }

  for (let n = 0; n < 64 && pos + 20 <= b.length; n++) {
    const code = ascii(b, pos, pos + 4);
    let size: number;
    let headerLen: number;
    if (large) {
      // code(4) sdna(4) oldptr(8) len(8) count(8)
      size = Number(dv.getBigUint64(pos + 16, little));
      headerLen = 32;
    } else {
      size = dv.getUint32(pos + 4, little);
      headerLen = 16 + ptrSize;
    }
    const data = pos + headerLen;
    if (code === 'TEST') {
      const w = dv.getInt32(data, little);
      const h = dv.getInt32(data + 4, little);
      if (w > 0 && h > 0 && data + 8 + w * h * 4 <= b.length) {
        const rgba = new Uint8ClampedArray(w * h * 4);
        // Blender stores the picture bottom-up
        for (let y = 0; y < h; y++) {
          const src = data + 8 + (h - 1 - y) * w * 4;
          rgba.set(b.subarray(src, src + w * 4), y * w * 4);
        }
        return { version, compressed: 'none', width: w, height: h, rgba };
      }
      return null;
    }
    if (code === 'ENDB' || code === 'DNA1') return null;
    pos = data + size;
  }
  return null;
}
