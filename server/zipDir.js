import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const SIG_EOCD = 0x06054b50;
const SIG_EOCD64 = 0x06064b50;
const SIG_LOC64 = 0x07064b50;
const SIG_CEN = 0x02014b50;
const SIG_LOCAL = 0x04034b50;
const MAX_CD_BYTES = 256 * 1024 * 1024;

/**
 * Loads the central directory of an open zip (tail of the file), never the whole archive.
 * Handles zip64. Throws if the file is not a readable zip.
 */
async function loadCentralDirectory(fh) {
  const { size } = await fh.stat();
  if (size < 22) throw new Error('too small');

  const tailLen = Math.min(size, 65557);
  const tail = Buffer.alloc(tailLen);
  await fh.read(tail, 0, tailLen, size - tailLen);

  let eocd = -1;
  for (let i = tailLen - 22; i >= 0; i--) {
    if (tail.readUInt32LE(i) === SIG_EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('no end-of-central-directory');

  let entryCount = tail.readUInt16LE(eocd + 10);
  let cdSize = tail.readUInt32LE(eocd + 12);
  let cdOffset = tail.readUInt32LE(eocd + 16);

  if (entryCount === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    const locPos = eocd - 20;
    if (locPos < 0 || tail.readUInt32LE(locPos) !== SIG_LOC64) throw new Error('bad zip64 locator');
    const eocd64Offset = Number(tail.readBigUInt64LE(locPos + 8));
    const rec = Buffer.alloc(56);
    await fh.read(rec, 0, 56, eocd64Offset);
    if (rec.readUInt32LE(0) !== SIG_EOCD64) throw new Error('bad zip64 record');
    entryCount = Number(rec.readBigUInt64LE(32));
    cdSize = Number(rec.readBigUInt64LE(40));
    cdOffset = Number(rec.readBigUInt64LE(48));
  }

  if (cdSize > MAX_CD_BYTES) throw new Error('central directory too large');
  const cd = Buffer.alloc(cdSize);
  await fh.read(cd, 0, cdSize, cdOffset);
  return { cd, cdSize, entryCount };
}

/**
 * Walks central directory records. Calls visit(entry) for each; stop early by returning true.
 * entry = { name, flags, method, compressedSize, uncompressedSize, localOffset }
 */
function walkCentralDirectory(cd, cdSize, visit) {
  let pos = 0;
  while (pos + 46 <= cdSize && cd.readUInt32LE(pos) === SIG_CEN) {
    const flags = cd.readUInt16LE(pos + 8);
    const method = cd.readUInt16LE(pos + 10);
    const nameLen = cd.readUInt16LE(pos + 28);
    const extraLen = cd.readUInt16LE(pos + 30);
    const commentLen = cd.readUInt16LE(pos + 32);
    let compressedSize = cd.readUInt32LE(pos + 20);
    let uncompressedSize = cd.readUInt32LE(pos + 24);
    let localOffset = cd.readUInt32LE(pos + 42);

    const name = cd.toString('utf8', pos + 46, pos + 46 + nameLen);

    if (uncompressedSize === 0xffffffff || compressedSize === 0xffffffff || localOffset === 0xffffffff) {
      // zip64 extended info: values appear in order for each field that was 0xFFFFFFFF
      let ep = pos + 46 + nameLen;
      const eEnd = ep + extraLen;
      while (ep + 4 <= eEnd) {
        const id = cd.readUInt16LE(ep);
        const len = cd.readUInt16LE(ep + 2);
        if (id === 0x0001) {
          let p = ep + 4;
          if (uncompressedSize === 0xffffffff && p + 8 <= ep + 4 + len) {
            uncompressedSize = Number(cd.readBigUInt64LE(p));
            p += 8;
          }
          if (compressedSize === 0xffffffff && p + 8 <= ep + 4 + len) {
            compressedSize = Number(cd.readBigUInt64LE(p));
            p += 8;
          }
          if (localOffset === 0xffffffff && p + 8 <= ep + 4 + len) {
            localOffset = Number(cd.readBigUInt64LE(p));
          }
          break;
        }
        ep += 4 + len;
      }
    }

    pos += 46 + nameLen + extraLen + commentLen;
    if (visit({ name, flags, method, compressedSize, uncompressedSize, localOffset })) return;
  }
}

/**
 * Reads only the central directory of a zip, never the whole archive.
 * Returns { fileCount, exts, files, uncompressedSize }. Throws if the file is not a readable zip.
 * Pass maxInner = Infinity to list every file.
 */
export async function readZipDirectory(filePath, { maxInner = 500, maxExts = 12 } = {}) {
  const fh = await fs.promises.open(filePath, 'r');
  try {
    const { cd, cdSize } = await loadCentralDirectory(fh);

    const files = [];
    const exts = new Set();
    let fileCount = 0;
    let uncompressedSize = 0;
    let encrypted = false;

    walkCentralDirectory(cd, cdSize, (e) => {
      if (e.name.endsWith('/') || e.name.startsWith('__MACOSX/')) return;
      fileCount++;
      uncompressedSize += e.uncompressedSize;
      if (e.flags & 1) encrypted = true;
      const ext = path.extname(e.name).replace('.', '').toLowerCase();
      if (ext && exts.size < maxExts) exts.add(ext);
      if (files.length < maxInner) files.push({ path: e.name, size: e.uncompressedSize, ext });
    });

    return { fileCount, exts: Array.from(exts), files, uncompressedSize, encrypted };
  } finally {
    await fh.close();
  }
}

/**
 * Finds one entry in a zip by its inner path (exact match, then separator-insensitive).
 * Returns { name, flags, method, compressedSize, uncompressedSize, dataStart } or null.
 */
export async function findZipEntry(filePath, innerPath) {
  const fh = await fs.promises.open(filePath, 'r');
  try {
    const { cd, cdSize } = await loadCentralDirectory(fh);
    const wanted = innerPath.replace(/\\/g, '/');
    let hit = null;
    walkCentralDirectory(cd, cdSize, (e) => {
      if (e.name === innerPath || e.name.replace(/\\/g, '/') === wanted) {
        hit = e;
        return true;
      }
      return false;
    });
    if (!hit) return null;

    const lh = Buffer.alloc(30);
    await fh.read(lh, 0, 30, hit.localOffset);
    if (lh.readUInt32LE(0) !== SIG_LOCAL) throw new Error('bad local header');
    const dataStart = hit.localOffset + 30 + lh.readUInt16LE(26) + lh.readUInt16LE(28);
    return { ...hit, dataStart };
  } finally {
    await fh.close();
  }
}

/**
 * Streams the uncompressed bytes of a zip entry found with findZipEntry.
 * Only stored (0) and deflate (8) are handled here; throws for anything else so the caller can
 * fall back to 7-Zip.
 */
export function createZipEntryStream(filePath, entry) {
  if (entry.flags & 1) throw new Error('encrypted');
  if (entry.method === 0) {
    return fs.createReadStream(filePath, {
      start: entry.dataStart,
      end: entry.dataStart + entry.compressedSize - 1
    });
  }
  if (entry.method === 8) {
    if (entry.compressedSize === 0) return zlib.createInflateRaw();
    return fs
      .createReadStream(filePath, { start: entry.dataStart, end: entry.dataStart + entry.compressedSize - 1 })
      .pipe(zlib.createInflateRaw());
  }
  throw new Error(`unsupported zip method ${entry.method}`);
}
