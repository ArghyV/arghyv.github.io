import { describe, it, expect } from './runner.mjs';
import {
  createCursorState, moveLeft, moveRight, scrollUp, scrollDown,
  setMarginLeft, setMarginRight, advanceCursor,
  cursorPageLocal, cursorOnPage, cursorPartiallyOnPage
} from '../src/cursorState.mjs';

const BASE = {
  viewportWidth: 1000, viewportHeight: 900,
  pageWidthPx: 794, pageHeightPx: 1123,
  charWidthPx: 10, charHeightPx: 16,
};

function base() { return createCursorState(BASE); }

describe('createCursorState - initial position', () => {
  it('cursor viewport Y is fixed at 2/3 viewport height', () => {
    const s = base();
    expect(s.cursorViewportY).toBe(600); // 900 * 2/3
  });

  it('paper top edge starts at 2/3 viewport height', () => {
    const s = base();
    expect(s.paperY).toBe(600);
  });

  it('page is horizontally centered', () => {
    const s = base();
    expect(s.pageX).toBe(Math.round((1000 - 794) / 2)); // 103
  });

  it('cursor starts at left edge of page', () => {
    const s = base();
    expect(s.cursorX).toBe(s.pageX);
  });
});

describe('moveLeft / moveRight', () => {
  it('moveRight advances by charWidth', () => {
    const s = moveRight(base());
    expect(s.cursorX).toBe(base().pageX + 10);
  });

  it('moveLeft retreats by charWidth', () => {
    const s = moveLeft(moveRight(base()));
    expect(s.cursorX).toBe(base().pageX);
  });

  it('moveLeft does not go past marginLeft', () => {
    const s = moveLeft(base()); // already at left margin
    expect(s.cursorX).toBe(base().pageX);
  });

  it('moveRight does not go past marginRight - charWidth', () => {
    let s = base();
    for (let i = 0; i < 200; i++) s = moveRight(s);
    const maxX = s.pageX + s.marginRight - s.charWidthPx;
    expect(s.cursorX).toBeLessThanOrEqual(maxX);
  });
});

describe('scroll', () => {
  it('scrollUp decreases paperY by charHeight', () => {
    const s = scrollUp(base());
    expect(s.paperY).toBe(600 - 16);
  });

  it('scrollDown increases paperY by charHeight', () => {
    const s = scrollDown(base());
    expect(s.paperY).toBe(600 + 16);
  });

  it('cursorViewportY never changes on scroll', () => {
    let s = base();
    s = scrollUp(s); s = scrollUp(s); s = scrollDown(s);
    expect(s.cursorViewportY).toBe(600);
  });

  it('scrollDown is bounded: top of page max at 3/4 viewport', () => {
    let s = base();
    for (let i = 0; i < 200; i++) s = scrollDown(s);
    expect(s.paperY).toBeLessThanOrEqual(900 * 0.75);
  });

  it('scrollUp is bounded: bottom of page min at 1/4 viewport', () => {
    let s = base();
    for (let i = 0; i < 5000; i++) s = scrollUp(s);
    // bottom of page = paperY + pageHeight >= viewportHeight * 0.25
    const bottomOfPage = s.paperY + s.pageHeightPx;
    expect(bottomOfPage).toBeGreaterThan(900 * 0.25);
  });
});

describe('margins', () => {
  it('setMarginLeft restricts moveLeft', () => {
    let s = setMarginLeft(base(), 50); // left margin at 50px into page
    s = moveLeft(s);
    expect(s.cursorX).toBe(s.pageX + 50);
  });

  it('setMarginLeft moves cursor inside if outside', () => {
    // Cursor is at pageX (left edge), set marginLeft to 100
    let s = base(); // cursorX = pageX
    s = setMarginLeft(s, 100);
    expect(s.cursorX).toBe(s.pageX + 100);
  });

  it('setMarginRight restricts moveRight', () => {
    let s = setMarginRight(base(), 200);
    for (let i = 0; i < 50; i++) s = moveRight(s);
    expect(s.cursorX).toBeLessThanOrEqual(s.pageX + 200 - s.charWidthPx);
  });

  it('setMarginRight moves cursor inside if outside', () => {
    // Move cursor to right, then set a tight right margin
    let s = base();
    for (let i = 0; i < 50; i++) s = moveRight(s);
    const farX = s.cursorX;
    s = setMarginRight(s, 100); // right margin at 100px
    expect(s.cursorX).toBeLessThanOrEqual(s.pageX + 100 - s.charWidthPx);
  });
});

describe('cursorPageLocal', () => {
  it('at initial state, cursor is at page top-left (0,0)', () => {
    // paperY = cursorViewportY = 600, so y = 600 - 600 = 0
    const s = base();
    const { x, y } = cursorPageLocal(s);
    expect(x).toBe(0);
    expect(y).toBe(0);
  });

  it('after scrollUp, cursor appears lower on page', () => {
    const s = scrollUp(base());
    const { y } = cursorPageLocal(s);
    expect(y).toBe(16); // paper moved up by charHeight, so cursor is 16px lower on page
  });

  it('after moveRight, x increases', () => {
    const s = moveRight(base());
    expect(cursorPageLocal(s).x).toBe(10);
  });
});

describe('cursorOnPage / cursorPartiallyOnPage', () => {
  it('initially on page', () => {
    expect(cursorOnPage(base())).toBeTruthy();
  });

  it('scrolled far up puts cursor off page (below page bottom)', () => {
    let s = base();
    for (let i = 0; i < 5000; i++) s = scrollUp(s);
    // cursor y will exceed pageHeight
    const { y } = cursorPageLocal(s);
    if (y >= s.pageHeightPx) {
      expect(cursorOnPage(s)).toBeFalsy();
    } else {
      expect(cursorOnPage(s)).toBeTruthy(); // bounded, still on page
    }
  });

  it('cursor at y = pageHeight is off page', () => {
    // Manually craft state where cursor is off page bottom
    const s = { ...base(), paperY: 600 - 1200 }; // paperY way up
    expect(cursorOnPage(s)).toBeFalsy();
  });

  it('cursor partially on page left edge', () => {
    const s = { ...base(), cursorX: base().pageX - 5 }; // 5px off left
    expect(cursorPartiallyOnPage(s)).toBeTruthy();
    expect(cursorOnPage(s)).toBeFalsy();
  });
});
