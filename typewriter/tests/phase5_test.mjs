import { describe, it, expect } from './runner.mjs';

// ── Dead key detection (mirrors DEAD_KEY_RE in index.html) ────────────────
const DEAD_KEY_RE = /^[\u0060\u00b4\u005e\u007e\u00a8\u02c6\u02dc\u02d9\u02dd\u02db\u02da\u02c7\u00b8\u02cd\u0384\u0385]$/;

describe('dead key detection', () => {
  it('backtick ` is a dead key', () => {
    expect(DEAD_KEY_RE.test('\u0060')).toBeTruthy();
  });
  it('acute accent ´ is a dead key', () => {
    expect(DEAD_KEY_RE.test('\u00b4')).toBeTruthy();
  });
  it('circumflex ^ is a dead key', () => {
    expect(DEAD_KEY_RE.test('\u005e')).toBeTruthy();
  });
  it('tilde ~ is a dead key', () => {
    expect(DEAD_KEY_RE.test('\u007e')).toBeTruthy();
  });
  it('diaeresis ¨ is a dead key', () => {
    expect(DEAD_KEY_RE.test('\u00a8')).toBeTruthy();
  });
  it('regular letter a is NOT a dead key', () => {
    expect(DEAD_KEY_RE.test('a')).toBeFalsy();
  });
  it('composed é is NOT a dead key (has base letter)', () => {
    expect(DEAD_KEY_RE.test('é')).toBeFalsy();
  });
  it('space is NOT a dead key', () => {
    expect(DEAD_KEY_RE.test(' ')).toBeFalsy();
  });
  it('multi-char string is NOT a dead key', () => {
    expect(DEAD_KEY_RE.test('ab')).toBeFalsy();
  });
});

// ── Partial-on-paper geometry (mirrors typeChar logic) ────────────────────
function testOnPage(localX, localY, charW, charH, pageW, pageH) {
  const fullyOn  = localX >= 0 && localY >= 0
                && localX + charW <= pageW
                && localY + charH <= pageH;
  const partialOn = (localX + charW > 0) && (localY + charH > 0)
                 && localX < pageW && localY < pageH;
  return { fullyOn, partialOn };
}

describe('on-page geometry', () => {
  const CW = 10, CH = 16, PW = 200, PH = 300;

  it('cursor fully within page bounds', () => {
    const { fullyOn, partialOn } = testOnPage(50, 50, CW, CH, PW, PH);
    expect(fullyOn).toBeTruthy();
    expect(partialOn).toBeTruthy();
  });

  it('cursor at exact top-left corner (0,0) is fully on', () => {
    const { fullyOn } = testOnPage(0, 0, CW, CH, PW, PH);
    expect(fullyOn).toBeTruthy();
  });

  it('cursor 1px off left edge is partial', () => {
    const { fullyOn, partialOn } = testOnPage(-1, 0, CW, CH, PW, PH);
    expect(fullyOn).toBeFalsy();
    expect(partialOn).toBeTruthy();
  });

  it('cursor entirely off left (x + charW <= 0) is not on page', () => {
    const { fullyOn, partialOn } = testOnPage(-CW, 0, CW, CH, PW, PH);
    expect(fullyOn).toBeFalsy();
    expect(partialOn).toBeFalsy();
  });

  it('cursor at right edge: localX = PW - CW is fully on', () => {
    const { fullyOn } = testOnPage(PW - CW, 0, CW, CH, PW, PH);
    expect(fullyOn).toBeTruthy();
  });

  it('cursor 1px past right edge is partial', () => {
    const { fullyOn, partialOn } = testOnPage(PW - CW + 1, 0, CW, CH, PW, PH);
    expect(fullyOn).toBeFalsy();
    expect(partialOn).toBeTruthy();
  });

  it('cursor entirely off right is not on page', () => {
    const { fullyOn, partialOn } = testOnPage(PW, 0, CW, CH, PW, PH);
    expect(fullyOn).toBeFalsy();
    expect(partialOn).toBeFalsy();
  });

  it('cursor above page top is not on page', () => {
    const { fullyOn, partialOn } = testOnPage(0, -CH, CW, CH, PW, PH);
    expect(fullyOn).toBeFalsy();
    expect(partialOn).toBeFalsy();
  });

  it('cursor 1px above top is partial', () => {
    const { fullyOn, partialOn } = testOnPage(0, -1, CW, CH, PW, PH);
    expect(fullyOn).toBeFalsy();
    expect(partialOn).toBeTruthy();
  });

  it('cursor below page bottom is not on page', () => {
    const { fullyOn, partialOn } = testOnPage(0, PH, CW, CH, PW, PH);
    expect(fullyOn).toBeFalsy();
    expect(partialOn).toBeFalsy();
  });

  it('cursor 1px above bottom edge is fully on', () => {
    const { fullyOn } = testOnPage(0, PH - CH, CW, CH, PW, PH);
    expect(fullyOn).toBeTruthy();
  });

  it('cursor partially off all 4 corners (corner straddle)', () => {
    // Cursor at (-1, -1) still overlaps 9x15px of the page
    const { fullyOn, partialOn } = testOnPage(-1, -1, CW, CH, PW, PH);
    expect(fullyOn).toBeFalsy();
    expect(partialOn).toBeTruthy();
  });
});

// ── Composition result routing ─────────────────────────────────────────────
// Models the decision in compositionend handler:
// isDead = data.length === 1 && DEAD_KEY_RE.test(data)
function resolveComposition(data) {
  const isDead = data.length === 1 && DEAD_KEY_RE.test(data);
  const chars  = [];
  for (let i = 0; i < data.length; i++) {
    const ch     = data[i];
    const isLast = i === data.length - 1;
    chars.push({ ch, isDead: isDead && isLast && data.length === 1 });
  }
  return chars;
}

describe('composition result routing', () => {
  it('bare diacritic produces one char with isDead=true', () => {
    const result = resolveComposition('`');
    expect(result.length).toBe(1);
    expect(result[0].isDead).toBeTruthy();
  });

  it('composed char é produces one char with isDead=false', () => {
    const result = resolveComposition('é');
    expect(result.length).toBe(1);
    expect(result[0].isDead).toBeFalsy();
  });

  it('IME multi-char result stamps each char, none are dead', () => {
    const result = resolveComposition('ab');
    expect(result.length).toBe(2);
    expect(result[0].isDead).toBeFalsy();
    expect(result[1].isDead).toBeFalsy();
  });

  it('empty composition produces no chars', () => {
    const result = resolveComposition('');
    expect(result.length).toBe(0);
  });
});
