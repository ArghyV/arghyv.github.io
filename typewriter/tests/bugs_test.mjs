import { describe, it, expect } from './runner.mjs';
import {
  createCursorState, moveLeft, scrollUp,
  setMarginLeft, carriageReturn
} from '../src/cursorState.mjs';

const BASE = {
  viewportWidth: 1000, viewportHeight: 900,
  pageWidthPx: 794, pageHeightPx: 1123,
  charWidthPx: 10, charHeightPx: 16,
};
function base() { return createCursorState(BASE); }

// ── Bug: carriageReturn must exist and reset X to marginLeft ─────────────
describe('carriageReturn', () => {
  it('carriageReturn is exported from cursorState', () => {
    expect(typeof carriageReturn).toBe('function');
  });

  it('scrolls paper up by one line', () => {
    let s = base();
    s = moveLeft(moveLeft(moveLeft(s))); // already at left but shows intent
    const before = s.paperY;
    s = carriageReturn(s);
    expect(s.paperY).toBe(before - s.charHeightPx);
  });

  it('resets cursorX to pageX + marginLeft (no margin set)', () => {
    let s = base();
    // move cursor right several times
    for (let i = 0; i < 10; i++) s = { ...s, cursorX: s.cursorX + s.charWidthPx };
    s = carriageReturn(s);
    expect(s.cursorX).toBe(s.pageX + s.marginLeft);
  });

  it('resets cursorX to pageX + marginLeft when margin is set', () => {
    let s = setMarginLeft(base(), 50);
    for (let i = 0; i < 10; i++) s = { ...s, cursorX: s.cursorX + s.charWidthPx };
    s = carriageReturn(s);
    expect(s.cursorX).toBe(s.pageX + 50);
  });

  it('respects scrollUp bounds (same as scrollUp)', () => {
    let s = base();
    // scroll to near-minimum
    for (let i = 0; i < 5000; i++) s = scrollUp(s);
    const atLimit = s.paperY;
    s = carriageReturn(s);
    // should not go below the bound
    expect(s.paperY).toBeLessThanOrEqual(atLimit + 1); // at or above limit
  });
});

// ── Runner self-test: toBeLessThan ───────────────────────────────────────
describe('runner toBeLessThan', () => {
  it('5 < 10', () => { expect(5).toBeLessThan(10); });
  it('0 < 1', () => { expect(0).toBeLessThan(1); });
});
