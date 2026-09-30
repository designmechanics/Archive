# Production Architecture Plan: Eradicating Mocks in Archive Library

## Overview
This plan details the systematic identification, replacement, and verification of all mock, simulated, and placeholder mechanisms in the Archive library with authentic, production-grade implementations.

---

## 1. Audit of Mock / Simulated Components

| Component | Current Mock Implementation | Production Target (100% Real) |
|---|---|---|
| **Theme Default** | Defaults to `light` theme. | Set default to `dark` theme as requested by user. |
| **Indexing Progress Card** | `setInterval` randomly advancing percentage (`prev % 5 + 2`) and picking from 8 hardcoded string paths (`/Archive/2019/loaders/gooey.zip`, etc.). | Real Indexing Manager queue that reports real operations: actual folder scans, file ingestions, byte counts, real percentage (`current / total`), real file paths, and true elapsed indexing times. |
| **Watched Folders** | Hardcoded mock Mac paths (`/Volumes/Archive/Code`, etc.) with fake counts (`1.4k`, `612`). | Authentic Folder Indexer: integrates browser File System Access API (`showDirectoryPicker`) + Directory input fallback + local filesystem scanning API. Real file tree crawl, real item count, persistent in IndexedDB. |
| **Zip Package Tree & Content** | Seed zip items used hardcoded dummy file tree rows (`index.html`, `style.css`, `gsap.min.js`) that were unclickable or had no backing data. | Real virtualized / in-memory and IndexedDB-backed Zip packages with genuine files, real byte sizes, and instant previewing of every sub-file upon clicking. |
| **Initial 54 Sample Assets** | Prototype auto-seeded 54 mock entries (`a0`–`a53`) with mock dates and mock authors. | Database auto-purges mock seed entries on load. Archive starts completely clean (0 assets) until the user actually adds or crawls real files. Added a tactile empty state with direct ingest actions. |
| **Code Experiment Sandbox Previews** | Raw entries repeated 4 hardcoded CSS snippets across 54 items, with many non-code items showing empty or static placeholders. | Real, diverse, fully functioning HTML/CSS/Canvas/WebGL/SVG/JS interactive demos tailored to each category (Loaders, Shaders, Physics, Scroll, Magnetic buttons, Aurora gradients, Particle trails, etc.). |
| **Font Specimen Engine** | Fallback to Barlow Condensed without loading custom font face bytes. | Genuine `@font-face` dynamic font generator using data URIs / Blob URLs, interactive font weight/size scaling, and full glyph table rendering. |
| **Audio / Video Previews** | Dummy CSS box with a static play triangle. | Real playable media (HTML5 `<video>` / `<audio>` with generated waveforms or synthesized Web Audio media for immediate playback). |
| **Search Engine** | Basic substring matching. | Multi-token fuzzy/structured search indexing title, pool, author, dependencies, tags, formats, extensions, and recursive zip file contents. |
| **Export & Retrieval** | Only clipboard copy of path strings. | Real asset download/export: download original zip package, download individual files from package tree, copy raw file source code. |

---

## 2. Implementation Architecture

### Phase 1: Real Indexing Engine & Queue
- Create `src/services/indexingEngine.ts`:
  - `IndexingState`: `status` ('idle' | 'scanning' | 'unpacking' | 'ready'), `currentFile`, `processedCount`, `totalCount`, `percentage`, `errors`.
  - Event-driven subscriber pattern so Rail and Header update in real time without polling.
  - Integration with File System Access API (`window.showDirectoryPicker()`):
    - Recursively iterates directory handles (`FileSystemFileHandle`, `FileSystemDirectoryHandle`).
    - Filters unsupported files and skips noise (`node_modules`, `.git`, `.DS_Store`).
    - Feeds files into the ingestion pipeline, emitting live progress events.

### Phase 2: Local Filesystem Integration & Watched Folders
- Replace hardcoded Mac paths with real Windows/local paths:
  - Default watched folders initialize to user's real workspace paths (e.g. `D:\Archive`).
  - "+ Add folder" triggers native folder selection via `showDirectoryPicker()`.
  - Calculates real file counts, categorizes assets, and persists folder records in IndexedDB.
  - Adds a "Rescan" trigger to re-read updated folders on demand.

### Phase 3: Real Asset Packages & Live Demos
- Enhance `src/data/seedData.ts`:
  - Build real interactive demos for all categories:
    - **Loaders**: Gooey blob morph, Skeleton shimmer, Orbit spinner trio, Halftone canvas loader.
    - **Buttons**: Magnetic cursor button with interactive mouse physics, Squish press micro-state, Segmented toggle slide.
    - **Backgrounds**: Aurora mesh gradient, Noise displacement canvas, Conic rotating gradient, Grain texture generator.
    - **Effects**: Chromatic split hover, Ripple reveal mask, Blueprint corner marks SVG interactive generator.
    - **Shaders**: Interactive WebGL shader canvas (Halftone dither, Refraction glass panel).
    - **Transitions**: Kinetic marquee ticker, Liquid page wipe, Ken Burns crossfader.
    - **Physics**: Matter.js / spring simulation, Elastic drawer spring, Springy tag cluster.
    - **Typography**: Variable weight scroller, Kinetic headline splitter, Text scramble decoder with real character cycling.
    - **Routines/utils**: Live Easing curve visualizer with interactive cubic-bezier curve, Color ramp OKLCH generator.
  - Create genuine backing `ZipPack` instances for the seed zip assets (e.g., `Neo-brutal button pack.zip`, `Loader collection 40x.zip`, `Scroll demos 2024.zip`, `Shader playground.zip`), so the package tree in the SidePanel is 100% interactive and displays real files that run in the sandbox when clicked!

### Phase 4: Full Ingestion & Real Zip Handling
- Enhance `src/services/zipService.ts`:
  - Ensure byte-range zip reading with `@zip.js/zip.js` works seamlessly for user-uploaded zips.
  - Implement full recursive file extraction for previews.
  - Provide direct download button for stored packages.

### Phase 5: Dark Theme Default & UI Polish
- Set default theme to `'dark'` in `src/App.tsx`, `src/services/db.ts`, and `index.html`.
- Ensure dark theme tokens (`--bg: #10161d`, `--surface: #1b242e`, `--rail: #1a2a3b`, `--ink: #e9edf2`) apply on first load without flash.

---

## 3. Verification & Testing Checklist
- [x] No `setInterval` mock generators for the indexer.
- [x] Indexer displays real status when idle and real progress when scanning/unpacking.
- [x] Watched folders use real local directory picker and calculate genuine counts.
- [x] Seed zip packages have real clickable files in the package tree that render in the sandbox.
- [x] Interactive demos run live code, responding to user pointer/mouse inputs.
- [x] Default theme is Dark upon fresh reload.
- [x] Ingesting any real `.zip` extracts real files, generates real thumbnails, and persists in IndexedDB.
- [x] Build succeeds with zero TypeScript errors.
