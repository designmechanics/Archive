import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Standalone SQLite file in the root archive workspace
export const DB_PATH = path.resolve(__dirname, '..', 'archive.db');

let dbInstance = null;

export function getDatabase() {
  if (dbInstance) return dbInstance;

  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  dbInstance = new Database(DB_PATH, {
    // verbose: process.env.NODE_ENV === 'development' ? console.log : undefined
  });

  // Performance Pragmas for high-throughput 20-year massive archives
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('synchronous = NORMAL');
  dbInstance.pragma('foreign_keys = ON');
  dbInstance.pragma('cache_size = -64000'); // 64MB cache
  dbInstance.pragma('temp_store = MEMORY');
  dbInstance.pragma('mmap_size = 30000000000'); // Up to 30GB memory-mapped I/O

  initSchema(dbInstance);

  return dbInstance;
}

function initSchema(db) {
  // Main assets table
  db.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      cat TEXT NOT NULL,
      type TEXT NOT NULL,
      author TEXT,
      date TEXT,
      deps TEXT,
      size TEXT,
      file_count INTEGER DEFAULT 1,
      exts TEXT, -- JSON array of extensions
      thumb TEXT, -- Base64 thumbnail or SVG preview
      pack_id TEXT,
      file_path TEXT, -- Absolute disk path to file or zip
      search TEXT,
      demo TEXT,
      is_user_uploaded INTEGER DEFAULT 1,
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_assets_cat ON assets(cat);
    CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);
    CREATE INDEX IF NOT EXISTS idx_assets_date ON assets(date);
    CREATE INDEX IF NOT EXISTS idx_assets_file_path ON assets(file_path);

    -- Inner files table for deep archive inspection
    CREATE TABLE IF NOT EXISTS asset_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id TEXT NOT NULL,
      path TEXT NOT NULL,
      size INTEGER DEFAULT 0,
      ext TEXT,
      FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_asset_files_asset_id ON asset_files(asset_id);
    CREATE INDEX IF NOT EXISTS idx_asset_files_ext ON asset_files(ext);

    -- Watched folders table
    CREATE TABLE IF NOT EXISTS watched_folders (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL UNIQUE,
      count INTEGER DEFAULT 0,
      last_scanned INTEGER,
      auto_watch INTEGER DEFAULT 1
    );

    -- Application key/value settings table
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    -- Cached zip packages metadata
    CREATE TABLE IF NOT EXISTS packs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      size INTEGER DEFAULT 0,
      file_count INTEGER DEFAULT 0,
      list_json TEXT,
      created_at INTEGER
    );
  `);

  // Initialize SQLite FTS5 Full-Text Search virtual table
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS assets_fts USING fts5(
        id UNINDEXED,
        title,
        cat,
        type,
        author,
        deps,
        search,
        file_path,
        tokenize = 'porter unicode61'
      );

      -- FTS5 Triggers to automatically synchronize the full-text search index
      CREATE TRIGGER IF NOT EXISTS assets_ai AFTER INSERT ON assets BEGIN
        INSERT INTO assets_fts(id, title, cat, type, author, deps, search, file_path)
        VALUES (new.id, new.title, new.cat, new.type, new.author, new.deps, new.search, new.file_path);
      END;

      CREATE TRIGGER IF NOT EXISTS assets_ad AFTER DELETE ON assets BEGIN
        DELETE FROM assets_fts WHERE id = old.id;
      END;

      CREATE TRIGGER IF NOT EXISTS assets_au AFTER UPDATE ON assets BEGIN
        DELETE FROM assets_fts WHERE id = old.id;
        INSERT INTO assets_fts(id, title, cat, type, author, deps, search, file_path)
        VALUES (new.id, new.title, new.cat, new.type, new.author, new.deps, new.search, new.file_path);
      END;
    `);
  } catch (err) {
    console.warn('[SQLite] FTS5 initialization warning:', err.message);
  }
}

// Format row to AssetEntry object
function formatAssetRow(row) {
  if (!row) return null;
  let exts = [];
  try {
    exts = row.exts ? JSON.parse(row.exts) : [];
  } catch {
    exts = [];
  }

  return {
    id: row.id,
    title: row.title,
    cat: row.cat,
    type: row.type,
    author: row.author || '',
    date: row.date || '',
    deps: row.deps || '',
    size: row.size || '0 B',
    fileCount: Number(row.file_count) || 1,
    exts,
    thumb: row.thumb || null,
    packId: row.pack_id || null,
    filePath: row.file_path || null,
    search: row.search || '',
    demo: row.demo || '',
    isUserUploaded: Boolean(row.is_user_uploaded)
  };
}

/**
 * Query assets with optional FTS search, category filter, type filter, and pagination
 */
export function queryAssets({ q = '', cat = '', type = '', limit = 10000, offset = 0, sort = 'date', order = 'desc' } = {}) {
  const db = getDatabase();

  let sql = 'SELECT * FROM assets';
  const whereClauses = [];
  const params = [];

  // FTS5 Full-Text Search
  if (q && q.trim()) {
    const cleanQ = q.trim().replace(/['"]/g, '');
    const ftsQuery = cleanQ
      .split(/\s+/)
      .filter(Boolean)
      .map((term) => `"${term}"*`)
      .join(' ');

    if (ftsQuery) {
      whereClauses.push(`id IN (SELECT id FROM assets_fts WHERE assets_fts MATCH ?)`);
      params.push(ftsQuery);
    }
  }

  if (cat && cat.trim()) {
    whereClauses.push('cat = ?');
    params.push(cat.trim());
  }

  if (type && type.trim()) {
    whereClauses.push('type = ?');
    params.push(type.trim());
  }

  if (whereClauses.length > 0) {
    sql += ' WHERE ' + whereClauses.join(' AND ');
  }

  const allowedSorts = ['date', 'title', 'cat', 'type', 'created_at'];
  const safeSort = allowedSorts.includes(sort) ? sort : 'date';
  const safeOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  sql += ` ORDER BY ${safeSort} ${safeOrder} LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  try {
    const rows = db.prepare(sql).all(...params);
    return rows.map(formatAssetRow);
  } catch (err) {
    // If FTS fails on strange characters, fall back to LIKE
    if (q && q.trim()) {
      return queryAssetsFallback({ q, cat, type, limit, offset, sort, order });
    }
    throw err;
  }
}

function queryAssetsFallback({ q = '', cat = '', type = '', limit = 10000, offset = 0, sort = 'date', order = 'desc' }) {
  const db = getDatabase();
  let sql = 'SELECT * FROM assets';
  const whereClauses = [];
  const params = [];

  if (q && q.trim()) {
    whereClauses.push('(title LIKE ? OR search LIKE ? OR author LIKE ? OR cat LIKE ?)');
    const lk = `%${q.trim()}%`;
    params.push(lk, lk, lk, lk);
  }

  if (cat && cat.trim()) {
    whereClauses.push('cat = ?');
    params.push(cat.trim());
  }

  if (type && type.trim()) {
    whereClauses.push('type = ?');
    params.push(type.trim());
  }

  if (whereClauses.length > 0) {
    sql += ' WHERE ' + whereClauses.join(' AND ');
  }

  const allowedSorts = ['date', 'title', 'cat', 'type', 'created_at'];
  const safeSort = allowedSorts.includes(sort) ? sort : 'date';
  const safeOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  sql += ` ORDER BY ${safeSort} ${safeOrder} LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const rows = db.prepare(sql).all(...params);
  return rows.map(formatAssetRow);
}

export function getAssetById(id) {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM assets WHERE id = ?').get(id);
  if (!row) return null;

  const asset = formatAssetRow(row);
  const files = db.prepare('SELECT path, size, ext FROM asset_files WHERE asset_id = ?').all(id);
  asset.files = files;
  return asset;
}

export function upsertAsset(asset, innerFiles = []) {
  const db = getDatabase();
  const now = Date.now();

  const stmt = db.prepare(`
    INSERT INTO assets (
      id, title, cat, type, author, date, deps, size, file_count, exts,
      thumb, pack_id, file_path, search, demo, is_user_uploaded, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      cat = excluded.cat,
      type = excluded.type,
      author = excluded.author,
      date = excluded.date,
      deps = excluded.deps,
      size = excluded.size,
      file_count = excluded.file_count,
      exts = excluded.exts,
      thumb = coalesce(excluded.thumb, assets.thumb),
      pack_id = excluded.pack_id,
      file_path = excluded.file_path,
      search = excluded.search,
      demo = excluded.demo,
      is_user_uploaded = excluded.is_user_uploaded,
      updated_at = excluded.updated_at
  `);

  const tx = db.transaction(() => {
    stmt.run(
      asset.id,
      asset.title || 'Untitled Asset',
      asset.cat || 'misc',
      asset.type || 'file',
      asset.author || '',
      asset.date || new Date().toISOString().slice(0, 10),
      asset.deps || '',
      asset.size || '0 B',
      asset.fileCount || 1,
      JSON.stringify(asset.exts || []),
      asset.thumb || null,
      asset.packId || null,
      asset.filePath || null,
      asset.search || '',
      asset.demo || '',
      asset.isUserUploaded === false ? 0 : 1,
      now,
      now
    );

    if (innerFiles && innerFiles.length > 0) {
      db.prepare('DELETE FROM asset_files WHERE asset_id = ?').run(asset.id);
      const insertFile = db.prepare('INSERT INTO asset_files (asset_id, path, size, ext) VALUES (?, ?, ?, ?)');
      for (const f of innerFiles) {
        insertFile.run(asset.id, f.path, f.size || 0, f.ext || path.extname(f.path).replace('.', '').toLowerCase());
      }
    }
  });

  tx();
  return getAssetById(asset.id);
}

export function upsertAssetsBulk(assets) {
  const db = getDatabase();
  const now = Date.now();

  const stmt = db.prepare(`
    INSERT INTO assets (
      id, title, cat, type, author, date, deps, size, file_count, exts,
      thumb, pack_id, file_path, search, demo, is_user_uploaded, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      cat = excluded.cat,
      type = excluded.type,
      author = excluded.author,
      date = excluded.date,
      deps = excluded.deps,
      size = excluded.size,
      file_count = excluded.file_count,
      exts = excluded.exts,
      thumb = coalesce(excluded.thumb, assets.thumb),
      pack_id = excluded.pack_id,
      file_path = excluded.file_path,
      search = excluded.search,
      demo = excluded.demo,
      is_user_uploaded = excluded.is_user_uploaded,
      updated_at = excluded.updated_at
  `);

  const tx = db.transaction((list) => {
    for (const asset of list) {
      stmt.run(
        asset.id,
        asset.title || 'Untitled Asset',
        asset.cat || 'misc',
        asset.type || 'file',
        asset.author || '',
        asset.date || new Date().toISOString().slice(0, 10),
        asset.deps || '',
        asset.size || '0 B',
        asset.fileCount || 1,
        JSON.stringify(asset.exts || []),
        asset.thumb || null,
        asset.packId || null,
        asset.filePath || null,
        asset.search || '',
        asset.demo || '',
        asset.isUserUploaded === false ? 0 : 1,
        now,
        now
      );
    }
  });

  tx(assets);
  return assets.length;
}

export function updateAssetCategory(id, newCat) {
  const db = getDatabase();
  db.prepare('UPDATE assets SET cat = ?, updated_at = ? WHERE id = ?').run(newCat, Date.now(), id);
}

export function deleteAsset(id) {
  const db = getDatabase();
  db.prepare('DELETE FROM assets WHERE id = ?').run(id);
}

export function clearAllAssets() {
  const db = getDatabase();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM assets').run();
    db.prepare('DELETE FROM asset_files').run();
    db.prepare('DELETE FROM packs').run();
  });
  tx();
}

export function getWatchedFolders() {
  const db = getDatabase();
  const rows = db.prepare('SELECT id, path, count FROM watched_folders ORDER BY last_scanned DESC').all();
  return rows.map((r) => ({
    id: r.id,
    path: r.path,
    count: String(r.count || 0)
  }));
}

export function addWatchedFolder(folderPath, count = 0) {
  const db = getDatabase();
  const id = 'f_' + Date.now();
  db.prepare(`
    INSERT INTO watched_folders (id, path, count, last_scanned)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET count = excluded.count, last_scanned = excluded.last_scanned
  `).run(id, folderPath, count, Date.now());
  return getWatchedFolders();
}

export function removeWatchedFolder(id) {
  const db = getDatabase();
  db.prepare('DELETE FROM watched_folders WHERE id = ?').run(id);
  return getWatchedFolders();
}

export function getSetting(key, defaultValue = null) {
  const db = getDatabase();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!row) return defaultValue;
  try {
    return JSON.parse(row.value);
  } catch {
    return row.value;
  }
}

export function saveSetting(key, value) {
  const db = getDatabase();
  const valStr = typeof value === 'string' ? value : JSON.stringify(value);
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, valStr);
}

export function getDatabaseStats() {
  const db = getDatabase();
  const assetCount = db.prepare('SELECT COUNT(*) as count FROM assets').get().count;
  const innerFileCount = db.prepare('SELECT COUNT(*) as count FROM asset_files').get().count;
  const folderCount = db.prepare('SELECT COUNT(*) as count FROM watched_folders').get().count;

  let dbSizeBytes = 0;
  let walSizeBytes = 0;
  try {
    if (fs.existsSync(DB_PATH)) {
      dbSizeBytes = fs.statSync(DB_PATH).size;
    }
    const walPath = `${DB_PATH}-wal`;
    if (fs.existsSync(walPath)) {
      walSizeBytes = fs.statSync(walPath).size;
    }
  } catch (e) {
    // Ignore stat error
  }

  // Categories breakdown
  const cats = db.prepare('SELECT cat, COUNT(*) as count FROM assets GROUP BY cat').all();
  // Kinds breakdown
  const types = db.prepare('SELECT type, COUNT(*) as count FROM assets GROUP BY type').all();

  return {
    dbPath: DB_PATH,
    dbSizeBytes,
    walSizeBytes,
    totalSizeBytes: dbSizeBytes + walSizeBytes,
    dbSizeFormatted: formatBytes(dbSizeBytes + walSizeBytes),
    assetCount,
    innerFileCount,
    folderCount,
    categories: Object.fromEntries(cats.map((c) => [c.cat, c.count])),
    types: Object.fromEntries(types.map((t) => [t.type, t.count])),
    sqliteVersion: db.prepare('SELECT sqlite_version() as v').get().v,
    walMode: true
  };
}

export function optimizeDatabase() {
  const db = getDatabase();
  db.pragma('optimize');
  db.exec('VACUUM');
  return getDatabaseStats();
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = 1;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
