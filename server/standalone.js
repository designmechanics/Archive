import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleApiRequest } from './api.js';
import { DB_PATH, getDatabaseStats } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '..', 'dist');

const PORT = process.env.PORT || 3001;

const server = http.createServer((req, res) => {
  if (req.url && req.url.startsWith('/api')) {
    return handleApiRequest(req, res);
  }

  // Serve static files from dist in production
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';

  const filePath = path.join(DIST_DIR, reqPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.woff2': 'font/woff2'
    };
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    return fs.createReadStream(filePath).pipe(res);
  }

  // Fallback to index.html for SPA
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return fs.createReadStream(indexPath).pipe(res);
  }

  res.statusCode = 404;
  res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n🚀 [Archive Standalone Server] Listening at http://127.0.0.1:${PORT}`);
  console.log(`💾 [Archive Database] Connected to SQLite: ${DB_PATH}`);
  const stats = getDatabaseStats();
  console.log(`📊 [Archive Stats] Assets: ${stats.assetCount} | DB Size: ${stats.dbSizeFormatted} | SQLite: v${stats.sqliteVersion}\n`);
});
