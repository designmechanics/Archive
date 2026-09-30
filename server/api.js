import path from 'path';
import fs from 'fs';

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
  removeWatchedFolder,
  getSetting,
  saveSetting,
  getDatabaseStats,
  optimizeDatabase,
  DB_PATH
} from './db.js';
import { scanDirectoryOnDisk, scannerState } from './scanner.js';

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
  '.zip': 'application/zip',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain'
};

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

/**
 * Handle streaming media and direct disk access with HTTP Range support
 */
function handleFileStream(req, res, filePath) {
  if (!fs.existsSync(filePath)) {
    res.statusCode = 404;
    return res.end('File not found');
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const ext = path.extname(filePath).toLowerCase();
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
    const file = fs.createReadStream(filePath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType
    });
    file.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes'
    });
    fs.createReadStream(filePath).pipe(res);
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
    if (folderIdMatch && req.method === 'DELETE') {
      const id = decodeURIComponent(folderIdMatch[1]);
      const folders = removeWatchedFolder(id);
      return sendJson(res, { success: true, folders });
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

    // 8. Stream file from disk
    if (pathname === '/api/file' && req.method === 'GET') {
      const targetFilePath = query.path ? String(query.path) : null;
      if (!targetFilePath) {
        return sendJson(res, { error: 'Path parameter required' }, 400);
      }
      return handleFileStream(req, res, targetFilePath);
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

    // Unmatched API route
    return sendJson(res, { error: `Not found: ${req.method} ${pathname}` }, 404);
  } catch (err) {
    console.error('[API Error]', err);
    return sendJson(res, { error: err.message || 'Internal server error' }, 500);
  }
}
