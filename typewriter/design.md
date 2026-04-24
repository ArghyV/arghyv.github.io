# type(rä)writer — Design Document

A webapp simulating an electric typewriter. Not a word processor.
Use cases: filling non-form-fillable PDFs, writing letters, adding text to images.

---

## Core Principles

- Typed text is **pixels, not strings**. Every keypress rasterizes a glyph onto a canvas. No text nodes, no undo history, no spell check.
- Being annoying to use is a feature, not a bug.
- Two canvas layers per page: background (imported image/PDF or paper-white) and edit (typed glyphs, corrections).

---

## UI

- Page in portrait orientation, centered in window. Default: top edge at 2/3 window height.
- Ruler along top and left edges of window. Clicking top ruler sets margin stops and tab stops.
- Rectangular cursor at fixed viewport height; paper scrolls up/down beneath it.
- Toolbar: New · Import · Export · Print · Add Page · Delete Page · Correction Tool

---

## Paper Sizes

Supported range: B4 (largest) → A6 (smallest), plus US sizes.
Full list: B4, Letter, Legal, A4, A5, Half Letter, A6.

Imported files:
- Within supported range → edit 1:1, no scaling.
- Outside range → scale to fit nearest boundary (B4 or A6). Warning shown.
- Landscape → rotate 90° to portrait for editing, rotate back on export.
- New pages added after an imported page inherit the edit-canvas size; scaled back on export.

---

## Fonts (open-source clones)

| Label | Font | Clone of |
|---|---|---|
| Prestige Elite | Courier Prime | Prestige Elite |
| Letter Gothic | Anonymous Pro | Letter Gothic |
| Univers | Tex Gyre Heros | Univers |
| Bembo | EB Garamond | Bembo |

Sizes: 10pt (Small), 12pt (Large).

---

## Keyboard Behaviour

- Letter/number/symbol keys: stamp glyph at cursor, advance cursor one cell.
- Arrow left/right: move cursor horizontally.
- Arrow up/down: scroll paper vertically. Cursor height is fixed.
- Enter: scroll paper up one line (carriage return).
- Backspace: move cursor left (no erase — typewriter behaviour).
- Tab: advance cursor to next tab stop. If no tab stop ahead, advance to right margin.
- Dead keys (diacritics ` ´ ^ ~ ¨): stamp glyph immediately, do not advance cursor.
- Shift / AltGr / CapsLock: standard OS behaviour.
- Ctrl+T: add page. Ctrl+W: delete page.

Off-paper: cursor moves but nothing is drawn.
Partially on paper: glyph is clipped to page bounds.

---

## Margin Stops

- Click top ruler to place left or right margin stop (nearest to click determines which).
- Cursor is constrained within margins.
- If a new margin stop would push cursor outside, cursor is moved inside.
- Margin stops shown as amber lines on ruler.

---

## Tab Stops

- Click top ruler in the page area to toggle a tab stop at that x position.
- If a margin stop already exists at that position, tab stop takes precedence visually.
- Tab stops shown as small amber triangles on ruler.
- Tab key moves cursor to next tab stop to the right. If none, moves to right margin.
- Tab stops are per-document (not per-page).

---

## Correction Tool

Replaces pointer with a brush the size of the text cursor.

| Modifier | Colour | Effect |
|---|---|---|
| (none) | Paper-white | Erase typed text |
| Shift | Semi-transparent yellow | Highlight |
| Ctrl | Opaque black | Ink over |

Brush paints on the edit canvas layer. Click and drag to paint.

---

## Layers & Export

- Background layer: imported image/PDF page or paper-white fill.
- Edit layer: all typed glyphs and correction paint.
- Export flattens both layers.

Export formats:
- **PDF**: all pages in one file (Phase 3, requires jsPDF or canvas-to-PDF).
- **JPEG**: one file per page. Numbered if >1 page.
- **GIF**: one file per page. Numbered if >1 page. (Phase 3, proper GIF encoding.)

Print: opens a print window with all pages as flattened images.

---

## Architecture

- Vanilla JS + Canvas API. No framework.
- ES modules throughout.
- `OffscreenCanvas` for glyph stamping and layer flattening.
- pdf.js for PDF import (Phase 3).
- jsPDF for PDF export (Phase 3).
- Tests: custom zero-dep runner (`tests/runner.mjs`). Mock `OffscreenCanvas` for Node.

### Modules

| File | Responsibility |
|---|---|
| `src/paperSizes.mjs` | Size table, mm↔px, import scaling/rotation logic |
| `src/cursorState.mjs` | Cursor + paper scroll state machine (pure functions) |
| `src/pageModel.mjs` | Page stack: create, add, delete, layout computation |
| `src/glyphPipeline.mjs` | Glyph stamp, correction paint, layer flatten |
| `src/tabStops.mjs` | Tab stop list, toggle, next-stop lookup |
| `src/index.html` | Application shell, event wiring, render loop |

---

## Phases

### ✅ Phase 0 — Spike & Setup
- Paper size table + scaling logic
- Cursor state machine (pure functions)
- Zero-dep test runner
- All state tested in Node (no browser required)

### ✅ Phase 1 — Core Rendering (MVP)
- Dual-canvas page model (bg + edit)
- Glyph stamp pipeline (keypress → OffscreenCanvas → composite)
- Cursor: viewport-fixed height, horizontal movement, scroll bounds
- New file dialog (filename, size, font, font size)
- Toolbar UI (all buttons wired or stubbed)
- Image import with scale/rotation detection + warning modal
- Correction tool (erase / highlight / ink)
- Add/delete pages (Ctrl+T / Ctrl+W)
- Margin stops via ruler click
- JPG/GIF export (GIF as PNG placeholder), print

### 🔲 Phase 2 — Tab Stops
- `src/tabStops.mjs`: sorted list, toggle on click, next-stop lookup
- Click top ruler: if near existing tab stop → remove it; otherwise → add it
- Tab key: advance to next stop or right margin
- Render tab stop markers (amber triangles) on top ruler
- Tests: toggle, dedup, next-stop with/without stops, at margin edge

### 🔲 Phase 3 — Multi-page Polish
- Visual gap between pages in viewport
- Page number badge on each page wrapper
- Cursor x preserved across page scrolls
- Viewport scale-down when page wider than window (CSS transform)
- Window resize: reflow layouts, preserve scroll offset

### 🔲 Phase 4 — Import/Export Complete
- PDF import via pdf.js (each page → background canvas)
- Proper PDF export via jsPDF (all pages, correct paper size)
- GIF export (use gif.js or Canvas2GIF)
- Export scale-back: if imported page was scaled, export at original resolution
- Export rotation: landscape pages rotated back on export

### 🔲 Phase 5 — Input Edge Cases
- Dead key / diacritic handling via `compositionend`
- AltGr / composed characters
- CapsLock passthrough
- Partial-on-paper clipping (already stubbed, needs edge-case tests)
- Off-paper cursor movement without drawing
