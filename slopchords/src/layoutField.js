import { applyDrag } from './drag.js'
// layoutField.js
// Canvas renderer + interaction for the layout field.
//
// Exports (pure, testable):
//   cellsFromPages(pages) → Cell[]
//   hitTest(cells, px, py) → Cell | null
//   nextChordCell(chordCells, current) → Cell
//   prevChordCell(chordCells, current) → Cell
//
// Exports (DOM):
//   mountLayoutField(canvas, { onTokensChange }) → { setPages(pages, tokens) }

// ── Geometry constants ────────────────────────────────────────────────────────
export const CH   = 14    // px per layout-unit character
export const WH   = 22    // word cell height px
export const CCH  = 18    // chord cell height px
export const LINE_GAP = 12 // px between chord-top of one line and word-bottom of previous
export const PARA_GAP = 28 // extra px between paragraphs
export const PAGE_W = 960  // canonical page width pt (4:3 PowerPoint)
export const PAGE_H = 720
export const MARGIN_X = 32
export const MARGIN_Y = 36

// ── cellsFromPages ────────────────────────────────────────────────────────────
// Converts Page[] (from layout engine) to Cell[] in canvas pixel coordinates.
// Cell: { kind, token, x, y, w, h, pageIdx, paraIdx, lineIdx, tokIdx }

export function cellsFromPages(pages) {
  const cells = []
  let pageOffsetY = 0

  pages.forEach((page, pageIdx) => {
    let cursorY = pageOffsetY + MARGIN_Y
    page.paragraphs.forEach((para, paraIdx) => {
      if (paraIdx > 0) cursorY += PARA_GAP

      para.lines.forEach((line, lineIdx) => {
        // Each line occupies: CCH (chord row) + WH (word row)
        const wordY = cursorY + CCH
        const chordY = cursorY

        line.tokens.forEach((tok, tokIdx) => {
          const px = tok.x * CH

          if (tok.type === 'word') {
            const w = tok.text.length * CH

            // Chord cell (above)
            cells.push({
              kind: 'chord', token: tok,
              x: px, y: chordY, w, h: CCH,
              pageIdx, paraIdx, lineIdx, tokIdx,
            })
            // Word cell
            cells.push({
              kind: 'word', token: tok,
              x: px, y: wordY, w, h: WH,
              pageIdx, paraIdx, lineIdx, tokIdx,
            })
          } else if (tok.type === 'barline') {
            cells.push({
              kind: 'bar', token: tok,
              x: px, y: chordY, w: 2, h: CCH + WH,
              pageIdx, paraIdx, lineIdx, tokIdx,
            })
          }
        })

        cursorY += CCH + WH + LINE_GAP
      })
    })

    pageOffsetY += PAGE_H
  })

  return cells
}

// ── hitTest ───────────────────────────────────────────────────────────────────
// Returns the topmost cell containing (px, py), chord cells take priority.

export function hitTest(cells, px, py) {
  // Check chord cells first (they overlap word cells vertically in some layouts)
  for (const c of cells) {
    if (c.kind === 'chord' && contains(c, px, py)) return c
  }
  for (const c of cells) {
    if (c.kind !== 'chord' && contains(c, px, py)) return c
  }
  return null
}

function contains(c, px, py) {
  return px >= c.x && px < c.x + c.w && py >= c.y && py < c.y + c.h
}

// ── Chord cell navigation ─────────────────────────────────────────────────────

export function nextChordCell(chordCells, current) {
  const i = chordCells.indexOf(current)
  return chordCells[(i + 1) % chordCells.length]
}

export function prevChordCell(chordCells, current) {
  const i = chordCells.indexOf(current)
  return chordCells[(i - 1 + chordCells.length) % chordCells.length]
}

// ── mountLayoutField ──────────────────────────────────────────────────────────
// DOM entry point. Returns { setPages(pages, tokens) }.

export function mountLayoutField(canvas, { onTokensChange }) {
  const ctx = canvas.getContext('2d')
  let _cells = []
  let _tokens = []        // flat mutable token array (shared ref from app)
  let _pages = []
  let _activeChord = null // currently editing chord cell
  let _chordInput = null  // overlay <input> element

  // ── setPages ────────────────────────────────────────────────────────────────
  function setPages(pages, tokens) {
    _pages = pages
    _tokens = tokens
    _cells = cellsFromPages(pages)
    render()
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  function render() {
    const panel = canvas.parentElement
    const availW = panel.clientWidth - 4
    const scale = availW / PAGE_W
    const totalH = PAGE_H * _pages.length * scale

    canvas.width  = availW
    canvas.height = Math.max(totalH, panel.clientHeight - 30)
    canvas.style.width  = availW + 'px'
    canvas.style.height = canvas.height + 'px'

    ctx.save()
    ctx.translate(MARGIN_X, 0)
    ctx.scale(scale, scale)
    renderContent(scale)
    ctx.restore()
  }

  function renderContent(scale) {
    const totalH = PAGE_H * _pages.length

    // White page background
    _pages.forEach((_, i) => {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, i * PAGE_H, PAGE_W, PAGE_H)
    })

    // Dotted alignment grid (not printed)
    drawGrid()

    // Render each cell
    for (const cell of _cells) {
      if (cell.kind === 'word')  drawWordCell(cell)
      if (cell.kind === 'chord') drawChordCell(cell)
      if (cell.kind === 'bar')   drawBarCell(cell)
    }

    // Active chord input highlight
    if (_activeChord) {
      ctx.strokeStyle = 'rgba(106,159,181,0.9)'
      ctx.lineWidth = 1.5
      ctx.strokeRect(_activeChord.x, _activeChord.y, _activeChord.w, _activeChord.h)
    }
  }

  function drawGrid() {
    ctx.save()
    ctx.strokeStyle = 'rgba(0,0,0,0.06)'
    ctx.lineWidth = 0.5
    ctx.setLineDash([1, 9])
    const gs = 8
    for (let x = 0; x < PAGE_W * _pages.length; x += gs) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, PAGE_H * _pages.length); ctx.stroke()
    }
    for (let y = 0; y < PAGE_H * _pages.length; y += gs) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(PAGE_W, y); ctx.stroke()
    }
    ctx.setLineDash([])
    ctx.restore()
  }

  function drawWordCell(cell) {
    const { token, x, y, w, h } = cell
    const isUnderscore = token.text === '_'

    ctx.save()
    if (isUnderscore) ctx.globalAlpha = 0.25

    // Transparent cell background (just for hit area, no fill)
    // Draw text
    ctx.fillStyle = '#1a1a1a'
    ctx.font = `${WH * 0.72}px "Courier New", monospace`
    ctx.textBaseline = 'middle'
    ctx.fillText(token.text, x, y + h / 2)
    ctx.restore()
  }

  function drawChordCell(cell) {
    const { token, x, y, w, h } = cell

    // Semi-transparent chord cell background
    ctx.save()
    ctx.fillStyle = 'rgba(106,159,181,0.08)'
    ctx.fillRect(x, y, w, h)

    if (token.chord) {
      ctx.fillStyle = 'rgba(60,100,140,0.9)'
      ctx.font = `bold ${CCH * 0.72}px "Courier New", monospace`
      ctx.textBaseline = 'middle'
      ctx.fillText(token.chord, x + 1, y + h / 2)
    }
    ctx.restore()
  }

  function drawBarCell(cell) {
    const { x, y, h } = cell
    ctx.save()
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'
    ctx.lineWidth = 1
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x, y + h)
    ctx.stroke()
    ctx.restore()
  }

  // ── Chord editing ────────────────────────────────────────────────────────────
  function openChordInput(cell) {
    closeChordInput()
    _activeChord = cell

    const panel = canvas.parentElement
    const scale = canvas.width / PAGE_W
    const rect = canvas.getBoundingClientRect()
    const panelRect = panel.getBoundingClientRect()

    const inputX = rect.left - panelRect.left + cell.x * scale
    const inputY = rect.top  - panelRect.top  + cell.y * scale

    const inp = document.createElement('input')
    inp.type = 'text'
    inp.value = cell.token.chord || ''
    inp.style.cssText = `
      position: absolute;
      left: ${inputX}px; top: ${inputY}px;
      width: ${Math.max(cell.w * scale, 40)}px;
      height: ${cell.h * scale}px;
      font: bold ${Math.round(CCH * 0.72 * scale)}px "Courier New", monospace;
      color: rgb(60,100,140);
      background: rgba(240,248,255,0.95);
      border: none; outline: none; padding: 0 2px;
      box-sizing: border-box; z-index: 10;
    `
    panel.style.position = 'relative'
    panel.appendChild(inp)
    inp.focus()
    inp.select()
    _chordInput = inp

    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        commitChord(inp.value)
        const chordCells = _cells.filter(c => c.kind === 'chord')
        const next = e.shiftKey && e.key === 'Tab'
          ? prevChordCell(chordCells, _activeChord)
          : nextChordCell(chordCells, _activeChord)
        openChordInput(next)
      } else if (e.key === 'Escape') {
        closeChordInput()
      } else if (e.key === 'ArrowRight') {
        const chordCells = _cells.filter(c => c.kind === 'chord')
        commitChord(inp.value)
        openChordInput(nextChordCell(chordCells, _activeChord))
        e.preventDefault()
      } else if (e.key === 'ArrowLeft') {
        const chordCells = _cells.filter(c => c.kind === 'chord')
        commitChord(inp.value)
        openChordInput(prevChordCell(chordCells, _activeChord))
        e.preventDefault()
      } else if (e.key === 'ArrowDown') {
        const chordCells = _cells.filter(c => c.kind === 'chord')
        // Move to chord cell on next line at same or nearest token position
        commitChord(inp.value)
        const nextLine = adjacentLineChord(chordCells, _activeChord, 1)
        if (nextLine) openChordInput(nextLine)
        e.preventDefault()
      } else if (e.key === 'ArrowUp') {
        const chordCells = _cells.filter(c => c.kind === 'chord')
        commitChord(inp.value)
        const prevLine = adjacentLineChord(chordCells, _activeChord, -1)
        if (prevLine) openChordInput(prevLine)
        e.preventDefault()
      }
    })

    inp.addEventListener('blur', () => {
      // Small delay: blur fires before click on another cell
      setTimeout(() => {
        if (_chordInput === inp) commitChord(inp.value, true)
      }, 80)
    })

    render()
  }

  function commitChord(raw, close = false) {
    const trimmed = raw.trim()
    if (_activeChord) {
      _activeChord.token.chord = trimmed
      onTokensChange(_tokens)
    }
    if (close) closeChordInput()
  }

  function closeChordInput() {
    if (_chordInput) { _chordInput.remove(); _chordInput = null }
    _activeChord = null
    render()
  }

  // Find nearest chord cell on an adjacent line (delta = +1 or -1)
  function adjacentLineChord(chordCells, current, delta) {
    const targetLine = current.lineIdx + delta
    const candidates = chordCells.filter(c =>
      c.pageIdx === current.pageIdx &&
      c.paraIdx === current.paraIdx &&
      c.lineIdx === targetLine
    )
    if (!candidates.length) return null
    // Pick closest by x
    return candidates.reduce((best, c) =>
      Math.abs(c.x - current.x) < Math.abs(best.x - current.x) ? c : best
    )
  }

  // ── Word inline editing ──────────────────────────────────────────────────────
  function openWordEdit(cell) {
    const panel = canvas.parentElement
    const scale = canvas.width / PAGE_W
    const rect = canvas.getBoundingClientRect()
    const panelRect = panel.getBoundingClientRect()

    const inp = document.createElement('input')
    inp.type = 'text'
    inp.value = cell.token.text
    const inputX = rect.left - panelRect.left + cell.x * scale
    const inputY = rect.top  - panelRect.top  + cell.y * scale
    inp.style.cssText = `
      position: absolute;
      left: ${inputX}px; top: ${inputY}px;
      width: ${Math.max(cell.w * scale, 60)}px;
      height: ${cell.h * scale}px;
      font: ${Math.round(WH * 0.72 * scale)}px "Courier New", monospace;
      color: #1a1a1a; background: rgba(255,255,240,0.97);
      border: none; outline: none; padding: 0 2px; box-sizing: border-box; z-index: 10;
    `
    panel.style.position = 'relative'
    panel.appendChild(inp)
    inp.focus(); inp.select()

    function commit() {
      const newText = inp.value.trim() || cell.token.text
      cell.token.text = newText
      inp.remove()
      onTokensChange(_tokens)
      render()
    }
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === 'Escape') commit()
    })
    inp.addEventListener('blur', commit)
  }

  // ── Canvas mouse events ──────────────────────────────────────────────────────
  canvas.addEventListener('click', e => {
    const scale = canvas.width / PAGE_W
    const r = canvas.getBoundingClientRect()
    const px = (e.clientX - r.left) / scale
    const py = (e.clientY - r.top)  / scale

    const hit = hitTest(_cells, px, py)
    if (!hit) { closeChordInput(); return }
    if (hit.kind === 'chord') openChordInput(hit)
    if (hit.kind === 'word')  openWordEdit(hit)
  })

  // Close chord input on outside click
  canvas.addEventListener('mousedown', e => {
    if (_chordInput && e.target !== _chordInput) {
      if (_activeChord) commitChord(_chordInput.value, true)
    }
  })

  // ── Drag interaction ────────────────────────────────────────────────────────
  let _drag = null  // { cell, startPx, lastDeltaUnits }

  canvas.addEventListener('mousedown', e => {
    if (e.button !== 0) return
    const scale = canvas.width / PAGE_W
    const r = canvas.getBoundingClientRect()
    const px = (e.clientX - r.left) / scale
    const py = (e.clientY - r.top)  / scale
    const hit = hitTest(_cells, px, py)
    if (!hit || hit.kind === 'chord') return
    if (hit.kind === 'word' || hit.kind === 'bar') {
      _drag = { cell: hit, startPx: e.clientX, lastDeltaUnits: 0 }
      e.preventDefault()
    }
  })

  window.addEventListener('mousemove', e => {
    if (!_drag) return
    const scale = canvas.width / PAGE_W
    const deltaPx = e.clientX - _drag.startPx
    const deltaUnits = deltaPx / (scale * CH)
    const stepDelta = deltaUnits - _drag.lastDeltaUnits
    if (Math.abs(stepDelta) < 0.1) return  // sub-threshold, skip

    // Find token index in flat _tokens array
    const tok = _drag.cell.token
    const idx = _tokens.indexOf(tok)
    if (idx === -1) return

    applyDrag(_tokens, idx, stepDelta, 1)
    _drag.lastDeltaUnits = deltaUnits

    // Re-run layout and re-render
    import('./layout.js').then(({ layoutSong }) => {
      const pages = layoutSong(_tokens)
      setPages(pages, _tokens)
      onTokensChange(_tokens)
    })
  })

  window.addEventListener('mouseup', () => { _drag = null })


  return { setPages }
}

// ── Drag wiring (appended) ────────────────────────────────────────────────────
// mountLayoutField already exports setPages. We patch in drag after the fact
// by re-exporting a drag-aware version via mountLayoutFieldWithDrag.
// index.html uses mountLayoutField directly; drag is wired inside it below.
