import { describe, it, expect } from './runner.mjs';
import { addPageAfter, deletePage, nearestPageIndex, computePageLayouts } from '../src/pageModel.mjs';
import { measureChar, FONTS, FONT_SIZES, INK_COLOR } from '../src/glyphPipeline.mjs';

// --- Mock OffscreenCanvas for Node environment ---
class MockCanvas {
  constructor(w, h) { this.width = w; this.height = h; this._ops = []; }
  getContext() {
    const ops = this._ops;
    return {
      fillStyle: '#fff', font: '', globalAlpha: 1, textBaseline: 'top',
      fillRect(...a)  { ops.push(['fillRect', ...a]); },
      fillText(...a)  { ops.push(['fillText', ...a]); },
      drawImage(...a) { ops.push(['drawImage', ...a]); },
      clearRect(...a) { ops.push(['clearRect', ...a]); },
      save()   { ops.push(['save']); },
      restore(){ ops.push(['restore']); },
      beginPath(){ ops.push(['beginPath']); },
      rect(...a){ ops.push(['rect', ...a]); },
      clip()   { ops.push(['clip']); },
      measureText(t) { return { width: t.length * 7 }; }, // mock: 7px per char
    };
  }
}
global.OffscreenCanvas = MockCanvas;

// Re-import after mock (import cache may already have it — inline test instead)
import { createPage } from '../src/pageModel.mjs';
import { stampGlyph, paintCorrection, flattenLayers } from '../src/glyphPipeline.mjs';

describe('createPage', () => {
  it('creates page with correct dimensions', () => {
    const p = createPage(794, 1123);
    expect(p.widthPx).toBe(794);
    expect(p.heightPx).toBe(1123);
  });

  it('bgCanvas and editCanvas are independent', () => {
    const p = createPage(794, 1123);
    expect(p.bgCanvas).toBeTruthy();
    expect(p.editCanvas).toBeTruthy();
    expect(p.bgCanvas === p.editCanvas).toBeFalsy();
  });

  it('default scale is 1, not rotated', () => {
    const p = createPage(100, 200);
    expect(p.scale).toBe(1);
    expect(p.rotated).toBe(false);
  });
});

describe('addPageAfter', () => {
  it('inserts a new page after given index', () => {
    const pages = [createPage(794, 1123)];
    const next = addPageAfter(pages, 0);
    expect(next.length).toBe(2);
  });

  it('new page has same dimensions as reference', () => {
    const pages = [createPage(794, 1123)];
    const next = addPageAfter(pages, 0);
    expect(next[1].widthPx).toBe(794);
    expect(next[1].heightPx).toBe(1123);
  });

  it('inserts at correct position', () => {
    const p1 = createPage(100, 200);
    const p2 = createPage(200, 300);
    const pages = [p1, p2];
    const next = addPageAfter(pages, 0);
    expect(next.length).toBe(3);
    expect(next[0]).toBe(p1);
    expect(next[2]).toBe(p2);
  });
});

describe('deletePage', () => {
  it('removes page at index', () => {
    const pages = [createPage(100,200), createPage(100,200)];
    const next = deletePage(pages, 0);
    expect(next.length).toBe(1);
  });

  it('does not delete last page', () => {
    const pages = [createPage(100, 200)];
    const next = deletePage(pages, 0);
    expect(next.length).toBe(1);
  });
});

describe('nearestPageIndex', () => {
  const layouts = [
    { y: 0, h: 100 },
    { y: 140, h: 100 },
    { y: 280, h: 100 },
  ];

  it('returns 0 when cursor is in first page', () => {
    expect(nearestPageIndex(layouts, 50)).toBe(0);
  });

  it('returns 1 when cursor is nearest second page center', () => {
    expect(nearestPageIndex(layouts, 190)).toBe(1);
  });

  it('returns 2 for last page', () => {
    expect(nearestPageIndex(layouts, 400)).toBe(2);
  });

  it('equidistant: picks earlier page', () => {
    // midpoint between page 0 center (50) and page 1 center (190) = 120
    const idx = nearestPageIndex(layouts, 120);
    expect(idx).toBe(0); // dist to 0: 70, dist to 1: 70 — first wins
  });
});

describe('computePageLayouts', () => {
  it('first page y equals paperY', () => {
    const pages = [createPage(794, 1123)];
    const layouts = computePageLayouts(pages, 600, 1000);
    expect(layouts[0].y).toBe(600);
  });

  it('second page y = first.y + first.h + gap', () => {
    const pages = [createPage(794, 1000), createPage(794, 1000)];
    const layouts = computePageLayouts(pages, 0, 1000, 40);
    expect(layouts[1].y).toBe(1040);
  });

  it('pages are horizontally centered', () => {
    const pages = [createPage(794, 1123)];
    const layouts = computePageLayouts(pages, 0, 1000);
    expect(layouts[0].x).toBe(Math.round((1000 - 794) / 2));
  });
});

describe('glyphPipeline constants', () => {
  it('INK_COLOR is dark purple', () => {
    expect(INK_COLOR).toBe('#1a1225');
  });

  it('FONTS has 4 entries', () => {
    expect(Object.keys(FONTS).length).toBe(4);
  });

  it('FONT_SIZES small=10 large=12', () => {
    expect(FONT_SIZES.small).toBe(10);
    expect(FONT_SIZES.large).toBe(12);
  });
});

describe('measureChar', () => {
  it('returns positive width and height', () => {
    const mockCtx = new MockCanvas(1,1).getContext();
    const result = measureChar(FONTS.prestige.family, 12, mockCtx);
    expect(result.w).toBeGreaterThan(0);
    expect(result.h).toBeGreaterThan(0);
  });

  it('small font is smaller than large', () => {
    const mockCtx = new MockCanvas(1,1).getContext();
    const small = measureChar(FONTS.prestige.family, FONT_SIZES.small, mockCtx);
    const large = measureChar(FONTS.prestige.family, FONT_SIZES.large, mockCtx);
    expect(large.h).toBeGreaterThan(small.h);
  });
});

describe('stampGlyph', () => {
  it('draws onto destination canvas', () => {
    const dest = new MockCanvas(200, 200);
    const ctx = dest.getContext();
    stampGlyph('A', 'monospace', 13, ctx, 10, 10, 10, 16, null);
    const hasDrawImage = dest._ops.some(op => op[0] === 'drawImage');
    expect(hasDrawImage).toBeTruthy();
  });

  it('applies clip rect when provided', () => {
    const dest = new MockCanvas(200, 200);
    const ctx = dest.getContext();
    stampGlyph('A', 'monospace', 13, ctx, 10, 10, 10, 16, {x:0,y:0,w:50,h:50});
    const hasSave = dest._ops.some(op => op[0] === 'save');
    const hasClip = dest._ops.some(op => op[0] === 'clip');
    expect(hasSave).toBeTruthy();
    expect(hasClip).toBeTruthy();
  });
});

describe('paintCorrection', () => {
  it('erase mode fills with paper-white', () => {
    const canvas = new MockCanvas(100, 100);
    const ctx = canvas.getContext();
    paintCorrection(ctx, 0, 0, 10, 16, 'erase');
    const fill = canvas._ops.find(op => op[0] === 'fillRect');
    expect(fill).toBeTruthy();
  });

  it('highlight mode uses partial alpha', () => {
    const canvas = new MockCanvas(100, 100);
    const ctx = canvas.getContext();
    let alpha;
    const origCtx = canvas.getContext();
    // Patch to capture globalAlpha
    let capturedAlpha = null;
    const patchedCtx = {
      ...origCtx,
      set globalAlpha(v) { capturedAlpha = v; },
      get globalAlpha() { return capturedAlpha; },
      save(){}, restore(){}, fillRect(){}
    };
    paintCorrection(patchedCtx, 0, 0, 10, 16, 'highlight');
    expect(capturedAlpha).toBeCloseTo(0.45, 2);
  });
});

describe('flattenLayers', () => {
  it('returns an OffscreenCanvas', () => {
    const bg = new MockCanvas(100, 100);
    const edit = new MockCanvas(100, 100);
    const result = flattenLayers(bg, edit, 100, 100);
    expect(result instanceof MockCanvas).toBeTruthy();
  });

  it('draws both layers', () => {
    const bg = new MockCanvas(100, 100);
    const edit = new MockCanvas(100, 100);
    const result = flattenLayers(bg, edit, 100, 100);
    const drawCalls = result._ops.filter(op => op[0] === 'drawImage');
    expect(drawCalls.length).toBe(2);
  });
});
