# Archive Library: Developer & Agent Cheatsheet (SQLite Edition)

Quick-reference cheatsheet for developers and AI agents working on the Archive codebase.

---

## 1. Quick Commands

```bash
# Development (Runs Vite frontend + SQLite WAL backend at http://127.0.0.1:6080)
npm run dev

# Production Build (TypeScript compilation + Rollup packaging)
npm run build

# Standalone Node Server (Serves dist + SQLite API on port 6080)
node server/standalone.js

```

---

## 2. SQLite Database Reference (`D:\Archive\archive.db`)

The archive database is a free, standalone, zero-maintenance local SQLite database designed to hold **20+ years of creative assets** (up to 281 TB in a single file).

### Files on Disk
- `D:\Archive\archive.db`: Master SQLite database file.
- `D:\Archive\archive.db-wal`: Write-Ahead Log enabling non-blocking concurrent reads and writes.
- `D:\Archive\archive.db-shm`: Shared-memory index for WAL readers.

### SQLite Pragma Settings
```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA cache_size = -64000;   -- 64MB memory page cache
PRAGMA temp_store = MEMORY;
PRAGMA mmap_size = 30000000000; -- 30GB memory-mapped I/O
```

### Full-Text Search (FTS5) Engine
All searches use SQLite's built-in FTS5 engine with Unicode61 and Porter stemmers. Searches match across titles, tags, file paths, and individual files nested inside zip archives in under 1 millisecond.

---

## 3. Backend REST & Streaming API (`/api/*`)

| Endpoint | Method | Description |
|---|---|---|
| `/api/stats` | `GET` | Returns SQLite file size, WAL size, total asset count, inner file count, and version |
| `/api/assets` | `GET` | Query assets with params: `q` (FTS search), `cat` (pool), `type`, `limit`, `offset`, `sort`, `order` |
| `/api/assets/:id` | `GET` | Get asset detail including inner file listings from `asset_files` |
| `/api/assets` | `POST` | Insert or update asset(s) in a single SQLite transaction |
| `/api/assets/:id` | `PATCH` | Update asset category or tags |
| `/api/assets/:id` | `DELETE` | Delete single asset |
| `/api/assets` | `DELETE` | Clear all assets from SQLite database |
| `/api/folders` | `GET` | List watched folders from SQLite |
| `/api/folders` | `POST` | Add watched folder path |
| `/api/folders/:id` | `DELETE` | Remove watched folder |
| `/api/scan` | `POST` | Trigger background disk scanner: `{ "folderPath": "D:\\Archive" }` |
| `/api/scan/status` | `GET` | Live crawler progress (percentage, current file, elapsed time) |
| `/api/file` | `GET` | Stream file directly from disk with HTTP 206 Range headers |
| `/api/db/optimize` | `POST` | Run `PRAGMA optimize; VACUUM;` |
| `/api/db/backup` | `POST` | Create point-in-time database snapshot in `backups/archive_YYYY-MM-DD_HH-mm-ss.db` |
| `/api/db/backups` | `GET` | List all historical database snapshots in `backups/` |


---

## 4. Seven View Modes: Mathematical Reference

| View Mode | Dimension / Offset $d = i - \text{focus}$, $ad = |d|$ | Transforms & GSAP Parameters |
|---|---|---|
| **grid** | `cols = density` (2, 3, 4, 5, 6, 8), `gap = 18`<br>`cw = Math.max(120, (W - gap*(cols-1))/cols)`<br>`ch = Math.round(cw * 0.74 + 132)` | $x = c \times (cw + \text{gap})$, $y = r \times (ch + \text{gap})$.<br>Observer: reveals $y: 0, \text{opacity}: 1$; exits $y: 26, rX: -9, \text{opacity}: 0.08$. |
| **list** | Full width dense data table | Columns: Preview, ★, Asset, Format, Pool, Source, Added. |
| **coverflow** | $cw2 = \text{clamp}(W \times 0.22, 200, 300)$<br>$ch2 = cw2 \times 1.3$ | $x = cx + d \times (cw2 \times 0.52)$<br>$z = -ad \times 190$<br>$rY = -\text{clamp}(d \times 30, \pm 46^\circ)$<br>$s = 1 - \min(ad \times 0.06, 0.4)$<br>$y = cy + ad \times 10$<br>Hidden when $ad > 5$. |
| **strip** | $cw2 = \text{clamp}(W \times 0.22, 200, 300)$<br>$ch2 = cw2 \times 1.3$ | $x = cx + d \times (cw2 + 26)$<br>$s = (d === 0) ? 1.06 : 0.93$<br>$y = cy + (d === 0 ? -10 : 8)$<br>Ease: `elastic.out(0.55, 0.72)`. Hidden when $ad > 4$. |
| **radial** | $R = 1150\text{px}$, $a = d \times 0.115$ | $x = cx + R \times \sin(a)$<br>$y = cy + R \times (1 - \cos(a)) \times 0.9 - 40$<br>$rZ = d \times 6.6^\circ$, $z = -ad \times 60$<br>$s = 1 - \min(ad \times 0.045, 0.35)$. Hidden when $ad > 6$. |
| **filmstrip** | Vertical column | $y = cy + d \times (ch2 \times 0.34)$<br>$x = cx + ad \times 14$<br>$rX = -\text{clamp}(d \times 13, \pm 40^\circ)$<br>$z = -ad \times 120$<br>$s = 1 - \min(ad \times 0.05, 0.35)$. Hidden when $ad > 4$. |
| **peel** | Stacked card deck | Past cards ($d < 0$, $k = \min(3, -d)$):<br>$y = cy - 460$, $x = cx - 160 \times k$, $rZ = -16^\circ \times k$, $\text{opacity} = 0$.<br>Future cards ($d \ge 0$):<br>$y = cy + d \times 13$, $x = cx + d \times 5$, $s = 1 - d \times 0.035$, $rZ = d \times 1.4^\circ$, $zi = 300 - d$. |

---

## 5. Automatic Classifier Rules (`server/scanner.js` & `zipService.ts`)

| Asset Format | Detected Pool | Target Type |
|---|---|---|
| `.svg`, `.ai`, `.eps` | `vectors` | `svg` / `ai` |
| `.otf`, `.ttf`, `.woff`, `.woff2` | `type` | `font` |
| `.mp3`, `.wav`, `.flac`, `.aac` | `audio` | `video` / `audio` |
| `.obj`, `.fbx`, `.blend`, `.gltf` | `3d` | `file` |
| `.mp4`, `.mov`, `.webm`, `.prproj` | `video` | `video` / `prproj` |
| `.psd`, `.psb`, `.jpg`, `.png` | `photo` | `psd` / `photo` |
| Logos, brand guides, identity | `brand` | `photo` / `file` |
| Synth, 80s/90s, vintage, retro | `retro` | `misc` |
| Wireframes, design systems, UI | `ui` | `code` / `file` |
| `.zip`, client deliveries, backups | `archive` | `zip` |
| `.js`, `.ts`, `.py`, `.html`, `.css` | `code` | `code` |

---

## 6. How to Back Up the 20-Year Archive

Because SQLite stores the entire archive in a single file on disk:
```bash
# 1. Vacuum / optimize to consolidate WAL log
curl -X POST http://127.0.0.1:6080/api/db/optimize


# 2. Simply copy archive.db to any backup drive or cloud storage
copy D:\Archive\archive.db E:\Backups\archive_2026.db
```
Zero export/import dump scripts or database migration tools needed.
