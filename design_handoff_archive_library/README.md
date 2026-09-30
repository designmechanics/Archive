# Handoff: Archive — personal asset & UI-effects library

## Overview
A browsable library for a personal archive of thousands of owned assets: code experiments (HTML/CSS/JS), zips, PSD/AI/Premiere files, SVG/icons, fonts, stock video and photos. Its main job is rediscovery. It offers seven view modes with choreographed transitions, category "pools", multi-select, and a slide-in side panel that runs or previews the selected entry. Most assets arrive as zip files.

## About the design files
`prototype/Archive.dc.html` is a **design reference built in HTML**: a working prototype showing the intended look, motion and behaviour. It is not production code. Recreate it in a real stack (suggested: Vite + React or Svelte, GSAP for motion, a zip library that reads byte ranges, and IndexedDB or SQLite for the index). If a codebase already exists, follow its patterns.

To run the prototype, open `prototype/Archive.dc.html` from a local static server. From the `prototype/` folder, run `npx serve .` and visit the URL it prints. `support.js` is the small runtime the file needs. GSAP and JSZip load from jsDelivr.

## Fidelity
**High-fidelity.** Colours, type, radii, motion timings and interactions are final unless noted.

## Layout
- A full-viewport grid with a 252px left rail and a fluid main column.
- **Rail** (`--rail`, a navy panel): wordmark "ARCHIVE", an indexing progress card, the list of 12 pools, the watched folders, and an "+ Add folder / drop zip" button.
- **Header row** (it wraps): a search field (min 220px, max 520px), a result count, the Light/Mid/Dark theme switch, "Surprise me", and "Ingest" (the primary button).
- **Toolbar row** (it wraps): a 7-way view switch, the "Per row" density control (2/3/4/5/6/8; grid view only), carousel prev/next buttons with a focus counter (carousel views only), and a hint line.
- **Stage:** absolutely positioned cards animated by GSAP, with perspective set to 1500px.
- **Selection bar:** floats at the bottom centre; shows the count and a "Throw into" list of pool chips.
- **Side panel:** 470px wide, slides in from the right. It holds the header (format, pool, title and tags), the sandbox iframe with a Replay button, a font specimen input (fonts only), the package file tree (zips), a metadata table, "Copy source/path" and "Next in pool ›".
- **Drop overlay** (whole window) and the **Ingest modal**.

## Views (`state.view`, persisted in `localStorage['archive.view']`)
Cards in carousel views are about 22% of the stage width (clamped to 200–300px), with height = width × 1.3. `d` is a card's offset from the focused card.
- **grid:** N columns (the density setting) with an 18px gap; card height = width × 0.74 + 132.
- **list:** a table with columns Preview, ★, Asset, Format, Pool, Source, Added.
- **coverflow:** x = centre + d × 0.52w; z = −|d| × 190; rotateY = −clamp(d × 30, ±46); scale 1 − 0.06|d|; hidden when |d| > 5.
- **strip:** x = centre + d × (w + 26); the focused card scales to 1.06; uses the elastic ease `elastic.out(0.55, 0.72)`.
- **radial (arc):** R = 1150; angle = d × 0.115; rotateZ = d × 6.6°. Opens on the middle card.
- **filmstrip:** vertical; y = d × 0.34h; rotateX = −clamp(d × 13, ±40). Opens on the middle card.
- **peel:** a stacked deck. Cards before the focus fly up and off, rotated −16° per step.
- Carousel input: dragging (110px per step), mouse wheel (90 units of accumulated scroll per step), ←/→ keys, and clicking a card to focus it. Clicking the focused card opens it.

## Motion
There is a global speed multiplier, prop `motion` (0.2–1.8, default 1). Every duration and stagger below is multiplied by it.
- **Intro:** the rail slides in from x = −260 (0.75s, `expo.out`). Elements marked `[data-intro]` rise 14px and fade in (0.5s, 0.026s stagger). Cards then lay out with a stagger of 0.016s per card, capped at 0.5s.
- **View change:** outgoing cards drop 54px, tilt rotateX −14, scale to 0.9 and fade (0.3s, `power2.in`, staggered from the centre). The new layout then animates in (0.72s, `expo.out`).
- **Filtering out:** cards fly into their pool's row in the rail (scale 0.12, rotateZ −24, z −300; 0.6s, `power3.inOut`).
- **Pool hover:** cards in that pool spring to scale 1.06 and xPercent −3.5 (`elastic.out(0.5, 0.55)`).
- **Pool fan (⊞):** up to 5 mini-cards fan out at ±13° each (`elastic.out`).
- **Throw selection:** selected cards fly to the chosen pool, the pool row pulses to scale 1.06, and the entries are recategorised.
- **Grid scroll reveal:** an IntersectionObserver fades cards in (opacity 1, y 0). Cards leaving view drop to opacity 0.08, y 26, rotateX −9.
- **Panel:** slides in with x from 104% to 0 (0.62s, `expo.out`); the sandbox rises in with a 0.1s delay.
- **Theme change:** all cards give a random-order elastic scale pulse (0.97 → 1).

## Ingest & zips (important)
Most assets are zips. How the prototype handles them:
1. Files can be dropped anywhere or chosen through the modal's file input.
2. For a zip, it reads the file listing (JSZip `loadAsync`) and creates one entry. The category is guessed from what's inside: html → Experiments, fonts → Typography, video → Transitions, css/js → Routines/utils, images → Backgrounds. Dependencies (gsap, three, pixi, etc.) are detected from file names. The largest image under 3 MB becomes the card cover (greyscale with multiply blend). All inner paths go into the search text.
3. Files are extracted only when needed. The default preview is `index.html` if present, then the first HTML file, then the first media file, then the first text file. An HTML preview is made self-contained: relative `<script src>`, stylesheets, CSS `url()` and `src`/`poster` references are inlined (assets as data URLs) into a sandboxed `srcdoc` iframe (`allow-scripts`).
4. Previews by type: images on a checkerboard, video/audio with controls, fonts via `@font-face` with the typeable specimen, code/text as `<pre>` (first 60 KB), anything else as the extension plus size. Files over 40 MB are not previewed.

**For production:**
- Use a zip reader that works on byte ranges (e.g. zip.js with `BlobReader`, or `yauzl` in Node/Electron). It should read only the table of contents at the end of the zip and then just the requested entry. JSZip loads the whole file into memory.
- "Watched folders" needs a desktop shell (Tauri or Electron) or a local indexer service. It walks the folders, reads each zip's table of contents once, and stores entries in SQLite or IndexedDB. The UI then queries that index and never opens a zip until the user previews something.
- The stage needs virtualisation at thousands of entries: only mount cards near the viewport, or near the focus in carousel views.
- The inliner doesn't handle ES-module `import`s, `fetch()` calls or dynamic paths. Serve an unpacked zip from a service worker or a local server under its own origin so relative loads just work.

## State
`entries[]` (id, title, cat, type, author, date, deps, size, fileCount, exts, thumb, packId, search), `view`, `density`, `query`, `pool`, `hoverPool`, `fan`, `focus`, `sel{}`, `star{}`, `openId`, `packSel`, `packDoc`, `modal`, `specimen`, `theme`, `seed` (shuffle), `replay`, `idx`/`idxFile` (indexing progress).

## Design tokens
Fonts: **Barlow Condensed** 600/700 for headings and UI labels (uppercase, letter-spacing .03–.06em); **Barlow** 400–600 for body text; `ui-monospace` 9.5–11px (uppercase, letter-spacing .08–.14em) for metadata.
Accent: `#5980a6` (prop `accent`, currently set to `#2c455d`). Ramp: `#94bce3`, `#b5d9fd`, `#416180`, `#2c455d`. The primary button is a gradient from `#6b91b6` to the accent, with a `0 2px 0 #416180` shadow underneath.

| token | light | mid | dark |
|---|---|---|---|
| --bg | #f2f2f3 | #7391b0 | #10161d |
| --surface | #ffffff | #b3c9df | #1b242e |
| --ink | #1d1f20 | #0f1b27 | #e9edf2 |
| --inkc (rgb) | 29,31,32 | 15,27,39 | 233,237,242 |
| --well | #e3e4e6 | #6384a6 | #0b1016 |
| --tint | #eef6ff | #d3e4f5 | #233447 |
| --tint-ink | #2c455d | #16263a | #b5d9fd |
| --rail | #1d2d3d | #182636 | #1a2a3b |

Radii: cards 16px, panels/modals 20–22px, buttons and inputs 11–13px, chips 99px.
Shadows: rest `0 1px 2px rgba(43,43,45,.14)`, hover `0 16px 34px rgba(43,43,45,.2)`, panel `-20px 0 60px rgba(29,45,61,.42)`.
Note: the base "Industry" design system uses square corners and blueprint corner marks. This app deliberately uses rounded, tactile corners at the owner's request.

## Assets
There are no bitmap assets. Card thumbnails are striped placeholders until a real image is ingested. The 54 seed entries in the prototype are sample data.

## Files
- `prototype/Archive.dc.html`: the whole prototype. The template is at the top; the logic class (layout maths, GSAP choreography, zip ingest/inliner, themes) is in the script at the bottom.
- `prototype/support.js`: the runtime needed to open the prototype.
