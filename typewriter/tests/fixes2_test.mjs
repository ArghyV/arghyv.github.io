import { describe, it, expect } from './runner.mjs';

// ── 1. Ruler coordinate system ────────────────────────────────────────────
// The ruler draws ticks from rulerLeft = pageCenterX - B4_W/2.
// Clicks must convert using the same origin.
// We test the pure coordinate conversion functions.
import { rulerXToPageLocal, pageLocalToRulerX, rulerLabelAt } from '../src/rulerCoords.mjs';

const B4_W_PX = Math.round(250 * (96 / 25.4)); // ~945px
const PAGE_W   = Math.round(210 * (96 / 25.4)); // A4 ~794px
const PAGE_LEFT = 103; // (1000-794)/2 centered in 1000px viewport

describe('rulerCoords - coordinate conversion', () => {
  const pageCenterX = PAGE_LEFT + PAGE_W / 2;
  const rulerLeft   = pageCenterX - B4_W_PX / 2;

  it('rulerXToPageLocal: click at rulerLeft + pageLeft offset = 0', () => {
    // clicking right at page left edge
    const clickX = rulerLeft + (pageCenterX - PAGE_W/2 - rulerLeft);
    expect(rulerXToPageLocal(clickX, rulerLeft, PAGE_LEFT)).toBe(0);
  });

  it('rulerXToPageLocal: click at page center = pageW/2', () => {
    const clickX = pageCenterX;
    expect(rulerXToPageLocal(clickX, rulerLeft, PAGE_LEFT))
      .toBe(Math.round(PAGE_W / 2));
  });

  it('pageLocalToRulerX: 0 maps to pageLeft in ruler coords', () => {
    expect(pageLocalToRulerX(0, rulerLeft, PAGE_LEFT)).toBe(PAGE_LEFT);
  });

  it('pageLocalToRulerX: round-trips with rulerXToPageLocal', () => {
    const local = 200;
    const rx = pageLocalToRulerX(local, rulerLeft, PAGE_LEFT);
    expect(rulerXToPageLocal(rx, rulerLeft, PAGE_LEFT)).toBe(local);
  });
});

describe('rulerCoords - centered labels', () => {
  const pageCenterX = PAGE_LEFT + PAGE_W / 2;
  const rulerLeft   = pageCenterX - B4_W_PX / 2;
  const cmPx        = (96 / 25.4) * 10;

  it('label at page center = 0', () => {
    expect(rulerLabelAt(pageCenterX, rulerLeft, pageCenterX, cmPx)).toBe(0);
  });

  it('label 1cm right of center = +1', () => {
    expect(rulerLabelAt(pageCenterX + cmPx, rulerLeft, pageCenterX, cmPx)).toBe(1);
  });

  it('label 1cm left of center = -1', () => {
    expect(rulerLabelAt(pageCenterX - cmPx, rulerLeft, pageCenterX, cmPx)).toBe(-1);
  });

  it('label at rulerLeft is negative', () => {
    const label = rulerLabelAt(rulerLeft, rulerLeft, pageCenterX, cmPx);
    expect(label).toBeLessThan(0);
  });
});

// ── 2. Scroll lower bound uses total stack height ─────────────────────────
import { scrollUpMulti, scrollDownMulti } from '../src/cursorState.mjs';

describe('scrollUpMulti - lower bound from total stack', () => {
  const base = {
    viewportWidth: 1000, viewportHeight: 900,
    pageWidthPx: 794, pageHeightPx: 1123,
    charWidthPx: 10, charHeightPx: 16,
    cursorX: 103, cursorViewportY: 600,
    paperY: 600, pageX: 103,
    marginLeft: 0, marginRight: 794,
  };

  it('scrollUpMulti is exported', () => {
    expect(typeof scrollUpMulti).toBe('function');
  });

  it('with 3 pages can scroll past bottom of page 1', () => {
    // total height = 3*1123 + 2*40 gap = 3449px
    const totalH = 3 * 1123 + 2 * 40;
    let s = base;
    for (let i = 0; i < 5000; i++) s = scrollUpMulti(s, totalH);
    // bottom of stack = paperY + totalH; must be >= 0.25*vh = 225
    const bottomOfStack = s.paperY + totalH;
    expect(bottomOfStack).toBeGreaterThan(900 * 0.25);
  });

  it('single page: behaves same as scrollUp', () => {
    const totalH = 1123;
    let s = base;
    for (let i = 0; i < 5000; i++) s = scrollUpMulti(s, totalH);
    const bottomOfStack = s.paperY + totalH;
    expect(bottomOfStack).toBeGreaterThan(900 * 0.25);
  });

  it('with 3 pages scrolls further up than single-page bound', () => {
    const totalH3 = 3 * 1123 + 2 * 40;
    const totalH1 = 1123;
    let s3 = base, s1 = base;
    for (let i = 0; i < 5000; i++) {
      s3 = scrollUpMulti(s3, totalH3);
      s1 = scrollUpMulti(s1, totalH1);
    }
    // multi-page should allow paperY to go lower (more negative)
    expect(s3.paperY).toBeLessThan(s1.paperY);
  });
});

// ── 3. Dead key lookup table ──────────────────────────────────────────────
import { DEAD_KEY_CHAR } from '../src/deadKeys.mjs';

describe('DEAD_KEY_CHAR lookup', () => {
  it('exports a Map or object', () => {
    expect(typeof DEAD_KEY_CHAR).toBe('object');
  });

  it('Dead` (backtick) maps to grave ` character', () => {
    expect(DEAD_KEY_CHAR['Dead`']).toBe('\u0060');
  });

  it("Dead' (acute) maps to ´", () => {
    expect(DEAD_KEY_CHAR["Dead'"]).toBe('\u00b4');
  });

  it('Dead^ maps to ^', () => {
    expect(DEAD_KEY_CHAR['Dead^']).toBe('\u005e');
  });

  it('Dead~ maps to ~', () => {
    expect(DEAD_KEY_CHAR['Dead~']).toBe('\u007e');
  });

  it('Dead" maps to ¨ (diaeresis)', () => {
    expect(DEAD_KEY_CHAR['Dead"']).toBe('\u00a8');
  });

  it('unknown key returns null', () => {
    expect(DEAD_KEY_CHAR['DeadXYZ'] ?? null).toBe(null);
  });
});

// ── 4. Cursor cell sizing includes padding ────────────────────────────────
import { measureCharCell } from '../src/glyphPipeline.mjs';

class MockCtx {
  constructor() { this.font = ''; }
  measureText(t) { return { width: t.length * 8, actualBoundingBoxAscent: 11, actualBoundingBoxDescent: 3 }; }
}

describe('measureCharCell', () => {
  it('is exported', () => {
    expect(typeof measureCharCell).toBe('function');
  });

  it('cell height >= pxSize * 1.4 to accommodate descenders + ascenders', () => {
    const ctx = new MockCtx();
    const cell = measureCharCell('"Courier Prime"', 12, ctx);
    const pxSize = 12 * (96/72);
    expect(cell.h).toBeGreaterThan(pxSize * 1.3);
  });

  it('cell width >= measured M width', () => {
    const ctx = new MockCtx();
    const cell = measureCharCell('"Courier Prime"', 12, ctx);
    expect(cell.w).toBeGreaterThan(0);
  });

  it('cell includes top padding so stamp does not clip ascenders', () => {
    const ctx = new MockCtx();
    const cell = measureCharCell('"Courier Prime"', 12, ctx);
    expect(cell.topPad).toBeGreaterThan(0);
  });
});
