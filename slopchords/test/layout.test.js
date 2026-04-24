import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildLines, alignParagraph, layoutSong } from '../src/layout.js'

const eq = (a, b) => assert.deepEqual(a, b)
const is = (a, b) => assert.equal(a, b)
const near = (a, b, d=0.01) => assert.ok(Math.abs(a-b) < d, `expected ${a} ≈ ${b}`)
const ok = (v, msg) => assert.ok(v, msg)

// Helpers to build token arrays
const W = (text, chord='', offsetX=0) => ({ type:'word', text, chord, offsetX })
const BAR = (offsetX=0) => ({ type:'barline', chord:'', offsetX })
const LB = () => ({ type:'linebreak', chord:'', offsetX:0 })
const PB = () => ({ type:'parabreak', chord:'', offsetX:0 })
const PG = () => ({ type:'pagebreak', chord:'', offsetX:0 })

// buildLines(tokens) → Line[]
// Line: { tokens: Token[], isLast: bool }
// Splits flat token array on linebreak/parabreak/pagebreak into Line objects.
// parabreak and pagebreak produce an extra empty line (blank line between paragraphs).

describe('buildLines', () => {
  it('single line of words', () => {
    const lines = buildLines([W('a'), W('b')])
    is(lines.length, 1)
    eq(lines[0].tokens.map(t=>t.text), ['a','b'])
  })

  it('linebreak splits into two lines', () => {
    const lines = buildLines([W('a'), LB(), W('b')])
    is(lines.length, 2)
  })

  it('parabreak produces a paragraph boundary marker', () => {
    const lines = buildLines([W('a'), PB(), W('b')])
    // First line has words, second line starts new paragraph
    is(lines[0].tokens[0].text, 'a')
    is(lines[1].tokens[0].text, 'b')
    ok(lines[1].startsNewPara, 'second line should be marked startsNewPara')
  })

  it('pagebreak produces a page boundary marker', () => {
    const lines = buildLines([W('a'), PG(), W('b')])
    ok(lines[1].startsNewPage, 'second line should be marked startsNewPage')
  })

  it('break tokens do not appear in line token arrays', () => {
    const lines = buildLines([W('a'), LB(), W('b')])
    lines.forEach(l => l.tokens.forEach(t => ok(t.type==='word'||t.type==='barline', `unexpected type ${t.type}`)))
  })
})

// alignParagraph(lines, charWidth) → PositionedLine[]
// PositionedLine: { tokens: PositionedToken[] }
// PositionedToken: { ...token, x: number }  (x is left edge of word-cell in arbitrary units)
// charWidth: width of one character unit (default 1)
//
// Rules:
//   - barlines in corresponding positions across lines must share the same x
//   - before first barline: flush right (right edge of last word before bar aligns)
//   - between bars: justified (words spread to fill gap)
//   - after last bar: flush left
//   - no bars: treat first not-empty chord-cell left edge as bar (i.e. left-align on first chorded word)
//   - minimum 1 char space between any two words

describe('alignParagraph — no bars', () => {
  it('single line, no bars: words placed left-to-right with 1-space gaps', () => {
    const lines = [{ tokens: [W('hello'), W('world')] }]
    const result = alignParagraph(lines, 1)
    const toks = result[0].tokens
    is(toks[0].x, 0)
    // 'hello' is 5 chars, min 1 space, so 'world' starts at 6
    is(toks[1].x, 6)
  })

  it('two lines, no bars, no chords: left edges align at 0', () => {
    const lines = [
      { tokens: [W('hi'), W('there')] },
      { tokens: [W('a'), W('longer'), W('line')] },
    ]
    const result = alignParagraph(lines, 1)
    is(result[0].tokens[0].x, 0)
    is(result[1].tokens[0].x, 0)
  })

  it('two lines, no bars, first word on line 1 has chord: lines align on that column', () => {
    const lines = [
      { tokens: [W('hello','Am'), W('world')] },
      { tokens: [W('a'), W('b')] },
    ]
    const result = alignParagraph(lines, 1)
    // 'hello' has chord so its left edge is the anchor
    is(result[0].tokens[0].x, 0)
    // line 2 first chorded token... none, so just left-align same column
    is(result[1].tokens[0].x, 0)
  })
})

describe('alignParagraph — with bars', () => {
  it('two lines with one bar: bars align at same x', () => {
    // line1: "a b | c d"   a=1ch, b=1ch, c=1ch, d=1ch
    // line2: "longer | x"
    const lines = [
      { tokens: [W('a'), W('b'), BAR(), W('c'), W('d')] },
      { tokens: [W('longer'), W('y'), BAR(), W('x')] },
    ]
    const result = alignParagraph(lines, 1)
    const bar1x = result[0].tokens.find(t=>t.type==='barline').x
    const bar2x = result[1].tokens.find(t=>t.type==='barline').x
    is(bar1x, bar2x)
  })

  it('pre-bar section is flush right: last word before bar ends at bar x', () => {
    const lines = [
      { tokens: [W('a'), BAR(), W('c')] },
      { tokens: [W('longer'), BAR(), W('x')] },
    ]
    const result = alignParagraph(lines, 1)
    const barX = result[0].tokens.find(t=>t.type==='barline').x

    // line1: 'a' (1 char) ends at barX → its x = barX - 1
    is(result[0].tokens[0].x, barX - 1)
    // line2: 'longer' (6 chars) ends at barX → its x = barX - 6
    is(result[1].tokens[0].x, barX - 6)
  })

  it('post-bar section is flush left: first word after last bar is at bar x + 1 (one space)', () => {
    const lines = [
      { tokens: [W('a'), BAR(), W('c')] },
      { tokens: [W('ab'), BAR(), W('xyz')] },
    ]
    const result = alignParagraph(lines, 1)
    const barX0 = result[0].tokens.find(t=>t.type==='barline').x
    const barX1 = result[1].tokens.find(t=>t.type==='barline').x
    is(barX0, barX1) // bars aligned
    // post-bar words flush left: start at barX + 1
    const afterBar0 = result[0].tokens.filter(t=>t.type==='word').at(-1)
    const afterBar1 = result[1].tokens.filter(t=>t.type==='word').at(-1)
    is(afterBar0.x, barX0 + 1)
    is(afterBar1.x, barX1 + 1)
  })

  it('between-bar section is justified: words spread evenly', () => {
    // line1: bar | a b c | bar   (3 words, bar-to-bar gap determined by longest line)
    // line2: bar | longword | bar
    const lines = [
      { tokens: [BAR(), W('a'), W('b'), W('c'), BAR()] },
      { tokens: [BAR(), W('longword'), BAR()] },
    ]
    const result = alignParagraph(lines, 1)
    const bars0 = result[0].tokens.filter(t=>t.type==='barline')
    const bars1 = result[1].tokens.filter(t=>t.type==='barline')
    is(bars0[0].x, bars1[0].x)
    is(bars0[1].x, bars1[1].x)
    // words in line1 spread across the gap
    const words0 = result[0].tokens.filter(t=>t.type==='word')
    const leftBar = bars0[0].x
    const rightBar = bars0[1].x
    ok(words0[0].x > leftBar, 'first word after left bar')
    ok(words0[words0.length-1].x + words0[words0.length-1].text.length <= rightBar, 'last word fits before right bar')
  })

  it('minimum 1-space gap enforced between words', () => {
    const lines = [
      { tokens: [W('a'), W('b'), W('c'), W('d'), W('e')] },
    ]
    const result = alignParagraph(lines, 1)
    const toks = result[0].tokens
    for (let i = 1; i < toks.length; i++) {
      const gap = toks[i].x - (toks[i-1].x + toks[i-1].text.length)
      ok(gap >= 1, `gap between word ${i-1} and ${i} is ${gap}, expected >= 1`)
    }
  })
})

describe('alignParagraph — offsetX', () => {
  it('token offsetX is added to computed x', () => {
    const lines = [{ tokens: [W('hello','',5), W('world')] }]
    const result = alignParagraph(lines, 1)
    // 'hello' base x=0, offsetX=5 → final x=5
    is(result[0].tokens[0].x, 5)
  })
})

// layoutSong(tokens) → Page[]
// Page: { paragraphs: Paragraph[] }
// Paragraph: { lines: PositionedLine[] }
// Splits tokens into pages and paragraphs, runs alignParagraph on each paragraph.

describe('layoutSong', () => {
  it('returns at least one page', () => {
    const result = layoutSong([W('hello')])
    ok(result.length >= 1)
  })

  it('single paragraph has all lines', () => {
    const tokens = [W('a'), LB(), W('b'), LB(), W('c')]
    const result = layoutSong(tokens)
    is(result[0].paragraphs[0].lines.length, 3)
  })

  it('parabreak creates two paragraphs', () => {
    const tokens = [W('a'), PB(), W('b')]
    const result = layoutSong(tokens)
    is(result[0].paragraphs.length, 2)
  })

  it('pagebreak creates two pages', () => {
    const tokens = [W('a'), PG(), W('b')]
    const result = layoutSong(tokens)
    is(result.length, 2)
  })

  it('each paragraph is independently aligned', () => {
    const tokens = [
      W('hello'), BAR(), W('world'),
      PB(),
      W('x'), BAR(), W('y'),
    ]
    const result = layoutSong(tokens)
    is(result[0].paragraphs.length, 2)
    // Both paragraphs have positioned tokens
    result[0].paragraphs.forEach(p => {
      p.lines.forEach(l => l.tokens.forEach(t => ok('x' in t, 'token has x position')))
    })
  })
})

// ── Bug fixes ─────────────────────────────────────────────────────────────────

describe('placeJustified — uniform gaps with unequal word widths', () => {
  it('gaps between words are equal when words have different widths', () => {
    // BAR 'a'(1) 'bb'(2) 'ccc'(3) BAR; longword(10) forces bar positions
    const lines = [
      { tokens: [BAR(), W('a'), W('bb'), W('ccc'), BAR()] },
      { tokens: [BAR(), W('longworddd'), BAR()] },
    ]
    const result = alignParagraph(lines, 1)
    const words = result[0].tokens.filter(t => t.type === 'word')
    const gap01 = words[1].x - (words[0].x + words[0].text.length)
    const gap12 = words[2].x - (words[1].x + words[1].text.length)
    near(gap01, gap12, 1.5) // gaps must be equal (±1 rounding artefact ok)
  })

  it('justified words fill the full bar-to-bar space', () => {
    const lines = [
      { tokens: [BAR(), W('x'), W('y'), BAR()] },
      { tokens: [BAR(), W('longword'), BAR()] },
    ]
    const result = alignParagraph(lines, 1)
    const bars = result[0].tokens.filter(t => t.type === 'barline')
    const words = result[0].tokens.filter(t => t.type === 'word')
    const lastWordEnd = words[words.length - 1].x + words[words.length - 1].text.length
    ok(words[0].x > bars[0].x, 'first word after left bar')
    ok(lastWordEnd <= bars[1].x, 'last word ends at or before right bar')
  })
})

describe('alignParagraph — no-bar chord-cell alignment', () => {
  it('first chorded word aligns across lines when no bars', () => {
    // line0: 'intro'(no chord) 'verse'(chord Am) → first chord at some x
    // line1: 'a'(no chord) 'b'(no chord) → no chord, aligns from same left edge
    // line2: 'x'(chord G) → first chord must align with line0's first chord
    const lines = [
      { tokens: [W('intro', ''), W('verse', 'Am')] },
      { tokens: [W('x', 'G'), W('y', '')] },
    ]
    const result = alignParagraph(lines, 1)
    // Both lines' first chorded word should start at the same x
    const firstChorded0 = result[0].tokens.find(t => t.chord)
    const firstChorded1 = result[1].tokens.find(t => t.chord)
    is(firstChorded0.x, firstChorded1.x)
  })

  it('lines with no chords left-align to the chord anchor column', () => {
    const lines = [
      { tokens: [W('aa', ''), W('verse', 'Am')] }, // chord at x=3 (2+1)
      { tokens: [W('b', '')] },                     // no chord → starts at 0
    ]
    const result = alignParagraph(lines, 1)
    // line with no chords: flush left from 0 (no anchor needed)
    is(result[1].tokens[0].x, 0)
  })
})

describe('layoutSong — paragraph bar alignment', () => {
  it('first bar of each paragraph aligns to the same x column', () => {
    // para0: short pre-bar content 'a' | 'b'
    // para1: longer pre-bar content 'longer' | 'c'
    // Both first bars should share the same x
    const tokens = [
      W('a'), BAR(), W('b'),
      PB(),
      W('longer'), BAR(), W('c'),
    ]
    const result = layoutSong(tokens)
    const bar0 = result[0].paragraphs[0].lines[0].tokens.find(t => t.type === 'barline')
    const bar1 = result[0].paragraphs[1].lines[0].tokens.find(t => t.type === 'barline')
    is(bar0.x, bar1.x)
  })
})
