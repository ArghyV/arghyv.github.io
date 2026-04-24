import { describe, it, expect } from './runner.mjs';
import { resolveImportedSize, mmToPx, getSizePx, PAPER_SIZES } from '../src/paperSizes.mjs';

describe('mmToPx', () => {
  it('converts A4 width correctly at 96dpi', () => {
    expect(mmToPx(210)).toBe(794); // 210 * 96/25.4 = 793.7... rounds to 794
  });
  it('converts A4 height correctly', () => {
    expect(mmToPx(297)).toBe(1123);
  });
});

describe('getSizePx', () => {
  it('returns portrait dimensions for A4', () => {
    const {w, h} = getSizePx('A4');
    expect(w).toBe(794);
    expect(h).toBe(1123);
    expect(h).toBeGreaterThan(w); // portrait
  });
});

describe('resolveImportedSize - no scaling needed', () => {
  it('A4 portrait returns scale=1, no rotation, no warning', () => {
    const r = resolveImportedSize(210, 297);
    expect(r.scale).toBe(1);
    expect(r.rotated).toBe(false);
    expect(r.needsWarning).toBe(false);
    expect(r.sizeName).toBe('A4');
  });

  it('A5 portrait returns scale=1, sizeName A5', () => {
    const r = resolveImportedSize(148, 210);
    expect(r.scale).toBe(1);
    expect(r.sizeName).toBe('A5');
  });

  it('Letter portrait returns scale=1', () => {
    const r = resolveImportedSize(216, 279);
    expect(r.scale).toBe(1);
    expect(r.sizeName).toBe('Letter');
  });
});

describe('resolveImportedSize - rotation', () => {
  it('A4 landscape is rotated to portrait', () => {
    const r = resolveImportedSize(297, 210); // landscape
    expect(r.rotated).toBe(true);
    expect(r.scale).toBe(1);
    expect(r.sizeName).toBe('A4');
  });

  it('Letter landscape is rotated', () => {
    const r = resolveImportedSize(279, 216);
    expect(r.rotated).toBe(true);
    expect(r.needsWarning).toBe(false);
  });
});

describe('resolveImportedSize - scaling', () => {
  it('page larger than B4 is scaled down with warning', () => {
    const r = resolveImportedSize(400, 600); // larger than B4
    expect(r.sizeName).toBe('B4');
    expect(r.needsWarning).toBe(true);
    expect(r.scale).toBeLessThanOrEqual(1);
    expect(r.scale).toBeGreaterThan(0);
  });

  it('page smaller than A6 is scaled up with warning', () => {
    const r = resolveImportedSize(50, 70); // smaller than A6 (105x148)
    expect(r.sizeName).toBe('A6');
    expect(r.needsWarning).toBe(true);
    expect(r.scale).toBeGreaterThan(1);
  });

  it('oversized landscape is rotated then scaled', () => {
    const r = resolveImportedSize(600, 400); // landscape, larger than B4
    expect(r.rotated).toBe(true);
    expect(r.needsWarning).toBe(true);
    expect(r.sizeName).toBe('B4');
  });
});

describe('resolveImportedSize - scale values', () => {
  it('400x600 scales to fit within B4 (250x353)', () => {
    const r = resolveImportedSize(400, 600);
    // scale = min(250/400, 353/600) = min(0.625, 0.588) = 0.588
    expect(r.scale).toBeCloseTo(353/600, 3);
  });

  it('50x70 scales to fit within A6 (105x148)', () => {
    const r = resolveImportedSize(50, 70);
    // scale = min(105/50, 148/70) = min(2.1, 2.114) = 2.1
    expect(r.scale).toBeCloseTo(105/50, 3);
  });
});
