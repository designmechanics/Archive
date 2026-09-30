# Architecture & Implementation Plan: Multi-Format Preview System

This document outlines the blueprint and specification for the **Universal Preview System** in Archive. It specifies the architecture, the slide-out preview tab system, and the 11 specialized viewports with dedicated GSAP-choreographed toolbars.

---

## 1. System Architecture & Component Hierarchy

```mermaid
graph TD
    AssetSelect([Asset Selected or Sub-file Clicked]) --> Trigger[Open Preview Drawer]
    Trigger --> Drawer[PreviewDrawer / Enhanced SidePanel]
    
    Drawer --> TabNav[Preview Viewport Tabs & Mode Toggle]
    Drawer --> WidthToggle[Standard 480px ⇄ Studio 820px Expand]
    
    TabNav --> V_Img[1. Image Viewport]
    TabNav --> V_Vid[2. Video Viewport]
    TabNav --> V_Aud[3. Audio Viewport]
    TabNav --> V_3D[4. 3D Mesh Viewport]
    TabNav --> V_Vec[5. Vector Viewport]
    TabNav --> V_Pdf[6. PDF Viewport]
    TabNav --> V_Md[7. Markdown Viewport]
    TabNav --> V_Doc[8. Document Viewport]
    TabNav --> V_Code[9. Code Viewport]
    TabNav --> V_Json[10. JSON Viewport]
    TabNav --> V_Css[11. CSS Viewport]
    TabNav --> V_Html[12. HTML Sandbox Viewport]

    subgraph GSAP Motion Layer
        SpringHUD[Floating Glass HUDs]
        StaggerControls[Staggered Toolbar Pills]
        PanelMorph[Panel Width & Depth Morph]
    end

    Drawer --- GSAP Motion Layer
```

---

## 2. Dynamic Slide-Out Drawer & Layout System

### A. Dual-Width Expansion Mode
1. **Standard Drawer Mode (480px)**: Default docked panel for rapid browsing, metadata checking, and quick file inspection.
2. **Studio Expanded Mode (820px or 75vw)**: One-click expand trigger (`⤢ Expand Studio`) for wide format inspections: 3D model rotation, multi-column code comparisons, high-resolution photography, and wide video timelines.
3. **GSAP Choreography**:
   - `xPercent: 104 → 0` on entry (`duration: 0.55`, `ease: 'expo.out'`).
   - Width transition via GSAP `to(drawer, { width: isStudio ? '820px' : '480px', duration: 0.45, ease: 'power3.inOut' })`.

### B. Auto-Detection of File Viewport
When an asset or a file inside a ZIP archive is clicked, the engine automatically selects the optimal viewport:
- `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.avif`, `.bmp` $\to$ **Image Viewport**
- `.mp4`, `.webm`, `.mov`, `.mkv` $\to$ **Video Viewport**
- `.mp3`, `.wav`, `.flac`, `.aac`, `.ogg` $\to$ **Audio Viewport**
- `.glb`, `.gltf`, `.obj` $\to$ **3D Asset Viewport**
- `.svg`, `.ai`, `.eps` $\to$ **Vector Viewport**
- `.pdf` $\to$ **PDF Viewport**
- `.md`, `.markdown`, `.mdx` $\to$ **Markdown Viewport**
- `.txt`, `.rtf`, `.log`, `.csv` $\to$ **Document Viewport**
- `.json`, `.geojson`, `.map` $\to$ **JSON Viewport**
- `.css`, `.scss`, `.sass`, `.less` $\to$ **CSS Viewport**
- `.html`, `.htm` $\to$ **HTML Sandbox Viewport**
- `.js`, `.ts`, `.tsx`, `.jsx`, `.py`, `.sh`, `.sql` $\to$ **Code Viewport**

---

## 3. The 12 Viewports & Dedicated Control Suites

### 1. Image Viewport (`ImageViewer.tsx`)
- **Features**: Pan & zoom (25% to 800%), wheel zoom, click-drag pan.
- **Controls**:
  - `1:1 Actual Size` / `Fit to Viewport`.
  - Backdrop switcher: Transparent Checkerboard (Light / Dark) vs. Solid Pitch Black (`#0a0f14`) vs. Clean White.
  - Pixel Grid Toggle: Reveals pixel boundaries at $\ge 400\%$ zoom.
  - Color Palette Inspector: Auto-extracts dominant colors into interactive hex chips.
  - Image HUD: Dimension ($W \times H$ px), aspect ratio (e.g. `16:9`, `1:1`, `4:3`), and file size.

### 2. Video Viewport (`VideoViewer.tsx`)
- **Features**: Native HTML5 Video wrapped with GSAP custom controls.
- **Controls**:
  - Scrub bar with hovered time preview and loaded buffer gauge.
  - Play / Pause with center spring icon pulse.
  - Timecode display: `00:14.22 / 01:45.00` + Frame counter.
  - Speed selector pills: `0.25x`, `0.5x`, `1x`, `1.5x`, `2x`.
  - Frame stepping: `Step -1 Frame` (0.04s) and `Step +1 Frame` for precise motion analysis.
  - Loop toggle & Volume / Mute slider.
  - Fullscreen / Popout preview.

### 3. Audio Viewport (`AudioViewer.tsx`)
- **Features**: Real-time interactive waveform / audio spectrum.
- **Controls**:
  - Animated canvas visualizer (frequency bars + live playback needle).
  - Play / Pause with elastic recoil button.
  - Time scrubber and duration readouts.
  - Loop toggle.
  - Volume slider and Mute button.
  - Technical Badges: Sample rate (`44.1kHz` / `48kHz`), Channels (Stereo/Mono), File format.

### 4. 3D Mesh Viewport (`ThreeViewer.tsx` via Three.js)
- **Features**: WebGL canvas rendering 3D geometries, glTF, and OBJ files.
- **Controls**:
  - OrbitControls: Left-click rotate, right-click pan, wheel zoom.
  - Wireframe mode toggle (shaded solid vs. polygon wireframe).
  - Lighting toggle (Studio 3-point light vs. Flat MatCap vs. Clay shader).
  - Ground grid toggle (reference coordinate grid on floor plane).
  - Auto-spin camera toggle with adjustable spin velocity.
  - Mesh HUD: Triangle/Polygon count, Vertex count, Bounding box dimensions ($X \times Y \times Z$).
  - Reset Camera button.

### 5. Vector Viewport (`VectorViewer.tsx`)
- **Features**: Native SVG rendering with vector precision.
- **Controls**:
  - Infinite vector zoom without pixelation.
  - Outline / Wireframe stroke mode: Overrides fills with colored strokes to inspect vector path topology.
  - Canvas background switcher (checkerboard / dark / light).
  - Path counter & ViewBox HUD.
  - Quick actions: "Copy Clean SVG Code", "Copy Data URI", "Download SVG".

### 6. PDF Viewport (`PdfViewer.tsx`)
- **Features**: Interactive PDF document viewer.
- **Controls**:
  - Multi-page navigation (Previous / Next page buttons, jump to page input, total pages count).
  - Fit Width vs. Fit Whole Page toggle.
  - Rotation: $90^\circ$ clockwise rotation step.
  - Download PDF and Open in New Tab buttons.

### 7. Markdown Viewport (`MarkdownViewer.tsx`)
- **Features**: GFM Markdown engine (`marked`), auto-generated Table of Contents outline, typography controls, and full reading HUD.
- **Controls**:
  - View Mode Pills: **Preview** (rich rendered GFM with styled codeblocks, tables, blockquotes) ⇄ **Split** (side-by-side raw source & rendered) ⇄ **Raw** (line-numbered monospace).
  - Table of Contents (`📑 TOC`) Slide-out Drawer: Auto-extracts H1-H4 headings with one-click smooth jump to heading.
  - Quick Search in MD with real-time match counter.
  - Font Size Stepper (`A-` / `A+`, 11px to 20px).
  - One-click actions: "Copy MD", "Copy HTML".
  - Reading HUD: Total lines, word count, character count, and estimated reading time (~min read).

### 8. Document Viewport (`DocViewer.tsx`)
- **Features**: Clean plain-text and document reader.
- **Controls**:
  - Formatted View vs. Raw Text toggle.
  - Word count, reading time HUD.
  - Copy text button.

### 9. Text / Code Viewport (`CodeViewer.tsx`)
- **Features**: Monospace syntax-styled code inspector.
- **Controls**:
  - Line numbers gutter with active line highlight.
  - Soft-wrap toggle (Word Wrap on / off).
  - Font size stepper (11px, 12.5px, 14px, 16px).
  - Search in code input with match count (`3 of 12`).
  - Copy all source / Copy selected lines.

### 10. JSON Viewport (`JsonViewer.tsx`)
- **Features**: Interactive hierarchical JSON explorer.
- **Controls**:
  - Expand All / Collapse All nested nodes.
  - Key & Value search filter with instant tree pruning.
  - Type pill color-coding (`string` = green, `number` = cyan, `boolean` = amber, `null` = magenta).
  - Beautify / Minify toggle.
  - Copy clean JSON button.

### 11. CSS Viewport (`CssViewer.tsx`)
- **Features**: Style rule tokenizer and color extractor.
- **Controls**:
  - Swatch row: Extracts all `#hex`, `rgb()`, `hsl()` colors into clickable swatches.
  - Rule selector filter.
  - Declaration copy: Click any property to copy declaration.

### 12. HTML Sandbox Viewport (`HtmlViewer.tsx`)
- **Features**: Isolated sandbox runner for interactive HTML components.
- **Controls**:
  - Responsive Viewport Switcher:
    - Desktop ($100\%$)
    - Laptop ($1024 \times 768$)
    - Tablet ($768 \times 1024$)
    - Mobile ($375 \times 812$)
  - "Replay / Reload" spring action.
  - "View Source" split drawer.
  - Safe sandboxed iframe attributes (`allow-scripts allow-forms`).

---

## 4. UI GSAP Guru Styling Standards

Adheres strictly to the project's **Industry Design Tokens**:
- **Backgrounds**: `--bg` (`#10161d`), `--surface` (`#182636`), `--well` (`#1d2d3d`).
- **Inks**: `--ink` (`#e9edf2`), `--ink-dim` (`rgba(233,237,242,.65)`), `--accent` (`#94bce3`), `--accent-soft` (`#b5d9fd`).
- **Typography**: Header and titles in `'Barlow Condensed', sans-serif`, labels and metrics in `ui-monospace, Menlo, monospace`.

### GSAP Motion Choreography Rules
1. **No Over-Animation**: Keep durations between $0.2s$ and $0.45s$. Use `power2.out` for snappy toolbars and `expo.out` for major panel slides.
2. **Spring Pulses on Action**: Buttons bounce slightly on click (`transform: translateY(1px)` with `box-shadow` depth drop).
3. **Staggered Controls Entrance**: When switching viewports, toolbar buttons cascade in smoothly (`stagger: 0.02s`, `y: 6 → 0`, `opacity: 0 → 1`).
4. **Subtle Micro-Interactions**: Hovering controls produces subtle border lighting (`borderColor: rgba(148,188,227,.4)`) rather than harsh color swaps.

---

## 5. Non-Destructive Integration Strategy

- **Zero Alterations to Current Views**: The existing 7 views (`grid`, `list`, `coverflow`, `strip`, `radial`, `filmstrip`, `peel`), toolbar controls, left rail, search, and SQLite backend remain completely untouched and functional.
- **Modular Component**: Implemented cleanly as an enhanced `PreviewDrawer` component that elevates the slide-out experience when an asset or zip entry is inspected.
