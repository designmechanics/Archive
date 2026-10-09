# Architecture & Codebase Map: Archive Library (SQLite WAL Edition)

```mermaid
graph TD
    User([User / Browser]) -->|Interactions, Drag & Drop| App[App.tsx]
    App -->|Renders Chrome| Rail[Rail.tsx]
    App -->|Renders Controls| Header[Header.tsx]
    App -->|Renders View Bar| Toolbar[Toolbar.tsx]
    App -->|Renders 3D Stage| Stage[Stage.tsx]
    Stage -->|When view=list| ListView[ListView.tsx]
    App -->|Slides in on focus/click| SidePanel[SidePanel.tsx]
    App -->|Selection Active| SelectionBar[SelectionBar.tsx]
    App -->|Ingest Trigger| IngestModal[IngestModal.tsx]
    App -->|Window Dragover| DropOverlay[DropOverlay.tsx]

    subgraph Frontend Services
        UnifiedDB[src/services/db.ts]
        ApiClient[src/services/api.ts]
        ClientIndexer[src/services/indexingEngine.ts]
        ZipSvc[src/services/zipService.ts]
        IndexedDBFallback[(IndexedDB Fallback)]
    end

    subgraph Backend SQLite Engine (Node.js)
        VitePlugin[server/vitePlugin.js]
        ApiRouter[server/api.js]
        DiskScanner[server/scanner.js]
        SqliteDB[server/db.js]
        ArchiveFile[("archive.db (WAL Mode)")]
        FTSIndex[("FTS5 Full-Text Index")]
    end

    App <--> UnifiedDB
    UnifiedDB <--> ApiClient
    UnifiedDB -.->|Fallback if offline| IndexedDBFallback
    ApiClient <-->|HTTP /api/*| ApiRouter
    VitePlugin --> ApiRouter
    ApiRouter <--> SqliteDB
    ApiRouter <--> DiskScanner
    DiskScanner -->|Batch Inserts| SqliteDB
    SqliteDB <--> ArchiveFile
    ArchiveFile <--> FTSIndex
```

---

## 1. Directory & File Inventory

```
d:/Archive/
├── archive.db                   # Standalone SQLite database file (WAL mode, FTS5 full-text index)
├── archive.db-wal               # SQLite Write-Ahead Log (concurrent non-blocking reads & writes)
├── archive.db-shm               # SQLite Shared Memory index for WAL mode
├── index.html                   # HTML entry with Dark theme default tokens & Google Fonts
├── vite.config.ts               # Vite configuration (port 3000, React plugin, SQLite backend plugin)
├── tsconfig.json                # TypeScript compiler configuration (ES2020, strict)
├── package.json                 # Dependency manifest (better-sqlite3, jszip, gsap, lucide-react)
├── PLAN.md                      # Audit of mock-to-real migration & database integration checklist
├── CODEBASE_MAP.md              # Deep structural architecture map (this document)
├── CHEATSHEET.md                # Quick-reference cheatsheet for devs & agents
├── README.md                    # Project overview & running instructions
├── server/                      # Local Node.js / SQLite backend engine
│   ├── db.js                    # better-sqlite3 manager: WAL mode, FTS5 index, schema, batch inserts
│   ├── scanner.js               # Recursive filesystem crawler, zip central directory reader, auto-pools
│   ├── api.js                   # REST & streaming API handler (/api/assets, /api/scan, /api/file, /api/stats)
│   ├── vitePlugin.js            # Vite dev middleware mounting backend at /api
│   └── standalone.js            # Standalone Node HTTP server for production
├── src/
│   ├── main.tsx                 # Root entry point; mounts React root & boots virtual zip packs
│   ├── App.tsx                  # Master controller & state coordinator
│   ├── types/
│   │   └── index.ts             # Domain models (AssetEntry, ZipPack, ViewMode, ThemeMode, Density)
│   ├── data/
│   │   ├── seedData.ts          # MIME tables, extensions, pool taxonomy
│   │   ├── richDemos.ts         # Authentic interactive HTML/CSS/JS demos for code experiments
│   │   └── realZipPacks.ts      # Virtual ZipPacks with genuine clickable sub-files & source code
│   ├── services/
│   │   ├── api.ts               # Typed client connecting UI to the SQLite /api endpoints
│   │   ├── db.ts                # Unified storage service prioritizing SQLite archive.db
│   │   ├── indexingEngine.ts    # Real event-driven indexing queue & File System Access API crawler
│   │   └── zipService.ts        # Byte-range zip reader, sandbox inliner & media generator
│   └── components/
│       ├── Rail.tsx             # 252px left rail (wordmark, live indexer card, 12 pools, SQLite WAL card)
│       ├── Header.tsx           # Search input, result count, 3-way theme switch, shuffle, ingest CTA
│       ├── Toolbar.tsx          # 7-way view mode switch, grid density control, carousel stepper
│       ├── Stage.tsx            # GSAP 3D perspective stage, layout math & pointer gesture bindings
│       ├── ListView.tsx         # Dense tabular representation for 'list' view mode
│       ├── SidePanel.tsx        # 470px drawer, sandbox iframe, font specimen, inner file tree, export
│       ├── IngestModal.tsx      # Ingest dialog: native directory crawl, fast Node crawler, zip picker
│       ├── SettingsModal.tsx    # Tabbed control center: one-click DB backup, snapshot list, theme & folders
│       └── DropOverlay.tsx      # Full-window drag-and-drop backdrop overlay

```

---

## 2. Core Subsystems

### A. SQLite WAL Database Engine (`server/db.js` & `archive.db`)
The database is built on **SQLite via `better-sqlite3`** operating in **WAL (Write-Ahead Logging)** mode:
- **Location**: `archive.db` in the project folder (single portable file on disk, never committed).
- **Scale**: Capable of storing up to 281 TB in a single file with zero maintenance, zero background service daemons.
- **WAL Concurrency**: Readers and writers run simultaneously without lock contention.
- **FTS5 Full-Text Search**: SQLite virtual table indexing `title`, `cat`, `type`, `author`, `deps`, `search`, and `file_path`. Automatic triggers keep the search index synchronized on every INSERT, UPDATE, and DELETE.
- **Inner Files Table (`asset_files`)**: Tracks individual files contained inside archives, enabling search for specific textures, PSDs, audio files, or fonts inside multi-gigabyte zip packs.
- **Memory-Mapped I/O**: Up to 30GB MMAP size for near-instant OS file caching.

### B. High-Performance Filesystem Scanner (`server/scanner.js`)
- Runs directly inside Node.js with native filesystem access (`fs.promises`).
- Recursively crawls any drive or directory on Windows (local disks or external drives).
- Fast ZIP Central Directory inspection: reads inner archive directories without decompressing huge files into RAM.
- Streams discoveries in bulk transactions directly into `archive.db`.
- Emits live progress (percentage, current file, elapsed time) via `/api/scan/status`.

### C. Unified Storage Service (`src/services/db.ts` & `src/services/api.ts`)
- Automatically routes all reads, writes, searches, and pool categorizations to `archive.db`.
- Purges any obsolete mock prototype assets so the catalog contains strictly real user data.
- Gracefully falls back to browser IndexedDB if the backend API is ever detached.

### D. 3D View Modes & Stage Choreography (`src/components/Stage.tsx`)
- Supports 7 distinct spatial view projections:
  1. `grid`: CSS/GSAP responsive card matrix with dynamic column densities ($2, 3, 4, 5, 6, 8$).
  2. `list`: High-density tabular layout.
  3. `coverflow`: True Apple-style 3D Coverflow with z-depth and Y-axis rotation.
  4. `strip`: Flat horizontal carousel with center elevation.
  5. `radial`: Cylindrical curved carousel layout with circular trigonometric positioning.
  6. `filmstrip`: Angled diagonal perspective strip.
  7. `peel`: Layered stack view with rotation fan.
