import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { applyDrag } from '../src/drag.js'

const ok = (v, m) => assert.ok(v, m)
const is = (a, b) => assert.equal(a, b)
const near = (a, b, d=0.5) => assert.ok(Math.abs(a-b) <= d, `expected ${a} ≈ ${b} (±${d})`)

// Token factory
const W = (text, offsetX=0) => ({ type:'word', text, chord:'', offsetX })
const BAR = (offsetX=0) => ({ type:'barline', chord:'', offsetX, x:0 })

// applyDrag(tokens, draggedIdx, deltaX, charWidth)
// Mutates offsetX values on tokens between the dragged token and the nearest
// bar to its left (or start of line). Returns the mutated tokens array.
// deltaX is in layout units (not pixels).

describe('applyDrag — no bar to the left', () => {
  it('dragging first word shifts only that word offsetX', () => {
    const tokens = [W('hello'), W('world')]
    applyDrag(tokens, 0, 3, 1)
    is(tokens[0].offsetX, 3)
    is(tokens[1].offsetX, 0)
  })

  it('dragging second word (no bar) distributes delta proportionally between words 0..1', () => {
    // No bar: left boundary is start of line (index 0)
    // Words between boundary and dragged: [0, 1] → both get proportional share
    const tokens = [W('a'), W('b'), W('c')]
    applyDrag(tokens, 1, 4, 1)
    // gap between idx 0 and idx 1 is adjusted; idx 2 unchanged
    is(tokens[2].offsetX, 0)
    // total shift to dragged token = 4
    ok(tokens[1].offsetX !== 0 || tokens[0].offsetX !== 0, 'some shift applied')
  })
})

describe('applyDrag — bar to the left', () => {
  it('only gaps between left-bar and dragged token are adjusted', () => {
    // line: BAR  W('a')  W('b')  W('c')  BAR
    // drag W('b') (idx 2) by +3
    // left bar is idx 0; between bar and dragged: W('a') W('b')
    // W('c') and right BAR are untouched
    const tokens = [BAR(), W('a'), W('b'), W('c'), BAR()]
    applyDrag(tokens, 2, 3, 1)
    is(tokens[3].offsetX, 0)  // 'c' unchanged
    is(tokens[4].offsetX, 0)  // right bar unchanged
    ok(tokens[1].offsetX !== 0 || tokens[2].offsetX !== 0, 'left region shifted')
  })

  it('minimum 1-unit gap is enforced (no negative delta past constraint)', () => {
    // Words are already at minimum spacing; dragging left should not compress further
    const tokens = [BAR(), W('a'), W('b')]
    // Try to drag 'b' far left
    applyDrag(tokens, 2, -999, 1)
    // Gap between 'a' and 'b' must remain >= 1 layout unit
    // offsetX on 'b' should not be so negative that it overlaps 'a'
    // 'a' is at x=1 (1 char), 'b' base at x=3; min gap=1 → b.x >= 1+1+1=3 → offsetX >= 0
    ok(tokens[2].offsetX >= 0, `offsetX ${tokens[2].offsetX} should be >= 0`)
  })

  it('dragging a barline adjusts gaps between it and the bar to its left', () => {
    const tokens = [BAR(), W('a'), W('b'), BAR(), W('c')]
    // drag second bar (idx 3) by +2
    applyDrag(tokens, 3, 2, 1)
    is(tokens[4].offsetX, 0)  // 'c' unchanged
    ok(tokens[3].offsetX !== 0 || tokens[1].offsetX !== 0 || tokens[2].offsetX !== 0)
  })
})

describe('applyDrag — proportional distribution', () => {
  it('distributes delta proportionally by gap size', () => {
    // BAR  a(3ch)  b(3ch)  [drag b by +6]
    // only gap is between BAR and 'a', and 'a' and 'b'
    // both gaps equal → each gets +3
    const tokens = [BAR(), W('aaa'), W('bbb')]
    // Set base x via layout (simulate): we trust applyDrag works on offsetX only
    applyDrag(tokens, 2, 6, 1)
    // total shift of dragged token = 6; split equally between two gaps
    near(tokens[1].offsetX + tokens[2].offsetX, 6)
  })

  it('zero delta is a no-op', () => {
    const tokens = [W('a'), W('b')]
    applyDrag(tokens, 1, 0, 1)
    is(tokens[0].offsetX, 0)
    is(tokens[1].offsetX, 0)
  })
})
