import fs from 'fs';
import Database from 'better-sqlite3';

/**
 * Read-only look inside an SQLite file for the database viewer: table names, columns, row counts
 * and the first rows of each table. Nothing is ever written.
 */

const MAGIC = 'SQLite format 3\0';

export function isSqliteFile(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(16);
    fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);
    return buf.toString('latin1') === MAGIC;
  } catch {
    return false;
  }
}

function cell(v) {
  if (v === null || v === undefined) return null;
  if (Buffer.isBuffer(v)) return `<binary ${v.length} bytes>`;
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'string' && v.length > 300) return v.slice(0, 300) + '…';
  return v;
}

export function inspectSqlite(filePath, { maxTables = 40, rowLimit = 50 } = {}) {
  const db = new Database(filePath, { readonly: true, fileMustExist: true });
  try {
    const tables = db
      .prepare("SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY type, name")
      .all()
      .slice(0, maxTables);

    const result = tables.map((t) => {
      const quoted = '"' + t.name.replace(/"/g, '""') + '"';
      let columns = [];
      let rowCount = null;
      let rows = [];
      try {
        columns = db.prepare(`PRAGMA table_info(${quoted})`).all().map((c) => ({ name: c.name, type: c.type }));
        rowCount = db.prepare(`SELECT COUNT(*) AS c FROM ${quoted}`).get().c;
        rows = db
          .prepare(`SELECT * FROM ${quoted} LIMIT ${rowLimit}`)
          .raw(true)
          .all()
          .map((r) => r.map(cell));
      } catch {
        // virtual tables or unreadable pages: show what we have
      }
      return { name: t.name, kind: t.type, columns, rowCount, rows };
    });

    return {
      tables: result,
      pageSize: db.pragma('page_size', { simple: true }),
      userVersion: db.pragma('user_version', { simple: true }),
      encoding: db.pragma('encoding', { simple: true })
    };
  } finally {
    db.close();
  }
}
