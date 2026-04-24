import { describe, it, expect } from './runner.mjs';
import { createTabStops, toggleTabStop, nextTabStop, tabAdvance } from '../src/tabStops.mjs';

describe('createTabStops', () => {
  it('returns empty array', () => {
    expect(createTabStops()).toEqual([]);
  });
});

describe('toggleTabStop - add', () => {
  it('adds a stop to empty list', () => {
    expect(toggleTabStop([], 100)).toEqual([100]);
  });

  it('keeps list sorted', () => {
    let s = toggleTabStop([], 200);
    s = toggleTabStop(s, 50);
    s = toggleTabStop(s, 150);
    expect(s).toEqual([50, 150, 200]);
  });

  it('clicking within snap of existing stop removes it', () => {
    let s = toggleTabStop([], 100);
    s = toggleTabStop(s, 102); // within snap=4 → removes 100
    expect(s.length).toBe(0);
  });

  it('adds stop outside snap distance', () => {
    let s = toggleTabStop([], 100);
    s = toggleTabStop(s, 106); // just outside snap of 4
    expect(s.length).toBe(2);
  });
});

describe('toggleTabStop - remove', () => {
  it('removes stop at exact position', () => {
    let s = toggleTabStop([], 100);
    s = toggleTabStop(s, 100);
    expect(s).toEqual([]);
  });

  it('removes stop within snap distance', () => {
    let s = toggleTabStop([], 100);
    s = toggleTabStop(s, 103);
    expect(s).toEqual([]);
  });

  it('removes correct stop when multiple exist', () => {
    let s = [50, 100, 200];
    s = toggleTabStop(s, 100);
    expect(s).toEqual([50, 200]);
  });
});

describe('nextTabStop', () => {
  it('returns null for empty list', () => {
    expect(nextTabStop([], 50)).toBe(null);
  });

  it('returns first stop to the right', () => {
    expect(nextTabStop([50, 100, 200], 60)).toBe(100);
  });

  it('returns null when cursor is past all stops', () => {
    expect(nextTabStop([50, 100], 150)).toBe(null);
  });

  it('does not return stop at same position as cursor', () => {
    expect(nextTabStop([100, 200], 100)).toBe(200);
  });

  it('returns first stop when cursor is before all', () => {
    expect(nextTabStop([100, 200, 300], 0)).toBe(100);
  });
});

describe('tabAdvance', () => {
  it('moves to next tab stop', () => {
    expect(tabAdvance([100, 200, 300], 50, 780)).toBe(100);
  });

  it('skips stops behind cursor', () => {
    expect(tabAdvance([100, 200, 300], 150, 780)).toBe(200);
  });

  it('falls back to right margin when no stops ahead', () => {
    expect(tabAdvance([100, 200], 250, 780)).toBe(780);
  });

  it('falls back to right margin with empty stop list', () => {
    expect(tabAdvance([], 100, 780)).toBe(780);
  });

  it('does not advance to stop at cursor position', () => {
    expect(tabAdvance([100, 200], 100, 780)).toBe(200);
  });
});

describe('nextTabStop - fixed boundary (was off-by-one with +1)', () => {
  it('cursor one px below stop reaches that stop (old +1 bug would skip it)', () => {
    // Old code: s > cursorX+1 → 100 > 100 false → null (wrong)
    // New code: s > cursorX  → 100 > 99  true  → 100 (correct)
    expect(nextTabStop([100, 200], 99)).toBe(100);
  });

  it('cursor at stop does not return that stop (moves to next)', () => {
    expect(nextTabStop([100, 200], 100)).toBe(200);
  });
});
