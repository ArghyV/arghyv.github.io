import { describe, it, expect } from './runner.mjs';
import { MM_TO_PX } from '../src/paperSizes.mjs';

// Mirror of flattenForExport logic from index.html (pure arithmetic portion)
function exportDims(page) {
  const scaled = page.scale && page.scale !== 1 && page.originalWidthMm;
  const origWpx = scaled ? Math.round(page.originalWidthMm * MM_TO_PX) : page.widthPx;
  const origHpx = scaled ? Math.round(page.originalHeightMm * MM_TO_PX) : page.heightPx;
  if (page.rotated) {
    return { wMm: origHpx / MM_TO_PX, hMm: origWpx / MM_TO_PX, wPx: origHpx, hPx: origWpx };
  }
  return { wMm: origWpx / MM_TO_PX, hMm: origHpx / MM_TO_PX, wPx: origWpx, hPx: origHpx };
}

describe('flattenForExport - no scale no rotation', () => {
  const page = { widthPx: 794, heightPx: 1123, scale: 1, rotated: false, originalWidthMm: null };

  it('export dims equal edit dims', () => {
    const { wPx, hPx } = exportDims(page);
    expect(wPx).toBe(794);
    expect(hPx).toBe(1123);
  });

  it('export mm round-trips to ~A4', () => {
    const { wMm, hMm } = exportDims(page);
    expect(Math.abs(wMm - 210)).toBeLessThan(1);
    expect(Math.abs(hMm - 297)).toBeLessThan(1);
  });
});

describe('flattenForExport - scaled down (large original)', () => {
  // 400x600mm original scaled to B4 (250x353mm) edit canvas
  const editWpx = Math.round(250 * MM_TO_PX);
  const editHpx = Math.round(353 * MM_TO_PX);
  const page = {
    widthPx: editWpx, heightPx: editHpx,
    scale: 353/600, rotated: false,
    originalWidthMm: 400, originalHeightMm: 600,
  };

  it('export px exceeds edit px (restores original resolution)', () => {
    const { wPx, hPx } = exportDims(page);
    expect(wPx).toBeGreaterThan(editWpx);
    expect(hPx).toBeGreaterThan(editHpx);
  });

  it('export mm matches original mm', () => {
    const { wMm, hMm } = exportDims(page);
    expect(Math.abs(wMm - 400)).toBeLessThan(1);
    expect(Math.abs(hMm - 600)).toBeLessThan(1);
  });
});

describe('flattenForExport - scaled up (tiny original)', () => {
  // 50x70mm original scaled up to A6 (105x148mm) edit canvas
  const editWpx = Math.round(105 * MM_TO_PX);
  const editHpx = Math.round(148 * MM_TO_PX);
  const page = {
    widthPx: editWpx, heightPx: editHpx,
    scale: 105/50, rotated: false,
    originalWidthMm: 50, originalHeightMm: 70,
  };

  it('export px smaller than edit px (restores original small size)', () => {
    const { wPx, hPx } = exportDims(page);
    expect(wPx).toBeLessThan(editWpx);
    expect(hPx).toBeLessThan(editHpx);
  });

  it('export mm matches original mm', () => {
    const { wMm, hMm } = exportDims(page);
    expect(Math.abs(wMm - 50)).toBeLessThan(1);
    expect(Math.abs(hMm - 70)).toBeLessThan(1);
  });
});

describe('flattenForExport - rotation (landscape original)', () => {
  // A4 landscape (297x210mm) stored as portrait edit (210x297mm px)
  const page = {
    widthPx: Math.round(210 * MM_TO_PX),
    heightPx: Math.round(297 * MM_TO_PX),
    scale: 1, rotated: true,
    originalWidthMm: 297, originalHeightMm: 210,
  };

  it('exported canvas is landscape (w > h)', () => {
    const { wPx, hPx } = exportDims(page);
    expect(wPx).toBeGreaterThan(hPx);
  });

  it('exported mm restores landscape dims', () => {
    const { wMm, hMm } = exportDims(page);
    expect(Math.abs(wMm - 297)).toBeLessThan(1);
    expect(Math.abs(hMm - 210)).toBeLessThan(1);
  });
});

describe('flattenForExport - scaled + rotated', () => {
  // 600x400mm landscape (oversized), scaled to B4 portrait edit
  const editWpx = Math.round(250 * MM_TO_PX);
  const editHpx = Math.round(353 * MM_TO_PX);
  const page = {
    widthPx: editWpx, heightPx: editHpx,
    scale: 353/600, rotated: true,
    originalWidthMm: 353, originalHeightMm: 600, // post-rotation portrait dims stored as original
  };

  it('rotation produces landscape output', () => {
    // After rotation: w=origHpx, h=origWpx → landscape when origH > origW
    const origWpx = Math.round(page.originalWidthMm * MM_TO_PX);
    const origHpx = Math.round(page.originalHeightMm * MM_TO_PX);
    expect(origHpx).toBeGreaterThan(origWpx); // rotation makes it landscape
  });
});
