import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';

import {
  queryAssets,
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

import { scanDirectoryOnDisk, scannerState } from './scanner.js';

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
  '.stl': 'model/stl'
};

/**
 * Handle streaming an individual file from inside a ZIP archive on disk
 */
async function handleZipEntryStream(req, res, zipPath, innerPath) {
  if (!fs.existsSync(zipPath)) {
    res.statusCode = 404;
    return res.end('Archive not found');
  }
  try {
    const data = await fs.promises.readFile(zipPath);
    const zip = await JSZip.loadAsync(data);
    const file = zip.file(innerPath);
    if (!file) {
      res.statusCode = 404;
      return res.end('File not found in archive');
    }
    const ext = path.extname(innerPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const buffer = await file.async('nodebuffer');

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : buffer.length - 1;
      const chunksize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${buffer.length}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType
      });
      return res.end(buffer.subarray(start, end + 1));
    }

    res.writeHead(200, {
      'Content-Length': buffer.length,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes'
    });
    return res.end(buffer);
  } catch (err) {
    res.statusCode = 500;
    return res.end('Error reading archive entry: ' + err.message);
  }
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
  p = path.resolve('D:\\Artistream', filePath);
  if (fs.existsSync(p)) return p;
  p = path.resolve('D:\\Artistream\\public', filePath.replace(/^public[\\/]/, ''));
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
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize) {
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
        limit: limit ? parseInt(String(limit), 10) : 50000,
        offset: offset ? parseInt(String(offset), 10) : 0,
        sort: sort ? String(sort) : 'date',
        order: order ? String(order) : 'desc'
      });
      return sendJson(res, { success: true, count: assets.length, assets });
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
      if (query.entry) {
        return handleZipEntryStream(req, res, targetFilePath, String(query.entry));
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
