# 🎨 Archive: Creative Workflows Guide
### *A Creative Operating System for Ideation, Picture Creation & Logo Design*

**Archive** is a high-performance, local-first visual asset workspace engineered for visual thinkers, art directors, prompt engineers, and brand identity designers. Combining 7 hardware-accelerated GSAP presentation views, 12 specialized inspection viewports, a reactive sandbox runner, and an instant byte-range ZIP ingestion pipeline, Archive transforms disorganized asset folders into a fluid, tactile creative laboratory.

This guide details how to leverage Archive's specific systems for three core disciplines:
1. **Ideation & Creative Direction** (Moodboarding, visual serendipity, concept clustering, and rapid triage)
2. **Picture Creation & Image Direction** (AI reference libraries, color extraction, composition analysis, and 3D lighting studies)
3. **Logo Design & Brand Identity** (Vector curve auditing, live typographic specimen testing, contrast validation, and SVG export)

---

## 🧭 Architecture for Visual Thinkers

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     TOP TOOLBAR & HUD                                       │
│  [Search & Tag Filter]  [Stage | Film | Grid | List | Coverflow | Radial | Peel]  [Theme]    │
├───────────────────┬───────────────────────────────────────────┬─────────────────────────────┤
│   LEFT RAIL       │              STAGE CANVAS                 │    UNIVERSAL PREVIEW        │
│ • 12 Active Pools │  • Fluid GSAP Spatial Choreography        │  • Dual-Width: 56vw / 88vw  │
│ • Watched Folders │  • Infinite Smooth Drag & Wheel Scrub     │  • 12 Dedicated Viewports   │
│ • "Throw-Into"    │  • Multi-Card Selection (Cmd/Ctrl/Shift)  │  • Interactive Code/Sandbox │
│   Drop Targets    │  • Responsive Card Scaling (1080p to 4K)  │  • Live Font Specimen Engine│
└───────────────────┴───────────────────────────────────────────┴─────────────────────────────┘
```

### Key Creative Guarantees
* **100% Local-First Privacy**: Your unreleased concept art, confidential client pitch decks, and brand marks stay strictly on your local disk via SQLite OPFS and IndexedDB. Nothing leaves your machine.
* **Instantaneous Search & Zero Latency**: Filter across thousands of images, vectors, fonts, and 3D meshes by title, tag, author, or file extension in under 5 milliseconds.
* **Responsive Multi-Resolution Support**: Perfectly calibrated for high-density 4K / 1440p studio monitors, with automatic responsive scaling rules (`@media (max-width: 1920px)`) for 1080p laptop field work.

---

## 💡 Part 1: Ideation & Concept Exploration

Ideation requires breaking out of static file grids to discover unexpected visual relationships, juxtaposition, and thematic rhythms. Archive provides 7 distinct spatial lenses to spark creative connections.

### 1. The 7 Spatial Views as Creative Thinking Lenses

| View Mode | Spatial Paradigm | Best Creative Use Case in Ideation |
| :--- | :--- | :--- |
| **Coverflow** | 3D perspective depth stack with dynamic Y-axis tilt (`±46°`) | **Serendipitous Moodboarding**: Flipping through diverse visual seeds like a physical record crate. Reveals silhouettes and focal points without visual clutter. |
| **Arc / Radial** | Circular wheel projection (`R = 1150px`, rotation around center) | **Concept Exploration**: Rotating through color palettes, character archetypes, or interface patterns like an artist's color wheel. |
| **Filmstrip** | 3D vertical stack with tilt (`rotateX = ±40°`) | **Narrative & Storyboarding**: Evaluating visual pacing, comic panels, video sequences, and user journeys top-to-bottom. |
| **Peel** | Stacked physical card deck | **Rapid Gut-Check Triage**: High-speed "keep or discard" decision making. Previous cards fly away at `-16°`, keeping focus on the next idea. |
| **Grid** | Fluid 2 to 8-column responsive responsive grid | **Macro Density Overview**: Step back to evaluate overall color balance, tonal weight, and visual variety across an entire campaign. |
| **Strip** | Snap-elastic horizontal carousel with focal card scaling (1.06×) | **Side-by-Side Comparison**: Comparing variations of a single concept or hero illustration with elastic flick gestures. |
| **List** | Compact metadata table with sticky header | **Systematic Audit**: Sorting by file size, format, date added, or author to organize massive multi-gigabyte mood repositories. |

### 2. Physical "Throw-Into" Pool Curation
Instead of dragging files through nested file-system dialogs:
1. Select multiple cards using **Cmd+Click** / **Ctrl+Click** or **Shift+Click**.
2. A floating glass **Selection Bar** appears at the bottom of the canvas.
3. Click any target pool (e.g., `Effects`, `Backgrounds`, `Typography`, `Experiments`).
4. **GSAP 3D Trajectory Animation**: The selected cards shrink, rotate in 3D (`rotateZ: -30°`), and fly into the Left Rail pool button, immediately updating database categories and pool count badges.

### 3. Interactive Code & Shader Sandbox
When ideating dynamic graphics, UI effects, or generative shaders:
* Open any HTML, CSS, or JavaScript asset into the slide-out **Side Panel**.
* The **Sandboxed Iframe** executes the code in real time with hardware WebGL acceleration.
* Test responsive behavior with one-click viewport presets:
  * **Desktop (100%)**
  * **Laptop (1024 × 768)**
  * **Tablet (768 × 1024)**
  * **Mobile (375 × 812)**
* Click **Replay** to re-trigger GSAP, CSS, or Three.js entrance animations to check timing and easing.

---

## 🖼️ Part 2: Picture Creation & Visual Art Direction

Whether you are crafting prompts for Midjourney / Stable Diffusion, painting digital illustrations, or sourcing textures for 3D matte painting, Archive acts as an ultra-high-resolution reference station.

### 1. High-Fidelity Image Inspection (`ImageViewer`)

Open any `.png`, `.jpg`, `.jpeg`, `.webp`, `.avif`, or `.gif` to activate the specialized Image Viewport:

* **Infinite Pan & Zoom ($25\%$ to $800\%$)**:
  * Use the mouse wheel or on-screen zoom stepper to magnify details.
  * Click and drag to pan across high-res renders.
  * Check for digital noise, compression artifacts, brushwork edges, and generative AI inconsistencies (hands, eyes, seams).
* **Pixel Grid at $\ge 400\%$ Zoom**:
  * Automatically reveals underlying pixel boundaries. Essential for pixel art, crisp UI icons, and retro game sprite evaluation.
* **Studio Backdrop Switcher**:
  * **Dark Checkerboard / Light Checkerboard**: Test alpha channel cutouts, rim lighting, and transparency fringes.
  * **Pitch Black (`#0a0f14`)**: Evaluate contrast, luminance, and cinematic shadow falloff.
  * **Pure White (`#ffffff`)**: Check high-key lighting, print margins, and white-point clipping.
* **1:1 Actual Size vs. Fit to Viewport**: Instantly toggle between natural pixel dimensions and responsive fitting.

### 2. Automatic Dominant Color Palette Extractor
Every image loaded into the preview panel automatically extracts its **5 to 8 dominant hex colors**:
* **Color Chips**: Displayed directly below the image canvas.
* **One-Click Hex Copy**: Click any swatch to copy its `#RRGGBB` code to your clipboard.
* **Creative Uses**:
  * Feed extracted hex codes into AI generation prompts (e.g., `--sref` style references or color palette guidance).
  * Build harmonious branding palettes directly from moodboard photography.
  * Check color temperature balance across a multi-image sequence.

### 3. Image Dimension & Aspect Ratio HUD
Instantly inspect critical metadata badges:
* **Pixel Resolution**: Exact width $\times$ height (e.g., `3840 × 2160`).
* **Aspect Ratio**: Automatically calculated ratio badge (`16:9`, `1:1`, `4:3`, `9:16`, `21:9`).
* **Byte Size**: Human-readable file size formatting (`4.2 MB`, `850 KB`).

### 4. 3D Model & Lighting Studio (`ThreeViewer`)
Before painting a 2D scene or finalizing a 3D composite, load `.glb`, `.gltf`, or `.obj` assets:
* **OrbitControls**: Left-click to orbit, right-click to pan, scroll wheel to dolly zoom.
* **Lighting Modes**:
  * **Studio 3-Point Light**: Key, fill, and rim lights to study form and specular reflections.
  * **Flat MatCap**: Evaluates pure silhouette and volume without distracting textures.
  * **Polygon Wireframe**: Strips materials to inspect edge flow, quad topology, and poly count.
* **Ground Coordinate Grid**: Reference floor plane to check scale, perspective, and horizon vanishing points.
* **Auto-Spin Camera**: Continuous turntable rotation for hands-free reference observation while drawing.

---

## ✒️ Part 3: Logo Design & Brand Identity

Logo design demands extreme mathematical precision, typographic harmony, and versatility across light and dark mediums. Archive is tailored for rigorous vector and typographic testing.

### 1. Vector Path Auditing (`VectorViewer`)

Load any `.svg`, `.ai`, or `.eps` into the vector viewport:

* **Lossless Vector Scaling**: Zoom in infinitely ($1000\%+$) without raster pixelation or blur to inspect micro-details of curves and corners.
* **Outline / Wireframe Stroke Mode**:
  * Instantly disables shape fills and converts all paths to razor-sharp colored outlines.
  * **What to Look For**:
    * Redundant, overlapping, or intersecting nodes.
    * Missed boolean joins and stray path fragments.
    * Inconsistent bezier curve handles and unintended kinks in smooth contours.
* **ViewBox & Path HUD**:
  * Displays total `<path>` count and native `viewBox` coordinates (`0 0 512 512`).
* **One-Click Export Actions**:
  * **Copy Clean SVG Code**: Grabs sanitized SVG markup ready to paste straight into Figma, Illustrator, or web code.
  * **Copy Data URI**: Prepares `data:image/svg+xml;utf8,...` string for immediate CSS or HTML embedding.
  * **Download File**: Cleanly saves the vector asset to disk.

### 2. Live Typographic Specimen Engine

Typefaces make or break a brand. Archive features a dedicated font tester that supports `.otf`, `.ttf`, and `.woff` formats:

* **Interactive Text Input**: Type the exact client brand name, tagline, or slogan (e.g., *"ARCHIVE — Studio Systems"*).
* **Multi-Scale Hierarchy Preview**:
  * **Display (46px)**: High-impact hero scale to evaluate letter-spacing, kerning, and display personality.
  * **Headline (24px)**: Sub-heading and packaging lockup scale.
  * **Body (15px)**: Legibility test at standard paragraph text sizes.
* **Full Character Set & Glyph Audit**: Inspect capital letters `A–Z`, lowercase `a–z`, numerals `0–9`, and special punctuation glyphs for glyph completeness and stylistic accents.

### 3. Contrast & Versatility Validation
A world-class logo must hold its identity on dark screens, white paper, and tinted backgrounds:
* **Theme Switching**: Cycle Archive between **Dark** (`#10161d`), **Mid** (`#7391b0`), and **Light** (`#f2f2f3`) via the top header switcher.
* **Background Watermark Inspiration**:
  * Notice the stage's architectural watermark: a towering condensed bold glyph juxtaposed with a flowing copperplate cursive script. This built-in typographic pairing serves as a live study in contrasting typographic weights.

### 4. Dual-Width Studio Mode (`56vw` ⇄ `88vw`)
* **Dock Mode (56vw)**: Keeps your stage cards visible on the left while docking the preview on the right. When opening an asset, the stage automatically centers the active card in the remaining space for seamless side-by-side comparison.
* **Studio Mode (88vw)**: Expands the preview panel across nearly the entire monitor, dimming the background for maximum focus on complex vector marks, full brand style guides, or high-res brand sheets.

---

## ⚡ Keyboard Shortcuts & Quick Actions Reference

| Shortcut | Context | Action Performed |
| :--- | :--- | :--- |
| `←` / `→` | Stage / Carousels | Step backward or forward through cards |
| `‹` / `›` | Side Panel Header | Navigate to previous / next asset in the active pool |
| `Escape` | Global | Close open Side Panel, Ingest Modal, or Settings Modal |
| `Cmd` / `Ctrl` + Click | Stage Cards | Toggle individual card in multi-selection |
| `Shift` + Click | Stage Cards | Range select multiple cards for pool assignment |
| `Space` / Click | Video Viewport | Play / Pause video reference |
| `[` / `]` | Video Viewport | Frame-step backward / forward (`0.04s`) |
| `A-` / `A+` | Markdown / Code | Decrease or increase inspector font size |
| `Drag & Drop` | Anywhere | Drop files or ZIP archives to trigger instant ingestion |

---

## 📂 Recommended Pool Structure for Designers

To get the most out of Archive for end-to-end design projects, configure your Pools in the left rail:

```
ARCHIVE ASSET LIBRARY
├── 🎨 Brand Marks      (SVG logos, monograms, lockups, badges)
├── 🔤 Typography       (OTF, TTF, WOFF brand fonts & specimen files)
├── 🌅 Moodboards       (AI generations, photography, art direction refs)
├── 🧱 Textures & Mats  (Seamless patterns, paper grain, normal maps)
├── 📐 Vectors & Icons  (Icon sets, glyphs, layout grids, wireframes)
├── 🧊 3D & Models      (GLB product mockups, packaging, clay shapes)
├── 🎞️ Motion & Video   (UI transitions, reel cuts, animated logos)
├── 🧪 Shaders & FX     (Canvas experiments, CSS animations, WebGL)
└── 📦 Archive Packs    (ZIP bundles from design asset marketplaces)
```

---

*Archive is designed and built for creators who demand speed, tactile elegance, and total ownership over their visual reference ecosystem.*
