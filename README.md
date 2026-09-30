# Archive — Personal Asset & UI-Effects Library

Production-ready implementation of **Archive**, recreating and expanding upon the design prototype (`prototype/Archive.dc.html`) with a modern, reactive TypeScript + React + Vite + GSAP stack with IndexedDB persistence and byte-range zip ingestion.

---

## ⚡ Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

Server runs locally at `http://127.0.0.1:6080` (or `http://localhost:6080`).


---

## 🚀 Key Features

### 1. Seven Interactive View Modes with GSAP Choreography
- **Grid View**: Density control (2, 3, 4, 5, 6, 8 cards per row). Card dimensions scale fluidly (`height = width * 0.74 + 132`). Integrated `IntersectionObserver` animates cards into view with 3D tilt.
- **List View**: Dense, structured table displaying Preview, Star status, Asset title, Format badge, Pool category, Source/Author, and Date.
- **Coverflow**: Apple-style 3D perspective tilt (`rotateY = -clamp(d * 30, ±46)`), depth stacking (`z = -|d| * 190`), and subtle vertical curvature.
- **Strip View**: Horizontal carousel with elastic snap easing (`elastic.out(0.55, 0.72)`) and focal card scaling (1.06×).
- **Arc (Radial) View**: Circular arc wheel projection (`R = 1150px`, `angle = d * 0.115`, `rotateZ = d * 6.6°`) opening directly on the focal card.
- **Filmstrip View**: Vertical 3D perspective scrub with tilt (`rotateX = -clamp(d * 13, ±40)`).
- **Peel View**: Physical stacked deck. Previous cards fly up and away rotated `-16° * k`, while upcoming cards remain neatly stacked.

### 2. Full Carousel Gestures & Keyboard Navigation
- **Smooth Dragging**: Tracks drag velocity with 110px threshold per step.
- **Mouse Wheel**: Accumulated scroll threshold (90 units) for precise card stepping.
- **Keyboard Shortcuts**:
  - `←` / `→`: Step carousel left / right.
  - `Escape`: Close open Side Panel or Ingest Modal.
  - `⌘-click` / `Ctrl-click` / `Shift-click`: Multi-select assets.

### 3. Pools & Left Rail
- Wordmark **ARCHIVE** with asset count and pool statistics.
- **Simulated Indexer Card**: Animated gradient progress bar and active file path tracker.
- **12 Categories / Pools**: Effects, Buttons, Loaders, Backgrounds, Transitions, Typography, Layouts, Scroll, Physics, Shaders, Routines/utils, Experiments.
- **Magnetic Pool Hover**: Hovering any pool springs matching cards on stage (`scale: 1.06`, `xPercent: -3.5`).
- **Fan Out Mini Cards (⊞ / –)**: Expands up to 5 mini-cards in an elastic fan (`±13°` stagger).
- **Watched Folders**: Monospace list of active folders with pulsing status indicators and item counts.

### 4. Selection & "Throw Into" Pool Animation
- Multi-select multiple assets via `Cmd/Ctrl/Shift + Click`.
- Floating bottom selection bar displaying item count and pool targets.
- **Throw Selection**: Cards fly in 3D into the targeted pool row in the left rail (`scale: 0.1`, `rotateZ: -30 + i * 8`, `opacity: 0`), triggering a pulse animation on the pool badge and persisting category changes in IndexedDB.

### 5. Slide-In Side Panel & Sandboxed Iframe Runner
- 470px wide slide-in drawer (`expo.out`).
- **Interactive Sandbox**: Sandboxed `<iframe>` (`allow-scripts allow-pointer-lock`) running self-contained code experiments with a dedicated "Replay" action.
- **Typeable Font Specimen**: Live text field allowing interactive testing of OTF/TTF/WOFF typefaces at multiple scales (46px, 24px, 15px) and full character sets.
- **Package File Tree**: In-depth directory explorer for zip packages. Displays directory paths, file names, and byte-formatted file sizes. Clicking any file immediately previews it.
- **Metadata Inspection**: Format, Pool, Source, Added Date, File Size, Dependencies, File Count, and Path.
- **Quick Actions**: "Copy source" / "Copy path" and "Next in pool ›".

### 6. Production-Grade Ingestion Engine & Byte-Range Zip Handling
- Global drag-and-drop overlay ("Drop to ingest").
- Ingest Modal with file picker and custom folder path input.
- Uses `@zip.js/zip.js` with `BlobReader` to read the central directory / table of contents from byte ranges without uncompressing unnecessary files into memory.
- **Automatic Asset Categorization**:
  - HTML/HTM → Experiments
  - Fonts (OTF, TTF, WOFF) → Typography
  - Video/Audio (MP4, WEBM, MOV, MP3) → Transitions
  - CSS/JS → Routines/utils
  - Images (PNG, JPG, SVG, WEBP) → Backgrounds
- **Dependency Detection**: Detects `gsap`, `three`, `jquery`, `p5`, `matter`, `pixi`, `anime`, `lottie`, `swiper`, `splitting`.
- **Thumbnail Generation**: Extracts the largest image under 3MB as a grayscale multiply card cover.
- **Smart HTML Sandbox Inliner**: Resolves relative `<script src>`, `<link rel="stylesheet">`, CSS `url(...)`, and media references into self-contained data/blob URLs.
- **IndexedDB Persistence**: Stores uploaded zips and asset entries in IndexedDB (`idb`) so imported assets survive browser refreshes.

### 7. Design Tokens & Theming
- Strict adherence to the Industry design tokens:
  - **Light**: `#f2f2f3` bg, `#ffffff` surface, `#1d1f20` ink, `#1d2d3d` rail
  - **Mid**: `#7391b0` bg, `#b3c9df` surface, `#0f1b27` ink, `#182636` rail
  - **Dark**: `#10161d` bg, `#1b242e` surface, `#e9edf2` ink, `#1a2a3b` rail
- Switching themes triggers a random elastic bounce on cards (`scale: 0.97 → 1`).
- Typography: Barlow Condensed 600/700, Barlow 400-600, ui-monospace / Menlo.

---

## 📁 Project Structure

```
d:/Archive/
├── index.html                   # Root HTML template with design tokens & fonts
├── package.json                 # Dependencies & scripts
├── vite.config.ts               # Vite configuration
├── tsconfig.json                # TypeScript compiler configuration
├── dist/                        # Production build bundle
├── src/
│   ├── types/
│   │   └── index.ts             # TypeScript interfaces & types
│   ├── data/
│   │   └── seedData.ts          # 54 canonical sample assets, MIME map & demos
│   ├── services/
│   │   ├── db.ts                # IndexedDB persistence (idb)
│   │   └── zipService.ts        # Byte-range zip reader, inliner & previews
│   ├── components/
│   │   ├── Rail.tsx             # Left rail navigation, pools & watched folders
│   │   ├── Header.tsx           # Search, themes, shuffle & ingest
│   │   ├── Toolbar.tsx          # 7 view modes, density & carousel controls
│   │   ├── Stage.tsx            # 3D GSAP layout & gesture choreography
│   │   ├── ListView.tsx         # Dense data table view
│   │   ├── SidePanel.tsx        # 470px drawer, sandbox, tree & font specimen
│   │   ├── SelectionBar.tsx     # Bottom floating multi-select bar & throw action
│   │   ├── IngestModal.tsx      # Ingest dialog for zips & folders
│   │   └── DropOverlay.tsx      # Full-window drag-and-drop overlay
│   ├── App.tsx                  # Root application container & controller
│   └── main.tsx                 # Entry mount point
└── design_handoff_archive_library/ # Original design handoff & prototype
```
