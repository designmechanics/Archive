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

    -- Custom pools / categories table
    CREATE TABLE IF NOT EXISTS pools (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      color TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at INTEGER
    );
  `);

  // Seed default pools if none exist
  try {
    const poolCount = db.prepare('SELECT COUNT(*) as c FROM pools').get().c;
    if (poolCount === 0) {
      const defaultPools = [
        { name: 'Effects', color: '#94bce3', description: 'Visual effects, shaders, and display animations' },
        { name: 'Buttons', color: '#60a5fa', description: 'Interactive button controls, micro-interactions' },
        { name: 'Loaders', color: '#38bdf8', description: 'Progress bars, spinners, and skeleton loaders' },
        { name: 'Backgrounds', color: '#a78bfa', description: 'Canvas backgrounds, gradients, and dynamic patterns' },
        { name: 'Transitions', color: '#c084fc', description: 'Page transitions, view morphs, slide states' },
        { name: 'Typography', color: '#f472b6', description: 'Type specimens, kinetic text, and font kits' },
        { name: 'Layouts', color: '#fb7185', description: 'Responsive grids, hero sections, and card systems' },
        { name: 'Scroll', color: '#fb923c', description: 'Scroll triggers, parallax, and sticky viewports' },
        { name: 'Physics', color: '#facc15', description: 'Matter.js, collision, and particle dynamics' },
        { name: 'Shaders', color: '#4ade80', description: 'WebGL fragments, GLSL rays, and lens distortion' },
        { name: 'Routines/utils', color: '#2dd4bf', description: 'Helper functions, mathematical formulas, and hooks' },
        { name: 'Experiments', color: '#e879f9', description: 'Experimental sandbox rigs and creative prototypes' }
      ];
      const insertStmt = db.prepare('INSERT INTO pools (id, name, color, description, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)');
      defaultPools.forEach((p, i) => {
        insertStmt.run(`pool_${i + 1}`, p.name, p.color, p.description, i, Date.now());
      });
    }
  } catch (err) {
    console.warn('[SQLite] Pool seeding warning:', err.message);
  }

  // Schema migrations for folder filtering & enable/disable
  try {
    db.exec(`ALTER TABLE watched_folders ADD COLUMN enabled INTEGER DEFAULT 1`);
  } catch {}
  try {
    db.exec(`ALTER TABLE assets ADD COLUMN folder_id TEXT`);
  } catch {}

  // Auto-associate existing assets with their watched folders and compute real counts
  try {
    const fLogo = db.prepare("SELECT id FROM watched_folders WHERE path = 'DM - logo videos'").get();
    if (fLogo) {
      db.prepare(`UPDATE assets SET folder_id = ?, file_path = coalesce(file_path, 'DM - logo videos/' || title) WHERE id LIKE 'pkg_1790788472%'`).run(fLogo.id);
      const c = db.prepare("SELECT COUNT(*) as c FROM assets WHERE folder_id = ?").get(fLogo.id).c;
      db.prepare("UPDATE watched_folders SET count = ? WHERE id = ?").run(c, fLogo.id);
    }
    const fPersona = db.prepare("SELECT id FROM watched_folders WHERE path = 'DM - Persona videos'").get();
    if (fPersona) {
      db.prepare(`UPDATE assets SET folder_id = ?, file_path = coalesce(file_path, 'DM - Persona videos/' || title) WHERE id LIKE 'pkg_179078869%'`).run(fPersona.id);
      const c = db.prepare("SELECT COUNT(*) as c FROM assets WHERE folder_id = ?").get(fPersona.id).c;
      db.prepare("UPDATE watched_folders SET count = ? WHERE id = ?").run(c, fPersona.id);
    }
    const fDesign = db.prepare("SELECT id FROM watched_folders WHERE path LIKE '%design_handoff%'").get();
    if (fDesign) {
      db.prepare(`UPDATE assets SET folder_id = ? WHERE file_path LIKE '%design_handoff%'`).run(fDesign.id);
      const c = db.prepare("SELECT COUNT(*) as c FROM assets WHERE folder_id = ?").get(fDesign.id).c;
      db.prepare("UPDATE watched_folders SET count = ? WHERE id = ?").run(c, fDesign.id);
    }
  } catch (e) {
    console.warn('[SQLite] Folder auto-association warning:', e.message);
  }

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
    folderId: row.folder_id || null,
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
      thumb, pack_id, file_path, folder_id, search, demo, is_user_uploaded, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?, ?
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
      folder_id = coalesce(excluded.folder_id, assets.folder_id),
      search = excluded.search,
      demo = excluded.demo,
      is_user_uploaded = excluded.is_user_uploaded,
      updated_at = excluded.updated_at
  `);

  const THUMBNAILS_DIR = path.resolve(__dirname, '..', '.thumbnails');
  let finalThumb = asset.thumb || null;
  if (!finalThumb) {
    const safeId = String(asset.id).replace(/[^a-zA-Z0-9_-]/g, '_');
    const thumbFile = path.join(THUMBNAILS_DIR, `${safeId}.jpg`);
    if (fs.existsSync(thumbFile)) {
      finalThumb = `/api/thumbnail/${safeId}.jpg`;
    }
  }

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
      finalThumb,
      asset.packId || null,
      asset.filePath || null,
      asset.folderId || null,
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
      thumb, pack_id, file_path, folder_id, search, demo, is_user_uploaded, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?, ?
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
      folder_id = coalesce(excluded.folder_id, assets.folder_id),
      search = excluded.search,
      demo = excluded.demo,
      is_user_uploaded = excluded.is_user_uploaded,
      updated_at = excluded.updated_at
  `);

  const THUMBNAILS_DIR = path.resolve(__dirname, '..', '.thumbnails');
  const tx = db.transaction((list) => {
    for (const asset of list) {
      let finalThumb = asset.thumb || null;
      if (!finalThumb) {
        const safeId = String(asset.id).replace(/[^a-zA-Z0-9_-]/g, '_');
        const thumbFile = path.join(THUMBNAILS_DIR, `${safeId}.jpg`);
        if (fs.existsSync(thumbFile)) {
          finalThumb = `/api/thumbnail/${safeId}.jpg`;
        }
      }
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
        finalThumb,
        asset.packId || null,
        asset.filePath || null,
        asset.folderId || null,
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
  const rows = db.prepare('SELECT id, path, count, enabled, auto_watch FROM watched_folders ORDER BY last_scanned DESC').all();
  return rows.map((r) => ({
    id: r.id,
    path: r.path,
    count: String(r.count || 0),
    enabled: r.enabled === undefined ? Boolean(r.auto_watch !== 0) : Boolean(r.enabled !== 0)
  }));
}

export function addWatchedFolder(folderPath, count = 0, enabled = 1) {
  const db = getDatabase();
  const id = 'f_' + Date.now();
  db.prepare(`
    INSERT INTO watched_folders (id, path, count, last_scanned, enabled, auto_watch)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET count = excluded.count, last_scanned = excluded.last_scanned
  `).run(id, folderPath, count, Date.now(), enabled ? 1 : 0, enabled ? 1 : 0);
  return getWatchedFolders();
}

export function updateWatchedFolder(id, updates = {}) {
  const db = getDatabase();
  const current = db.prepare('SELECT * FROM watched_folders WHERE id = ?').get(id);
  if (!current) return getWatchedFolders();

  const enabledVal = updates.enabled !== undefined ? (updates.enabled ? 1 : 0) : (current.enabled ?? 1);
  const countVal = updates.count !== undefined ? Number(updates.count) : current.count;

  db.prepare('UPDATE watched_folders SET enabled = ?, auto_watch = ?, count = ? WHERE id = ?')
    .run(enabledVal, enabledVal, countVal, id);
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

export const BACKUP_DIR = path.resolve(__dirname, '..', 'backups');

export async function backupDatabase() {
  const db = getDatabase();

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const mins = pad(now.getMinutes());
  const secs = pad(now.getSeconds());

  const fileName = `archive_${year}-${month}-${day}_${hours}-${mins}-${secs}.db`;
  const destPath = path.join(BACKUP_DIR, fileName);

  try {
    db.pragma('wal_checkpoint(PASSIVE)');
  } catch (err) {
    // Ignore checkpoint failure
  }

  await db.backup(destPath);

  const stat = fs.statSync(destPath);
  return {
    fileName,
    filePath: destPath,
    sizeBytes: stat.size,
    sizeFormatted: formatBytes(stat.size),
    createdAt: stat.mtimeMs,
    dateFormatted: `${year}-${month}-${day} ${hours}:${mins}:${secs}`
  };
}

export function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) {
    return [];
  }

  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const dbFiles = files.filter((f) => f.endsWith('.db'));

    const list = dbFiles.map((f) => {
      const p = path.join(BACKUP_DIR, f);
      const stat = fs.statSync(p);
      return {
        fileName: f,
        filePath: p,
        sizeBytes: stat.size,
        sizeFormatted: formatBytes(stat.size),
        createdAt: stat.mtimeMs,
        dateFormatted: new Date(stat.mtimeMs).toLocaleString()
      };
    });

    list.sort((a, b) => b.createdAt - a.createdAt);
    return list;
  } catch (err) {
    console.error('Failed to list backups:', err);
    return [];
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = 1;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Custom Pools / Classification Management
 */
export function getPools() {
  const db = getDatabase();
  return db.prepare('SELECT * FROM pools ORDER BY sort_order ASC, name ASC').all();
}

export function addPool({ name, description = '', color = '#94bce3', sort_order = 0 }) {
  const db = getDatabase();
  const id = 'pool_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const trimmedName = name.trim();
  
  db.prepare(`
    INSERT INTO pools (id, name, description, color, sort_order, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, trimmedName, description, color, Number(sort_order) || 0, Date.now());

  return db.prepare('SELECT * FROM pools WHERE id = ?').get(id);
}

export function updatePool(id, updates) {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM pools WHERE id = ?').get(id);
  if (!existing) return null;

  const newName = updates.name !== undefined ? updates.name.trim() : existing.name;
  const newDesc = updates.description !== undefined ? updates.description : existing.description;
  const newColor = updates.color !== undefined ? updates.color : existing.color;
  const newSort = updates.sort_order !== undefined ? Number(updates.sort_order) : existing.sort_order;

  // Cascade rename to assets table
  if (newName && newName !== existing.name) {
    db.prepare('UPDATE assets SET cat = ? WHERE cat = ?').run(newName, existing.name);
  }

  db.prepare(`
    UPDATE pools
    SET name = ?, description = ?, color = ?, sort_order = ?
    WHERE id = ?
  `).run(newName, newDesc, newColor, newSort, id);

  return db.prepare('SELECT * FROM pools WHERE id = ?').get(id);
}

export function deletePool(id, reassignTo = null) {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM pools WHERE id = ?').get(id);
  if (!existing) return false;

  const targetCat = reassignTo && reassignTo.trim() ? reassignTo.trim() : 'Uncategorized';
  db.prepare('UPDATE assets SET cat = ? WHERE cat = ?').run(targetCat, existing.name);
  db.prepare('DELETE FROM pools WHERE id = ?').run(id);
  return true;
}

export function reorderPools(orderedIds) {
  const db = getDatabase();
  const stmt = db.prepare('UPDATE pools SET sort_order = ? WHERE id = ?');
  const updateAll = db.transaction((ids) => {
    ids.forEach((id, index) => {
      stmt.run(index, id);
    });
  });
  updateAll(orderedIds);
  return getPools();
}

