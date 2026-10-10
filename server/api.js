import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { serveArchiveEntry, listArchive, findSevenZip } from './archiveReader.js';
import { findGhostscript, renderEpsToPng, isEpsPath } from './ghostscript.js';
import { canMakeThumbnail } from './thumbMaker.js';
import { makeThumbnailInProcess, renderPsdPreviewInProcess } from './thumbProcess.js';
import { isSqliteFile, inspectSqlite } from './sqliteInspect.js';

import {
  queryAssets,
  countAssets,
  markThumbsFailed,
  markThumbFailedWithNote,
  getAssetById,
  upsertAsset,
  upsertAssetsBulk,
  updateAssetCategory,
  deleteAsset,
  clearAllAssets,
  getWatchedFolders,
  addWatchedFolder,
  updateWatchedFolder,
  removeWatchedFolder,
  getSetting,
  saveSetting,
  getDatabaseStats,
  optimizeDatabase,
  backupDatabase,
  listBackups,
  getPools,
  addPool,
  updatePool,
  deletePool,
  reorderPools,
  getDatabase,
  BACKUP_DIR,
  DB_PATH
} from './db.js';

import { scanDirectoryOnDisk, scannerState, startZipStage } from './scanner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const THUMBNAILS_DIR = path.resolve(ROOT_DIR, '.thumbnails');
if (!fs.existsSync(THUMBNAILS_DIR)) {
  fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
}

// MIME types lookup
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.otf': 'font/otf',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.avif': 'image/avif',
  '.zip': 'application/zip',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.vrm': 'model/gltf-binary',
  '.vrma': 'model/gltf-binary',
  '.obj': 'text/plain',
  '.stl': 'model/stl',
  '.fbx': 'application/octet-stream',
  '.dae': 'model/vnd.collada+xml',
  '.ply': 'application/octet-stream',
  '.3mf': 'model/3mf',
  '.psd': 'image/vnd.adobe.photoshop',
  '.psb': 'application/octet-stream',
  '.eps': 'application/postscript',
  '.ai': 'application/illustrator',
  '.ttc': 'font/collection',
  '.eot': 'application/vnd.ms-fontobject',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.swf': 'application/x-shockwave-flash',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv',
  '.xml': 'application/xml',
  '.md': 'text/markdown',
  '.mkv': 'video/x-matroska',
  '.m4v': 'video/mp4',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  '.iso': 'application/x-iso9660-image',
  '.rar': 'application/vnd.rar',
  '.7z': 'application/x-7z-compressed',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip'
};

/**
 * Handle streaming an individual file from inside an archive on disk (zip, rar, 7z, tar, tar.gz, iso...)
 */
function handleArchiveEntryStream(req, res, archivePath, innerPath) {
  const resolved = resolveDiskPath(archivePath);
  if (!resolved) {
    res.statusCode = 404;
    return res.end('Archive not found');
  }
  if (!innerPath || innerPath.includes('\0')) {
    res.statusCode = 400;
    return res.end('Bad entry path');
  }
  return serveArchiveEntry(req, res, resolved, innerPath, (p) => {
    return MIME_TYPES[path.extname(p).toLowerCase()] || 'application/octet-stream';
  });
}

/**
 * Makes and saves a thumbnail for one asset id. Resolves to { thumbUrl } or { status, error }.
 * 415 = not a type the server can do, 422 = the image could not be read.
 */
async function makeServerThumbnail(id) {
  const db = getDatabase();
  const row = id ? db.prepare('SELECT file_path FROM assets WHERE id = ?').get(id) : null;
  if (!row || !row.file_path) return { status: 404, error: 'unknown asset' };
  if (!canMakeThumbnail(row.file_path)) return { status: 415, error: 'unsupported type' };
  const source = resolveDiskPath(row.file_path);
  if (!source) return { status: 404, error: 'file missing' };

  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${safeId}.jpg`;
  try {
    await makeThumbnailInProcess(source, path.join(THUMBNAILS_DIR, filename));
  } catch (err) {
    // Not a picture at all (empty, blank, text…): remember why, so the tile can say so and
    // nothing retries it
    if (err.note) markThumbFailedWithNote(id, err.note);
    return { status: 422, error: err.message, note: err.note };
  }
  // ?v= so a remade thumbnail (same file name) is not served from the browser cache
  const thumbUrl = `/api/thumbnail/${filename}?v=${Date.now().toString(36)}`;
  db.prepare('UPDATE assets SET thumb = ? WHERE id = ?').run(thumbUrl, id);
  return { thumbUrl };
}

function sendJson(res, data, statusCode = 200) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      // Guard against huge payload
      if (body.length > 50 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function resolveDiskPath(filePath) {
  if (!filePath) return null;
  if (fs.existsSync(filePath)) return filePath;
  let p = path.resolve(ROOT_DIR, filePath);
  if (fs.existsSync(p)) return p;
  p = path.resolve(ROOT_DIR, 'public', filePath.replace(/^public[\\/]/, ''));
  if (fs.existsSync(p)) return p;
  return null;
}

/**
 * Handle streaming media and direct disk access with HTTP Range support
 */
function handleFileStream(req, res, filePath) {
  const resolved = resolveDiskPath(filePath);
  if (!resolved) {
    res.statusCode = 404;
    return res.end(`File not found: ${filePath}`);
  }

  const stat = fs.statSync(resolved);
  const fileSize = stat.size;
  const ext = path.extname(resolved).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    // An end past the last byte is clamped, as the HTTP spec says (small files asked for a big window)
    const end = parts[1] ? Math.min(parseInt(parts[1], 10), fileSize - 1) : fileSize - 1;

    if (isNaN(start) || start >= fileSize || end < start) {
      res.statusCode = 416;
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      return res.end();
    }

    const chunksize = end - start + 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType
    });
    if (req.method === 'HEAD') {
      return res.end();
    }
    const file = fs.createReadStream(resolved, { start, end });
    file.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes'
    });
    if (req.method === 'HEAD') {
      return res.end();
    }
    fs.createReadStream(resolved).pipe(res);
  }
}

/**
 * Express/Connect-compatible middleware for API routes
 */
export async function handleApiRequest(req, res, next) {
  const parsedUrl = new URL(req.url, 'http://localhost');
  const pathname = parsedUrl.pathname || '';

  const query = Object.fromEntries(parsedUrl.searchParams.entries());


  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (!pathname.startsWith('/api')) {
    if (next) return next();
    return;
  }

  try {
    // 1. Database & System Stats
    if (pathname === '/api/stats' && req.method === 'GET') {
      const stats = getDatabaseStats();
      return sendJson(res, { success: true, stats });
    }

    // 2. Query Assets
    if (pathname === '/api/assets' && req.method === 'GET') {
      const { q, cat, type, limit, offset, sort, order } = query;
      const assets = queryAssets({
        q: q ? String(q) : '',
        cat: cat ? String(cat) : '',
        type: type ? String(type) : '',
        limit: Math.min(limit ? parseInt(String(limit), 10) : 20000, 50000),
        offset: offset ? parseInt(String(offset), 10) : 0,
        sort: sort ? String(sort) : 'date',
        order: order ? String(order) : 'desc'
      });
      const total = q ? null : countAssets({ cat: cat ? String(cat) : '', type: type ? String(type) : '' });
      return sendJson(res, { success: true, count: assets.length, total, assets });
    }

    // 3. Clear All Assets
    if (pathname === '/api/assets' && req.method === 'DELETE') {
      clearAllAssets();
      return sendJson(res, { success: true, message: 'All assets cleared from SQLite database' });
    }

    // 4. Upsert Asset
    if (pathname === '/api/assets' && req.method === 'POST') {
      const body = await parseBody(req);
      if (Array.isArray(body)) {
        const count = upsertAssetsBulk(body);
        return sendJson(res, { success: true, count });
      } else {
        const asset = upsertAsset(body, body.files || []);
        return sendJson(res, { success: true, asset });
      }
    }

    // 5. Get Single Asset by ID
    const assetIdMatch = pathname.match(/^\/api\/assets\/([^/]+)$/);
    if (assetIdMatch) {
      const id = decodeURIComponent(assetIdMatch[1]);

      if (req.method === 'GET') {
        const asset = getAssetById(id);
        if (!asset) return sendJson(res, { error: 'Asset not found' }, 404);
        return sendJson(res, { success: true, asset });
      }

      if (req.method === 'PATCH') {
        const body = await parseBody(req);
        if (body.cat) {
          updateAssetCategory(id, body.cat);
        }
        return sendJson(res, { success: true, id, cat: body.cat });
      }

      if (req.method === 'DELETE') {
        deleteAsset(id);
        return sendJson(res, { success: true, id });
      }
    }

    // 6. Watched Folders
    if (pathname === '/api/folders') {
      if (req.method === 'GET') {
        const folders = getWatchedFolders();
        return sendJson(res, { success: true, folders });
      }
      if (req.method === 'POST') {
        const body = await parseBody(req);
        if (!body.path) return sendJson(res, { error: 'path required' }, 400);
        const folders = addWatchedFolder(body.path, body.count || 0);
        return sendJson(res, { success: true, folders });
      }
    }

    const folderIdMatch = pathname.match(/^\/api\/folders\/([^/]+)$/);
    if (folderIdMatch) {
      const id = decodeURIComponent(folderIdMatch[1]);
      if (req.method === 'DELETE') {
        const folders = removeWatchedFolder(id);
        return sendJson(res, { success: true, folders });
      }
      if (req.method === 'PATCH' || req.method === 'PUT') {
        const body = await parseBody(req);
        const folders = updateWatchedFolder(id, body);
        return sendJson(res, { success: true, folders });
      }
    }

    // 6.5 Asset Pools Management
    if (pathname === '/api/pools/reorder' && (req.method === 'POST' || req.method === 'PUT')) {
      const body = await parseBody(req);
      const ids = Array.isArray(body.ids) ? body.ids : (Array.isArray(body) ? body.map((p) => p.id || p) : []);
      const pools = reorderPools(ids);
      return sendJson(res, { success: true, pools });
    }

    if (pathname === '/api/pools') {
      if (req.method === 'GET') {
        const pools = getPools();
        return sendJson(res, { success: true, pools });
      }
      if (req.method === 'POST') {
        const body = await parseBody(req);
        if (!body.name || !body.name.trim()) {
          return sendJson(res, { error: 'Pool name is required' }, 400);
        }
        try {
          const pool = addPool(body);
          return sendJson(res, { success: true, pool });
        } catch (err) {
          return sendJson(res, { error: err.message }, 400);
        }
      }
    }

    const poolIdMatch = pathname.match(/^\/api\/pools\/([^/]+)$/);
    if (poolIdMatch) {
      const id = decodeURIComponent(poolIdMatch[1]);
      if (req.method === 'PUT' || req.method === 'PATCH') {
        const body = await parseBody(req);
        try {
          const pool = updatePool(id, body);
          if (!pool) return sendJson(res, { error: 'Pool not found' }, 404);
          return sendJson(res, { success: true, pool });
        } catch (err) {
          return sendJson(res, { error: err.message }, 400);
        }
      }
      if (req.method === 'DELETE') {
        const body = await parseBody(req).catch(() => ({}));
        const reassignTo = body.reassignTo || query.reassignTo || null;
        const ok = deletePool(id, reassignTo);
        return sendJson(res, { success: ok, id });
      }
    }

    // 7. Disk Directory Scanner
    if (pathname === '/api/scan') {
      if (req.method === 'POST') {
        const body = await parseBody(req);
        const targetPath = body.folderPath || path.resolve('.');

        if (scannerState.status === 'scanning' || scannerState.status === 'indexing') {
          return sendJson(res, { success: false, alreadyRunning: true, status: scannerState });
        }

        // Run scan asynchronously in background
        scanDirectoryOnDisk(targetPath).catch((err) => {
          console.error('[Scanner] Background scan error:', err);
          scannerState.status = 'error';
          scannerState.message = err.message;
        });

        return sendJson(res, {
          success: true,
          message: `Scanner started for ${targetPath}`,
          status: scannerState
        });
      }
    }

    // Full file list of one archive (the index keeps only the first 500 per archive)
    if (pathname === '/api/archive/list' && req.method === 'GET') {
      let target = query.path ? String(query.path) : null;
      if (!target && query.id) {
        const asset = getAssetById(String(query.id));
        if (asset && asset.filePath) target = asset.filePath;
      }
      const resolved = resolveDiskPath(target);
      if (!resolved) return sendJson(res, { success: false, error: 'Archive not found' }, 404);
      try {
        const listing = await listArchive(resolved, { maxInner: 200000 });
        return sendJson(res, {
          success: true,
          fileCount: listing.fileCount,
          encrypted: Boolean(listing.encrypted),
          truncated: listing.fileCount > listing.files.length,
          files: listing.files
        });
      } catch (err) {
        return sendJson(res, { success: false, error: err.message, sevenZip: Boolean(findSevenZip()) }, 500);
      }
    }

    if (pathname === '/api/archive/info' && req.method === 'GET') {
      return sendJson(res, { success: true, sevenZip: findSevenZip(), ghostscript: findGhostscript() });
    }

    // Read-only look inside an SQLite file (tables, columns, first rows)
    if (pathname === '/api/sqlite/inspect' && req.method === 'GET') {
      let target = query.path ? String(query.path) : null;
      if (!target && query.id) {
        const asset = getAssetById(String(query.id));
        if (asset && asset.filePath) target = asset.filePath;
      }
      const resolved = resolveDiskPath(target);
      if (!resolved) return sendJson(res, { success: false, error: 'File not found' }, 404);
      if (!isSqliteFile(resolved)) return sendJson(res, { success: false, error: 'Not an SQLite database' }, 415);
      try {
        return sendJson(res, { success: true, ...inspectSqlite(resolved) });
      } catch (err) {
        return sendJson(res, { success: false, error: err.message }, 500);
      }
    }

    // Ghostscript rendering: EPS files only, used when the file has no preview picture of its own
    if (pathname === '/api/render/eps' && req.method === 'GET') {
      let target = query.path ? String(query.path) : null;
      if (!target && query.id) {
        const asset = getAssetById(String(query.id));
        if (asset && asset.filePath) target = asset.filePath;
      }
      const resolved = resolveDiskPath(target);
      if (!resolved) {
        res.statusCode = 404;
        return res.end('File not found');
      }
      if (!isEpsPath(resolved)) {
        res.statusCode = 415;
        return res.end('Only EPS files are rendered with Ghostscript');
      }
      if (!findGhostscript()) {
        res.statusCode = 501;
        return res.end('Ghostscript engine is missing (run npm install)');
      }
      try {
        const png = await renderEpsToPng(resolved);
        res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': png.length, 'Cache-Control': 'max-age=3600' });
        return res.end(png);
      } catch (err) {
        res.statusCode = 500;
        return res.end('Render failed: ' + err.message);
      }
    }

    // Large PSD preview for the viewer: the merged image (PhotoCraft's reader), colour managed,
    // longest side `max` (default 2048). Cached in .thumbnails/psd-preview/ by path, date and size.
    // Header X-Psd-Source: 'merged', or 'stored' when only Photoshop's small preview exists.
    if (pathname === '/api/render/psd' && req.method === 'GET') {
      let target = query.path ? String(query.path) : null;
      if (!target && query.id) {
        const asset = getAssetById(String(query.id));
        if (asset && asset.filePath) target = asset.filePath;
      }
      const resolved = resolveDiskPath(target);
      if (!resolved) {
        res.statusCode = 404;
        return res.end('File not found');
      }
      const maxSide = Math.min(8192, Math.max(64, Number(query.max) || 2048));
      try {
        const { mtimeMs, size } = await fs.promises.stat(resolved);
        const key = crypto.createHash('sha1').update(`${resolved}|${mtimeMs}|${size}|${maxSide}`).digest('hex');
        const dir = path.join(THUMBNAILS_DIR, 'psd-preview');
        const file = path.join(dir, `${key}.jpg`);
        const sourceFile = `${file}.src`;
        let source = fs.existsSync(file) && fs.existsSync(sourceFile) ? fs.readFileSync(sourceFile, 'utf8') : null;
        if (!source) {
          await fs.promises.mkdir(dir, { recursive: true });
          source = await renderPsdPreviewInProcess(resolved, file, maxSide);
          await fs.promises.writeFile(sourceFile, source);
        }
        const jpg = await fs.promises.readFile(file);
        res.writeHead(200, {
          'Content-Type': 'image/jpeg',
          'Content-Length': jpg.length,
          'Cache-Control': 'max-age=3600',
          'X-Psd-Source': source,
          'Access-Control-Expose-Headers': 'X-Psd-Source'
        });
        return res.end(jpg);
      } catch (err) {
        res.statusCode = 422;
        return res.end('PSD preview failed: ' + err.message);
      }
    }

    // Stage two: read the contents of any zips still waiting (idempotent, returns live state)
    if (pathname === '/api/zips/process' && req.method === 'POST') {
      return sendJson(res, { success: true, zips: startZipStage() });
    }

    if (pathname === '/api/scan/status' && req.method === 'GET') {
      return sendJson(res, { success: true, status: scannerState });
    }

    // 8. Stream file from disk (by path or by asset ID)
    if (pathname === '/api/file' && (req.method === 'GET' || req.method === 'HEAD')) {
      let targetFilePath = query.path ? String(query.path) : null;
      if (!targetFilePath && query.id) {
        const asset = getAssetById(String(query.id));
        if (asset && asset.filePath) {
          targetFilePath = asset.filePath;
        }
      }
      if (!targetFilePath) {
        return sendJson(res, { error: 'Path or id parameter required' }, 400);
      }
      // A sibling of the model file (textures / .bin referenced by a .gltf), kept inside its folder
      if (query.rel) {
        const base = resolveDiskPath(targetFilePath);
        if (!base) {
          res.statusCode = 404;
          return res.end('File not found');
        }
        const dir = path.dirname(base);
        const sibling = path.resolve(dir, String(query.rel).replace(/\\/g, '/'));
        const inside = path.relative(dir, sibling);
        if (inside.startsWith('..') || path.isAbsolute(inside)) {
          res.statusCode = 403;
          return res.end('Outside the model folder');
        }
        return handleFileStream(req, res, sibling);
      }
      if (query.entry) {
        return handleArchiveEntryStream(req, res, targetFilePath, String(query.entry));
      }
      return handleFileStream(req, res, targetFilePath);
    }

    // 8.5 Save thumbnail to disk folder (.thumbnails) & update SQLite reference
    if (pathname === '/api/thumbnail' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.id || !body.dataUrl) {
        return sendJson(res, { error: 'id and dataUrl required' }, 400);
      }
      const safeId = String(body.id).replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${safeId}.jpg`;
      const targetPath = path.join(THUMBNAILS_DIR, filename);

      const base64Data = body.dataUrl.replace(/^data:image\/\w+;base64,/, '');
      await fs.promises.writeFile(targetPath, Buffer.from(base64Data, 'base64'));

      const thumbUrl = `/api/thumbnail/${filename}`;
      const db = getDatabase();
      db.prepare('UPDATE assets SET thumb = ? WHERE id = ?').run(thumbUrl, body.id);

      return sendJson(res, { success: true, thumbUrl });
    }

    // Make a thumbnail on the server (raster images only). 415 = not a type the server can do,
    // 422 = the image could not be read; the client falls back to browser rendering in both cases.
    if (pathname === '/api/thumb/make' && req.method === 'POST') {
      const body = await parseBody(req);
      const r = await makeServerThumbnail(body.id ? String(body.id) : '');
      if (r.thumbUrl) return sendJson(res, { success: true, thumbUrl: r.thumbUrl });
      return sendJson(res, { success: false, error: r.error, unsupported: r.status === 415 }, r.status);
    }

    // Same, for many images in one request (the preview queue uses this)
    if (pathname === '/api/thumb/make-batch' && req.method === 'POST') {
      const body = await parseBody(req);
      const ids = Array.isArray(body.ids) ? body.ids.slice(0, 64).map(String) : [];
      const results = {};
      const notes = {};
      let next = 0;
      const worker = async () => {
        while (next < ids.length) {
          const id = ids[next++];
          const r = await makeServerThumbnail(id);
          results[id] = r.thumbUrl || null;
          if (r.note) notes[id] = r.note;
        }
      };
      await Promise.all(Array.from({ length: Math.min(8, ids.length) }, worker));
      return sendJson(res, { success: true, results, notes });
    }

    // Remember previews that could not be generated, so they are not retried every launch
    if (pathname === '/api/thumbnail/failed' && req.method === 'POST') {
      const body = await parseBody(req);
      const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
      return sendJson(res, { success: true, count: markThumbsFailed(ids) });
    }

    const thumbMatch = pathname.match(/^\/api\/thumbnail\/([^/]+)$/);
    if (thumbMatch && req.method === 'GET') {
      const filename = decodeURIComponent(thumbMatch[1]);
      const targetPath = path.join(THUMBNAILS_DIR, filename);
      if (!fs.existsSync(targetPath)) {
        res.statusCode = 404;
        return res.end('Thumbnail not found');
      }
      res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable'
      });
      return fs.createReadStream(targetPath).pipe(res);
    }

    // 9. Key/Value Settings
    if (pathname === '/api/settings') {
      if (req.method === 'GET') {
        const key = query.key ? String(query.key) : '';
        const val = getSetting(key);
        return sendJson(res, { success: true, key, value: val });
      }
      if (req.method === 'POST') {
        const body = await parseBody(req);
        if (!body.key) return sendJson(res, { error: 'key required' }, 400);
        saveSetting(body.key, body.value);
        return sendJson(res, { success: true, key: body.key, value: body.value });
      }
    }

    // 10. Database optimization
    if (pathname === '/api/db/optimize' && req.method === 'POST') {
      const stats = optimizeDatabase();
      return sendJson(res, { success: true, message: 'Database optimized and vacuumed', stats });
    }

    // 11. Database Backup & List Backups
    if (pathname === '/api/db/backup' && req.method === 'POST') {
      const backup = await backupDatabase();
      return sendJson(res, { success: true, message: 'Database backup created', backup });
    }

    if (pathname === '/api/db/backups' && req.method === 'GET') {
      const backups = listBackups();
      return sendJson(res, { success: true, backups, backupDir: BACKUP_DIR });
    }

    // Unmatched API route

    return sendJson(res, { error: `Not found: ${req.method} ${pathname}` }, 404);
  } catch (err) {
    console.error('[API Error]', err);
    return sendJson(res, { error: err.message || 'Internal server error' }, 500);
  }
}
