# SlopChords 2026 — Design Document

Webapp for laying out and adding chord labels and bar lines to lyric sheets.

-----

## Product Specification

### Two-panel layout

There is a lyrics field and a layout field of roughly the same size. The lyrics field shows the lyric text and is for input and editing. The layout field shows a preview and is for editing text and chord labels as well as layout. The fields interact.

### Input

Takes plaintext file/paste as input. Keeps line, paragraph and page breaks, strips all other formatting. Errors on non-text input. User can upload a file with a button, drag it into the lyrics field, or type or paste directly in the field. All characters, including `|` and hyphen, are shown literally in the lyrics field. Parsing into the layout view happens live (debounced on input).

### Export and persistence

The lyrics sheet can be exported as PDF or printed. It can be saved for later editing as a fully serialised JSON state file (includes chord labels and drag offsets). Saved files can be imported via the Open button or drag-drop.

### Tokens

Every word and break is turned into a token. Words are displayed in cells on a grid inside the layout field. The cells are transparent; the grid has a dotted background to help with alignment. This background is not exported or printed.

Above each word-cell is an empty semi-transparent chord-cell for the chord label. Chord labels are strings. Word-cells and their chord-cells stay together when moved.

Clicking a word in the layout field opens it for inline editing in place.

### Hyphen splitting

A word-cell can be split by inserting hyphens in the word. The split cell is divided into three cells: the string before the hyphen, the hyphen itself, and the string after. Splitting creates new chord-cells for each new word-cell.

Rules:

- A hyphen with whitespace on both sides is a separate word token
- A hyphen with whitespace on only one side does not split a word
- Adjacent hyphens (`--`) are never split

### Underscore

A word of a single underscore `_` is semi-transparent in the layout field and has a chord-cell as normal. The underscore is hidden (fully invisible) on export and print.

### Bar lines

User inserts `|` anywhere in a string to denote a bar-line. The character is not visible in layout; instead a muted thin vertical line is drawn behind the text layout.

### Chord cell editing

- Clicking an empty chord cell activates an inline input for that cell
- Enter or Tab moves focus to the next chord cell
- Shift+Tab moves to the previous chord cell
- Arrow keys navigate between cells (left/right across cells, up/down across lines)
- Trailing whitespace is trimmed when the cursor leaves a cell
- A “not-empty” chord cell is one that has a non-empty label after trimming

### Layout algorithm

A song is organised in lines, paragraphs and pages, denoted by breaks. A page is the size of a default 4:3 PowerPoint slide (960×720 pt). A double linebreak is a paragraph break. Manual page breaks can be inserted in the text (`\f`).

Lines inside a paragraph are aligned such that:

- Bar lines align across all lines in the paragraph
- Any text before the first bar line is flush right (right edge meets the bar)
- Text between bar lines is justified (words spread evenly across the gap)
- Text after the last bar line is flush left
- If there are no bar lines, the left edges of the first not-empty chord-cells align instead, and they act as bars for the alignment rules above
- A minimum of one space (character unit) is enforced between any two adjacent words

Paragraphs are aligned by their first bar. If no bars, use the left edge of the first not-empty chord-cell.

### Drag to reposition

A user may drag a word-cell, chord-cell, or bar line left and right inside the layout view. Dragging affects only the gaps between the dragged element and the nearest bar to its left. Gaps to the right are not affected. If there is a bar to the left, all gaps between that bar and the dragged element are adjusted proportionally. The minimum-space constraint still applies.

-----

## Architecture

```
src/
  tokeniser.js      plaintext → Token[]
  layout.js         Token[] → Page[] with computed x positions
  lyricsField.js    textarea logic: input, paste, drag-drop, file validation
  layoutField.js    canvas renderer, chord editing, drag interaction
  drag.js           applyDrag(): proportional offsetX redistribution
  persistence.js    serialise() / deserialise() for JSON save files
test/
  tokeniser.test.js
  layout.test.js
  lyricsField.test.js
  layoutField.test.js
  drag.test.js
  persistence.test.js
index.html          app shell, wires all modules together
```

### Data shapes

```
Token:           { type: 'word'|'barline'|'linebreak'|'parabreak'|'pagebreak',
                   text?: string, chord: string, offsetX: number }
PositionedToken: { ...Token, x: number }   // x in layout units
Line:            { tokens: PositionedToken[], startsNewPara?, startsNewPage? }
Paragraph:       { lines: Line[] }
Page:            { paragraphs: Paragraph[] }
Cell:            { kind: 'word'|'chord'|'bar', token, x, y, w, h,
                   pageIdx, paraIdx, lineIdx, tokIdx }   // x,y,w,h in canvas px
```

### Key constants (layoutField.js)

|Constant  |Value|Meaning                      |
|----------|-----|-----------------------------|
|`CH`      |14 px|Width of one layout-unit char|
|`WH`      |22 px|Word cell height             |
|`CCH`     |18 px|Chord cell height            |
|`LINE_GAP`|12 px|Vertical gap between lines   |
|`PARA_GAP`|28 px|Extra gap between paragraphs |
|`PAGE_W`  |960  |Page width (pt, 4:3 slide)   |
|`PAGE_H`  |720  |Page height (pt, 4:3 slide)  |

-----

## Phases

### Phase 1 — Tokeniser ✅

`src/tokeniser.js` — plaintext → Token[]. Handles words, bar lines, linebreaks, parabreaks, pagebreaks, hyphen splitting rules, underscore, input validation. 26 tests.

### Phase 2 — Layout engine ✅

`src/layout.js` — `buildLines`, `alignParagraph`, `layoutSong`. Computes x positions for all tokens. Implements flush-right/justified/flush-left zones, bar alignment across lines, fallback to chord-cell alignment, minimum-space enforcement. 19 tests.

### Phase 3 — Lyrics field ✅

`src/lyricsField.js` — `createLyricsField` (DOM-free, testable) + `mountLyricsField` (DOM wiring). Handles live debounced parsing, paste, file drag-drop, type validation, JSON save import, `setTokens`/`onTokens` asymmetry to prevent feedback loops. 12 tests.

### Phase 4 — Layout field renderer ✅

`src/layoutField.js` — Canvas renderer. Word cells (monospace, underscore at 25% opacity), chord cells (blue-tinted bg, bold label), bar lines (thin muted stroke), dotted alignment grid. Chord editing with overlay `<input>`, Tab/Enter/arrow navigation, blur-trims. Word inline editing. Hit-testing with chord-cell priority. 16 tests on pure geometry layer.

### Phase 5 — Drag interaction ✅

`src/drag.js` — `applyDrag(tokens, draggedIdx, deltaX, charWidth)`. Identifies left-bar boundary, distributes deltaX proportionally across gaps in the region, enforces minimum gap constraint. Wired into layoutField via mousedown/mousemove/mouseup. Re-runs layout engine on each drag tick. 7 tests.

### Phase 6 — Export and persistence ✅

`src/persistence.js` — `serialise` strips layout-computed `x` field, writes `__slopchords` marker and version. `deserialise` validates marker, fills defaults. Wired into toolbar Save button and file import. Print/PDF via `window.print()` with `@media print` CSS hiding the lyrics panel and grid. 8 tests.

**Total: 88 tests, all passing.**

-----

## Known Gaps and Future Work

### High priority

- **Paragraph-level bar alignment** — the spec requires aligning the first bar of each paragraph to a common column. Currently each paragraph aligns independently. Needs a second layout pass across paragraphs.
- **Underscore hidden on print** — semi-transparent in layout (✅) but the canvas draws it at 25% opacity even in print mode. Needs an `isPrinting` flag passed to `renderContent` to fully suppress it.
- **Grid dots on print** — drawn on the canvas, not controllable by `@media print`. Same `isPrinting` flag fix applies.

### Medium priority

- **Proportional font metrics** — layout engine uses character-count widths (`text.length`). For non-monospace export, swap `textWidth` for `ctx.measureText(text).width / CH` once the canvas font is set.
- **Drag circular dependency** — `layoutField.js` uses a dynamic `import('./layout.js')` inside the mousemove handler to avoid a circular dep. Should be resolved by passing a `relayout(tokens) → pages` callback into `mountLayoutField` at construction time.
- **Chord cell width on overflow** — if a chord label is longer than the word beneath it, the chord cell clips. Should expand the cell width and push neighbours.
- **Undo/redo** — no history. A simple command stack on `onTokensChange` would cover most editing needs.

### Low priority

- **Manual page break UI** — `\f` in the text works, but there is no button to insert a page break from the toolbar.
- **Touch / mobile drag** — drag uses mouse events only. `touchstart`/`touchmove`/`touchend` equivalents needed for tablet use.
- **Multiple bar-count mismatch** — lines with different numbers of bars in the same paragraph fall back gracefully but silently. A warning indicator would help.
- **Accessibility** — canvas is not keyboard-navigable for word cells. Chord cells have keyboard nav but no ARIA roles.