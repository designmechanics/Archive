import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn, spawnSync } from 'child_process';
import { readZipDirectory, findZipEntry, createZipEntryStream } from './zipDir.js';

/**
 * One reader for every archive type.
 *  - zip: native (central directory + seek), no whole-file reads
 *  - everything else (rar, 7z, tar, gz, bz2, xz, iso, cab, dmg, ...): the installed 7-Zip
 *  - tar.gz / tgz / tar.bz2 / tar.xz: two-step pipe (decompress, then read the inner tar)
 */

/** Extensions the app treats as browsable archives (the ones the scanner classes as type "zip"). */
export const BROWSABLE_ARCHIVE_EXTS = new Set([
  'zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'tbz', 'tbz2', 'bz2', 'xz', 'txz', 'iso', 'cab', 'dmg', 'wim', 'zst', 'cpio', 'epub', 'idml', 'key', 'ods', 'fla', 'z'
]);

const MAX_BUFFERED_ENTRY = 512 * 1024 * 1024;
const SEVEN_ZIP_TIMEOUT_MS = 120000;

export function archiveExt(filePath) {
  return path.extname(filePath || '').replace('.', '').toLowerCase();
}

export function isBrowsableArchivePath(filePath) {
  return BROWSABLE_ARCHIVE_EXTS.has(archiveExt(filePath));
}

let sevenZipPath;

/** Finds 7-Zip once: env var, usual install folders, then PATH. Returns null when absent. */
export function findSevenZip() {
  if (sevenZipPath !== undefined) return sevenZipPath;
  const candidates = [
    process.env.SEVENZIP_PATH,
    'C:\\Program Files\\7-Zip\\7z.exe',
    'C:\\Program Files (x86)\\7-Zip\\7z.exe'
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      sevenZipPath = c;
      return sevenZipPath;
    }
  }
  for (const name of ['7z', '7zz', '7za']) {
    try {
      const r = spawnSync(name, ['i'], { stdio: 'ignore', windowsHide: true });
      if (r.status === 0) {
        sevenZipPath = name;
        return sevenZipPath;
      }
    } catch {
      // try next
    }
  }
  sevenZipPath = null;
  return null;
}

/** True when the file is a compressed single stream that normally wraps a tar (x.tar.gz, x.tgz...). */
function isCompressedTar(filePath) {
  const lower = (filePath || '').toLowerCase();
  return /\.(tar\.(gz|bz2|xz|zst|lzma|z)|tgz|tbz2?|txz)$/.test(lower);
}

function runSevenZip(args, { input } = {}) {
  const exe = findSevenZip();
  if (!exe) return Promise.reject(new Error('7-Zip is not installed'));
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    const out = [];
    let total = 0;
    const timer = setTimeout(() => child.kill(), SEVEN_ZIP_TIMEOUT_MS);
    child.stdout.on('data', (d) => {
      total += d.length;
      if (total > MAX_BUFFERED_ENTRY) {
        child.kill();
        return;
      }
      out.push(d);
    });
    let err = '';
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout: Buffer.concat(out), stderr: err });
    });
  });
}

/** Two-step: decompress with 7-Zip into a pipe, read the inner tar from stdin with a second 7-Zip. */
function runPiped(archivePath, secondArgs) {
  const exe = findSevenZip();
  if (!exe) return Promise.reject(new Error('7-Zip is not installed'));
  return new Promise((resolve, reject) => {
    const first = spawn(exe, ['e', '-so', '-y', '--', archivePath], {
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true
    });
    const second = spawn(exe, secondArgs, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    first.stdout.pipe(second.stdin);
    second.stdin.on('error', () => {});
    const out = [];
    let total = 0;
    const timer = setTimeout(() => {
      first.kill();
      second.kill();
    }, SEVEN_ZIP_TIMEOUT_MS);
    second.stdout.on('data', (d) => {
      total += d.length;
      if (total > MAX_BUFFERED_ENTRY) {
        first.kill();
        second.kill();
        return;
      }
      out.push(d);
    });
    let err = '';
    second.stderr.on('data', (d) => (err += d));
    first.on('error', (e) => reject(e));
    second.on('error', (e) => reject(e));
    second.on('close', (code) => {
      clearTimeout(timer);
      first.kill();
      resolve({ code, stdout: Buffer.concat(out), stderr: err });
    });
  });
}

/** Parses `7z l -slt` output into entries. */
function parseSltListing(text) {
  const entries = [];
  const sep = text.indexOf('\n----------');
  if (sep < 0) return { entries, encryptedHeader: /Wrong password|Enter password/i.test(text) };
  const body = text.slice(sep + '\n----------'.length);
  for (const block of body.split(/\r?\n\r?\n/)) {
    const rec = {};
    for (const line of block.split(/\r?\n/)) {
      const i = line.indexOf(' = ');
      if (i > 0) rec[line.slice(0, i)] = line.slice(i + 3);
    }
    if (rec.Path === undefined) continue;
    entries.push(rec);
  }
  return { entries, encryptedHeader: false };
}

function entriesToResult(rawEntries, maxInner, extra = {}) {
  const files = [];
  const exts = new Set();
  let fileCount = 0;
  let uncompressedSize = 0;
  let encrypted = false;
  for (const e of rawEntries) {
    if (e.Folder === '+') continue;
    const name = e.Path.replace(/\\/g, '/');
    if (name.startsWith('__MACOSX/')) continue;
    const size = Number(e.Size) || 0;
    fileCount++;
    uncompressedSize += size;
    if (e.Encrypted === '+') encrypted = true;
    const ext = path.extname(name).replace('.', '').toLowerCase();
    if (ext && exts.size < 12) exts.add(ext);
    if (files.length < maxInner) files.push({ path: name, size, ext });
  }
  return { fileCount, exts: Array.from(exts), files, uncompressedSize, encrypted, ...extra };
}

async function listWithSevenZip(filePath, maxInner) {
  const baseArgs = ['l', '-slt', '-sccUTF-8'];
  let res = await runSevenZip([...baseArgs, '--', filePath]);
  let text = res.stdout.toString('utf8');
  let parsed = parseSltListing(text);

  const saidPassword = /password/i.test(text + res.stderr);
  if (parsed.entries.length === 0) {
    // Header-encrypted archives ask for a password; anything else here is simply not readable
    return {
      fileCount: 1,
      exts: [],
      files: [],
      uncompressedSize: 0,
      encrypted: parsed.encryptedHeader || saidPassword,
      error: 'unreadable'
    };
  }

  // x.tar.gz: the outer layer is a single "x.tar"; list the tar inside it instead.
  const only = parsed.entries.length === 1 ? parsed.entries[0] : null;
  if (only && (isCompressedTar(filePath) || /\.tar$/i.test(only.Path))) {
    res = await runPiped(filePath, [...baseArgs, '-si', '-ttar']);
    text = res.stdout.toString('utf8');
    const inner = parseSltListing(text);
    if (inner.entries.length > 0) parsed = inner;
  }

  return entriesToResult(parsed.entries, maxInner);
}

/**
 * Lists an archive. Returns { fileCount, exts, files, uncompressedSize, encrypted }.
 * Throws if nothing can read it (callers fall back to treating it as one item).
 * maxInner = Infinity lists everything.
 */
export async function listArchive(filePath, { maxInner = 500 } = {}) {
  if (archiveExt(filePath) === 'zip') {
    try {
      return await readZipDirectory(filePath, { maxInner });
    } catch (err) {
      // fall through: 7-Zip is more forgiving about odd zips
      if (!findSevenZip()) throw err;
    }
  }
  return listWithSevenZip(filePath, maxInner);
}

/**
 * Opens one entry for reading. Returns { size, stream(start?, end?), fromBuffer } where stream is
 * a function so Range requests can pick a window.
 */
async function readEntryBuffer(filePath, innerPath) {
  const exe = findSevenZip();
  if (!exe) throw new Error('7-Zip is not installed');
  let res;
  if (isCompressedTar(filePath)) {
    res = await runPiped(filePath, ['e', '-so', '-y', '-spd', '-si', '-ttar', '--', innerPath]);
  } else {
    res = await runSevenZip(['e', '-so', '-y', '-spd', '--', filePath, innerPath]);
    // a plain .gz that wraps a tar (named x.gz): retry through the pipe
    if (res.stdout.length === 0 && /\.gz$/i.test(filePath)) {
      res = await runPiped(filePath, ['e', '-so', '-y', '-spd', '-si', '-ttar', '--', innerPath]);
    }
  }
  if (res.stdout.length === 0 && res.code !== 0) throw new Error('entry not found or unreadable');
  return res.stdout;
}

/**
 * Archives inside archives. An entry path may be a chain, `inner.zip!/deeper.rar!/file.png`: every
 * part but the last is an archive inside the previous one. Each inner archive is unpacked once to a
 * cache file (keyed by the outer file's path, size and date plus the chain), then read with the
 * normal code above. The cache is trimmed to NESTED_CACHE_BYTES, oldest first.
 */
export const NEST_SEP = '!/';
const NESTED_CACHE_BYTES = 4 * 1024 * 1024 * 1024;
const MAX_NESTED_ARCHIVE = 2 * 1024 * 1024 * 1024;

/** Splits `a.zip!/b.rar!/c.png` into { chain: ['a.zip', 'b.rar'], last: 'c.png' }. */
export function splitNestedEntry(entry) {
  const parts = String(entry || '').split(NEST_SEP);
  return { chain: parts.slice(0, -1), last: parts[parts.length - 1] };
}

async function extractEntryToFile(archivePath, innerPath, dest) {
  const tmp = `${dest}.part`;
  if (archiveExt(archivePath) === 'zip') {
    const entry = await findZipEntry(archivePath, innerPath).catch(() => null);
    if (entry && !(entry.flags & 1) && (entry.method === 0 || entry.method === 8)) {
      if (entry.uncompressedSize > MAX_NESTED_ARCHIVE) throw new Error('inner archive too large');
      await new Promise((resolve, reject) => {
        const out = fs.createWriteStream(tmp);
        const src =
          entry.method === 0
            ? fs.createReadStream(archivePath, { start: entry.dataStart, end: entry.dataStart + Math.max(0, entry.uncompressedSize - 1) })
            : createZipEntryStream(archivePath, entry);
        src.on('error', reject);
        out.on('error', reject);
        out.on('finish', resolve);
        if (entry.uncompressedSize === 0) out.end();
        else src.pipe(out);
      });
      await fs.promises.rename(tmp, dest);
      return;
    }
  }
  const buffer = await readEntryBuffer(archivePath, innerPath); // 7-Zip, up to 512 MB
  await fs.promises.writeFile(tmp, buffer);
  await fs.promises.rename(tmp, dest);
}

async function trimNestedCache(dir) {
  const files = [];
  for (const name of await fs.promises.readdir(dir).catch(() => [])) {
    const st = await fs.promises.stat(path.join(dir, name)).catch(() => null);
    if (st && st.isFile()) files.push({ name, size: st.size, used: st.atimeMs || st.mtimeMs });
  }
  let total = files.reduce((n, f) => n + f.size, 0);
  files.sort((a, b) => a.used - b.used);
  for (const f of files) {
    if (total <= NESTED_CACHE_BYTES) break;
    await fs.promises.rm(path.join(dir, f.name), { force: true });
    total -= f.size;
  }
}

const unpacking = new Map(); // cache file → promise, so two requests do not unpack the same archive twice

/** Local file path of the innermost archive of `chain` inside `outerPath`, unpacking as needed. */
export async function resolveNestedArchive(outerPath, chain, cacheDir) {
  let current = outerPath;
  for (let i = 0; i < chain.length; i++) {
    const inner = chain[i];
    if (!isBrowsableArchivePath(inner)) throw new Error(`not an archive: ${inner}`);
    const st = await fs.promises.stat(current);
    const key = crypto
      .createHash('sha1')
      .update(`${outerPath}|${st.size}|${st.mtimeMs}|${chain.slice(0, i + 1).join(NEST_SEP)}`)
      .digest('hex');
    // keep the full extension (x.tar.gz) so the readers recognise the format
    const ext = (/\.(tar\.(gz|bz2|xz|zst))$/i.exec(inner) || [])[0] || path.extname(inner);
    const dest = path.join(cacheDir, key + ext.toLowerCase());
    if (!fs.existsSync(dest)) {
      if (!unpacking.has(dest)) {
        const job = (async () => {
          await fs.promises.mkdir(cacheDir, { recursive: true });
          await extractEntryToFile(current, inner, dest);
          await trimNestedCache(cacheDir);
        })().finally(() => unpacking.delete(dest));
        unpacking.set(dest, job);
      }
      await unpacking.get(dest);
    }
    current = dest;
  }
  return current;
}

/**
 * Serves one file from inside an archive over HTTP, with Range support.
 * contentTypeFor(innerPath) -> mime type.
 */
export async function serveArchiveEntry(req, res, archivePath, innerPath, contentTypeFor) {
  if (!fs.existsSync(archivePath)) {
    res.statusCode = 404;
    return res.end('Archive not found');
  }
  const contentType = contentTypeFor(innerPath);

  try {
    // Native zip path: seek to the entry, never load the whole archive.
    if (archiveExt(archivePath) === 'zip') {
      let entry = null;
      try {
        entry = await findZipEntry(archivePath, innerPath);
      } catch {
        entry = null;
      }
      if (entry && !(entry.flags & 1) && (entry.method === 0 || entry.method === 8)) {
        const range = req.headers.range;

        if (entry.method === 0) {
          // Stored: true range support with no buffering
          const total = entry.uncompressedSize;
          let start = 0;
          let end = total - 1;
          let status = 200;
          if (range) {
            const m = /bytes=(\d*)-(\d*)/.exec(range);
            if (m) {
              start = m[1] ? parseInt(m[1], 10) : 0;
              end = m[2] ? Math.min(parseInt(m[2], 10), total - 1) : total - 1;
              status = 206;
            }
            if (start > end || start >= total) {
              res.statusCode = 416;
              res.setHeader('Content-Range', `bytes */${total}`);
              return res.end();
            }
          }
          const headers = {
            'Accept-Ranges': 'bytes',
            'Content-Length': end - start + 1,
            'Content-Type': contentType
          };
          if (status === 206) headers['Content-Range'] = `bytes ${start}-${end}/${total}`;
          res.writeHead(status, headers);
          if (req.method === 'HEAD' || total === 0) return res.end();
          return fs
            .createReadStream(archivePath, { start: entry.dataStart + start, end: entry.dataStart + end })
            .pipe(res);
        }

        // Deflated: stream straight through when no Range, otherwise inflate into memory first
        if (!range && req.method !== 'HEAD') {
          res.writeHead(200, {
            'Content-Length': entry.uncompressedSize,
            'Content-Type': contentType,
            'Accept-Ranges': 'bytes'
          });
          const stream = createZipEntryStream(archivePath, entry);
          stream.on('error', () => res.destroy());
          return stream.pipe(res);
        }
        if (entry.uncompressedSize <= MAX_BUFFERED_ENTRY) {
          const chunks = [];
          for await (const c of createZipEntryStream(archivePath, entry)) chunks.push(c);
          return sendBuffer(req, res, Buffer.concat(chunks), contentType);
        }
      } else if (!entry) {
        res.statusCode = 404;
        return res.end('File not found in archive');
      }
      // encrypted / exotic method: fall through to 7-Zip
    }

    const buffer = await readEntryBuffer(archivePath, innerPath);
    return sendBuffer(req, res, buffer, contentType);
  } catch (err) {
    if (!res.headersSent) {
      res.statusCode = /not installed/.test(err.message) ? 501 : 500;
      return res.end('Error reading archive entry: ' + err.message);
    }
    res.destroy();
  }
}

function sendBuffer(req, res, buffer, contentType) {
  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m && m[1] ? parseInt(m[1], 10) : 0;
    const end = m && m[2] ? Math.min(parseInt(m[2], 10), buffer.length - 1) : buffer.length - 1;
    if (start > end || start >= buffer.length) {
      res.statusCode = 416;
      res.setHeader('Content-Range', `bytes */${buffer.length}`);
      return res.end();
    }
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${buffer.length}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      'Content-Type': contentType
    });
    return res.end(req.method === 'HEAD' ? undefined : buffer.subarray(start, end + 1));
  }
  res.writeHead(200, {
    'Content-Length': buffer.length,
    'Content-Type': contentType,
    'Accept-Ranges': 'bytes'
  });
  return res.end(req.method === 'HEAD' ? undefined : buffer);
}
