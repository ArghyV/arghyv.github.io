// layout.js
// Converts flat token[] → Page[] with x positions on every token.
//
// Data shapes:
//   Token (from tokeniser): { type, text?, chord, offsetX }
//   Line:                   { tokens: Token[], startsNewPara?, startsNewPage? }
//   PositionedToken:        { ...Token, x: number }
//   PositionedLine:         { tokens: PositionedToken[] }
//   Paragraph:              { lines: PositionedLine[] }
//   Page:                   { paragraphs: Paragraph[] }

const textWidth = t => (t.text ?? '').length   // character-unit width of a token

// ─── buildLines ──────────────────────────────────────────────────────────────
// Splits flat token[] on break tokens into Line[].
// Break tokens are consumed; their semantics become flags on the next line.

export function buildLines(tokens) {
  const lines = []
  let current = []
  let nextFlags = {}

  function flush() {
    if (current.length || lines.length > 0) {
      lines.push({ tokens: current, ...nextFlags })
      nextFlags = {}
      current = []
    }
  }

  for (const tok of tokens) {
    if (tok.type === 'linebreak') {
      flush()
    } else if (tok.type === 'parabreak') {
      flush()
      nextFlags.startsNewPara = true
    } else if (tok.type === 'pagebreak') {
      flush()
      nextFlags.startsNewPage = true
    } else {
      current.push(tok)
    }
  }
  flush()
  return lines
}

// ─── alignParagraph ───────────────────────────────────────────────────────────
// Takes Line[] (all belonging to one paragraph) and returns PositionedLine[].
// charWidth: width of one character (default 1; can be fractional for proportional fonts).
//
// Algorithm:
//   1. Find bar count per line. All lines must agree on structure for alignment;
//      we align by bar index (0-based). Mismatched lines get best-effort treatment.
//   2. Determine bar positions:
//      - For each bar slot, the bar x must be large enough to fit the widest
//        pre-bar content (flush-right) and the widest post-bar prefix.
//   3. Place tokens:
//      - Pre-first-bar: flush right (words packed right up to bar x)
//      - Between bars: justified
//      - Post-last-bar: flush left
//   4. Apply offsetX to each token's base x.

export function alignParagraph(lines, charWidth = 1) {
  // Decompose each line into segments separated by barlines.
  // segment: { words: Token[], barAfter: bool }
  // segments[0] = before first bar, segments[n] = after last bar, middle = between bars

  const decomposed = lines.map(line => decomposeLine(line.tokens))

  // Number of bars = number of barline tokens in a line.
  // Use max across lines as the canonical bar count.
  const barCounts = decomposed.map(d => d.bars.length)
  const maxBars = Math.max(...barCounts, 0)

  // Compute minimum width of each segment across all lines.
  // For a segment: minWidth = sum of word widths + (words-1) * 1 (min spaces)
  const segCount = maxBars + 1  // segments between/around bars

  const segMinWidths = Array.from({ length: segCount }, (_, si) =>
    Math.max(...decomposed.map(d => {
      const seg = d.segments[si] ?? []
      return segMinWidth(seg)
    }))
  )

  // Determine bar x positions.
  // bar[i] x = sum of segment[0..i] min widths + i+1 bar tokens (width 0 but need 1 space buffer)
  // We give 1-space padding before and after each bar.
  // barX[i]: x coordinate of bar i
  const barX = []
  let cursor = 0
  for (let i = 0; i < maxBars; i++) {
    cursor += segMinWidths[i] + 1  // seg content + 1 space before bar
    barX.push(cursor)
    cursor += 1  // 1 space after bar (bar itself has no width)
  }

  // Now position each line's tokens.
  return lines.map((line, li) => {
    const d = decomposed[li]
    const positioned = []

    for (let si = 0; si < d.segments.length; si++) {
      const seg = d.segments[si]
      const isFirst = si === 0
      const isLast = si === d.segments.length - 1 && maxBars > 0 ? si === maxBars : si === 0
      const isOnlySegment = maxBars === 0

      // Determine the x range for this segment.
      // leftBound: x after previous bar (or 0)
      // rightBound: x of next bar (or infinity for last segment)
      const leftBound = si === 0 ? 0 : barX[si - 1] + 1
      const rightBound = si < maxBars ? barX[si] : Infinity

      let tokenPositions
      if (isOnlySegment) {
        // No bars: align left edges of first not-empty chord-cell across lines.
        const offset = noBarChordOffset(decomposed, li)
        tokenPositions = placeFlushLeft(seg, leftBound + offset, charWidth)
      } else if (si === 0 && maxBars > 0) {
        // Pre-first-bar: flush right up to rightBound
        tokenPositions = placeFlushRight(seg, rightBound, charWidth)
      } else if (si === maxBars) {
        // Post-last-bar: flush left from leftBound
        tokenPositions = placeFlushLeft(seg, leftBound, charWidth)
      } else {
        // Between bars: justified
        tokenPositions = placeJustified(seg, leftBound, rightBound, charWidth)
      }

      positioned.push(...tokenPositions)

      // Add bar token if there is one after this segment
      if (si < d.bars.length) {
        const bar = d.bars[si]
        const bx = si < barX.length ? barX[si] : (rightBound === Infinity ? cursor : rightBound + 1)
        positioned.push({ ...bar, x: bx + bar.offsetX })
      }
    }

    return { ...line, tokens: positioned }
  })
}

// ─── layoutSong ──────────────────────────────────────────────────────────────
// Splits token[] into pages and paragraphs, aligns each paragraph.

export function layoutSong(tokens, charWidth = 1) {
  const lines = buildLines(tokens)

  // Split lines into pages and paragraphs
  const pages = []
  let currentPage = { paragraphs: [] }
  let currentParaLines = []

  function flushPara() {
    if (currentParaLines.length > 0) {
      const aligned = alignParagraph(currentParaLines, charWidth)
      currentPage.paragraphs.push({ lines: aligned })
      currentParaLines = []
    }
  }

  function flushPage() {
    flushPara()
    if (currentPage.paragraphs.length > 0) {
      pages.push(currentPage)
      alignPageParagraphs(currentPage)
    }
    currentPage = { paragraphs: [] }
  }

  for (const line of lines) {
    if (line.startsNewPage) {
      flushPage()
    } else if (line.startsNewPara) {
      flushPara()
    }
    currentParaLines.push(line)
  }

  flushPara()
  if (currentPage.paragraphs.length > 0) {
    pages.push(currentPage)
    alignPageParagraphs(currentPage)
  }

  if (pages.length === 0) pages.push({ paragraphs: [{ lines: [] }] })
  return pages
}

// Second pass: shift paragraphs on a page so their first bar (or first chorded word)
// aligns to the same x column across all paragraphs.
function alignPageParagraphs(page) {
  // Find first bar x of each paragraph (first barline token in first line).
  const firstBarXs = page.paragraphs.map(para => {
    for (const line of para.lines) {
      const bar = line.tokens.find(t => t.type === 'barline')
      if (bar) return bar.x
      // No bar: use first chorded word x
      const chorded = line.tokens.find(t => t.chord)
      if (chorded) return chorded.x
    }
    return 0
  })

  const maxFirstBarX = Math.max(...firstBarXs, 0)

  // Shift each paragraph's token x values by the difference.
  page.paragraphs.forEach((para, pi) => {
    const shift = maxFirstBarX - firstBarXs[pi]
    if (shift === 0) return
    para.lines.forEach(line => {
      line.tokens.forEach(tok => { tok.x += shift })
    })
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// For no-bar paragraphs: compute the x offset for line li so its first chorded word
// aligns with the first chorded word across all lines.
// Returns offset to add to leftBound (0 if no chords or already aligned).
function noBarChordOffset(decomposed, li) {
  // For each line, find width of tokens before the first chorded token (pre-chord width).
  // The anchor x = max pre-chord width across lines that have a chord.
  // Lines with no chord get offset=0 (flush left).
  const preChordWidths = decomposed.map(d => {
    const seg = d.segments[0] ?? []
    let w = 0
    for (const tok of seg) {
      if (tok.chord) return w  // found first chorded token; w = width before it
      w += textWidth(tok) + 1
    }
    return -1  // no chord on this line
  })

  const maxPreChord = Math.max(...preChordWidths.filter(w => w >= 0), 0)
  const myPreChord = preChordWidths[li]
  if (myPreChord < 0) return 0  // no chord on this line → flush left
  return maxPreChord - myPreChord
}


// segments[0] = tokens before first bar
// segments[1] = tokens between bar 0 and bar 1
// ...
// bars[i] = the i-th barline token
function decomposeLine(tokens) {
  const segments = [[]]
  const bars = []
  for (const tok of tokens) {
    if (tok.type === 'barline') {
      bars.push(tok)
      segments.push([])
    } else {
      segments[segments.length - 1].push(tok)
    }
  }
  return { segments, bars }
}

// Minimum width of a segment (sum of word widths + min 1-space gaps)
function segMinWidth(words) {
  if (!words.length) return 0
  return words.reduce((sum, w) => sum + textWidth(w), 0) + (words.length - 1)
}

// Place words flush left starting at x = leftBound
function placeFlushLeft(words, leftBound, charWidth) {
  const out = []
  let x = leftBound
  for (const w of words) {
    const base = x + w.offsetX
    out.push({ ...w, x: base })
    x += textWidth(w) + 1
  }
  return out
}

// Place words flush right so last word's right edge is at rightBound
function placeFlushRight(words, rightBound, charWidth) {
  if (!words.length) return []
  // Pack right-to-left
  const positions = []
  let x = rightBound
  for (let i = words.length - 1; i >= 0; i--) {
    const w = words[i]
    const wx = x - textWidth(w)
    positions[i] = wx
    x = wx - 1  // 1-space gap
  }
  return words.map((w, i) => ({ ...w, x: positions[i] + w.offsetX }))
}

// Place words justified between leftBound and rightBound.
// gap = (available - totalWidth) / (n-1); x[i] = leftBound + sum(widths[0..i-1]) + i*gap
function placeJustified(words, leftBound, rightBound, charWidth) {
  if (!words.length) return []
  if (words.length === 1) return placeFlushLeft(words, leftBound, charWidth)

  const totalWidth = words.reduce((s, w) => s + textWidth(w), 0)
  const available = rightBound - leftBound
  const gap = Math.max((available - totalWidth) / (words.length - 1), 1)

  let cumWidth = 0
  return words.map((w, i) => {
    const x = Math.round(leftBound + cumWidth + i * gap)
    cumWidth += textWidth(w)
    return { ...w, x: x + w.offsetX }
  })
}
