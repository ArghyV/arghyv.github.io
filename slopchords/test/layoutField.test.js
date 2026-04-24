import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  cellsFromPages,
  hitTest,
  nextChordCell,
  prevChordCell,
} from '../src/layoutField.js'

const ok = (v, m) => assert.ok(v, m)
const is = (a, b) => assert.equal(a, b)
const eq = (a, b) => assert.deepEqual(a, b)

// ── Geometry constants (must match layoutField.js) ──────────────────────────
const CH   = 14   // char width px
const WH   = 22   // word cell height px
const CCH  = 18   // chord cell height px
const MGAP = 4    // min gap between word cells px

// Helper: build a minimal PositionedLine
const tok = (type, text, x, chord='') => ({ type, text, chord, offsetX: 0, x })
const word = (text, x, chord='') => tok('word', text, x, chord)
const bar  = (x) => tok('barline', undefined, x)

// cellsFromPages(pages) → Cell[]
// Cell: { kind:'word'|'chord'|'bar', token, x, y, w, h, lineIdx, tokIdx, pageIdx, paraIdx }
// x,y,w,h in canvas pixels

describe('cellsFromPages — word cells', () => {
  const pages = [{
    paragraphs: [{
      lines: [{
        tokens: [ word('hello', 0), word('world', 6) ]
      }]
    }]
  }]

  it('produces a word cell for each word token', () => {
    const cells = cellsFromPages(pages)
    const words = cells.filter(c => c.kind === 'word')
    is(words.length, 2)
  })

  it('word cell x = token.x * CH + margin', () => {
    const cells = cellsFromPages(pages)
    const w0 = cells.find(c => c.kind === 'word' && c.token.text === 'hello')
    ok(w0.x >= 0)
    is(w0.x, 0 * CH)  // x=0 in layout units → 0 * CH px
  })

  it('word cell width = text.length * CH', () => {
    const cells = cellsFromPages(pages)
    const w0 = cells.find(c => c.kind === 'word' && c.token.text === 'hello')
    is(w0.w, 'hello'.length * CH)
  })

  it('word cell height = WH', () => {
    const cells = cellsFromPages(pages)
    cells.filter(c => c.kind === 'word').forEach(c => is(c.h, WH))
  })
})

describe('cellsFromPages — chord cells', () => {
  const pages = [{
    paragraphs: [{
      lines: [{ tokens: [ word('hello', 0, 'Am'), word('world', 6) ] }]
    }]
  }]

  it('produces a chord cell above every word cell', () => {
    const cells = cellsFromPages(pages)
    const chords = cells.filter(c => c.kind === 'chord')
    is(chords.length, 2)
  })

  it('chord cell shares x and w with its word cell', () => {
    const cells = cellsFromPages(pages)
    const wc = cells.find(c => c.kind === 'word' && c.token.text === 'hello')
    const cc = cells.find(c => c.kind === 'chord' && c.token.text === 'hello')
    is(cc.x, wc.x)
    is(cc.w, wc.w)
  })

  it('chord cell is above word cell: cc.y + cc.h === wc.y', () => {
    const cells = cellsFromPages(pages)
    const wc = cells.find(c => c.kind === 'word' && c.token.text === 'hello')
    const cc = cells.find(c => c.kind === 'chord' && c.token.text === 'hello')
    is(cc.y + cc.h, wc.y)
  })
})

describe('cellsFromPages — barline cells', () => {
  const pages = [{
    paragraphs: [{
      lines: [{ tokens: [ word('a', 0), bar(2), word('b', 3) ] }]
    }]
  }]

  it('produces a bar cell for each barline token', () => {
    const cells = cellsFromPages(pages)
    is(cells.filter(c => c.kind === 'bar').length, 1)
  })

  it('bar cell x = token.x * CH', () => {
    const cells = cellsFromPages(pages)
    const bc = cells.find(c => c.kind === 'bar')
    is(bc.x, 2 * CH)
  })
})

describe('hitTest', () => {
  const pages = [{
    paragraphs: [{
      lines: [{ tokens: [ word('hello', 0), word('world', 6) ] }]
    }]
  }]
  const cells = cellsFromPages(pages)

  it('returns cell when point is inside', () => {
    const wc = cells.find(c => c.kind === 'word' && c.token.text === 'hello')
    const hit = hitTest(cells, wc.x + 2, wc.y + 2)
    ok(hit !== null)
    is(hit.token.text, 'hello')
  })

  it('returns null when point is outside all cells', () => {
    const hit = hitTest(cells, 9999, 9999)
    is(hit, null)
  })

  it('chord cell takes priority over word cell at same column', () => {
    const cc = cells.find(c => c.kind === 'chord' && c.token.text === 'hello')
    const hit = hitTest(cells, cc.x + 2, cc.y + 2)
    is(hit.kind, 'chord')
  })
})

describe('chord cell navigation', () => {
  const pages = [{
    paragraphs: [{
      lines: [{ tokens: [ word('a',0), word('b',2), word('c',4) ] }]
    }]
  }]
  const cells = cellsFromPages(pages).filter(c => c.kind === 'chord')

  it('nextChordCell returns the chord cell to the right', () => {
    const first = cells[0]
    const next = nextChordCell(cells, first)
    is(next.token.text, 'b')
  })

  it('nextChordCell wraps to first at end', () => {
    const last = cells[cells.length - 1]
    const next = nextChordCell(cells, last)
    is(next.token.text, 'a')
  })

  it('prevChordCell returns the chord cell to the left', () => {
    const second = cells[1]
    const prev = prevChordCell(cells, second)
    is(prev.token.text, 'a')
  })

  it('prevChordCell wraps to last at start', () => {
    const first = cells[0]
    const prev = prevChordCell(cells, first)
    is(prev.token.text, 'c')
  })
})
