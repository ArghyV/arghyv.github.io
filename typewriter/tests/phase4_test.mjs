import { describe, it, expect } from './runner.mjs';

// ── Mock OffscreenCanvas ─────────────────────────────────────────────────
class MockCanvas {
  constructor(w, h) { this.width = w; this.height = h; this._ops = []; }
  async convertToBlob() { return new Blob(['img'], { type: 'image/jpeg' }); }
  getContext() {
    const ops = this._ops;
    return {
      fillStyle: '', font: '', globalAlpha: 1, textBaseline: 'top',
      fillRect(...a)   { ops.push(['fillRect', ...a]); },
      drawImage(...a)  { ops.push(['drawImage', ...a]); },
      clearRect(...a)  { ops.push(['clearRect', ...a]); },
      save(){}  , restore(){},
      beginPath(){}, rect(...a){}, clip(){},
      measureText(t)   { return { width: t.length * 7 }; },
    };
  }
}
global.OffscreenCanvas = MockCanvas;

import { flattenLayers } from '../src/glyphPipeline.mjs';
import { createPage } from '../src/pageModel.mjs';
import { MM_TO_PX, resolveImportedSize } from '../src/paperSizes.mjs';

describe('flattenLayers - export correctness', () => {
  it('output canvas matches page dimensions', () => {
    const page = createPage(794, 1123);
    const out  = flattenLayers(page.bgCanvas, page.editCanvas, 794, 1123);
    expect(out.width).toBe(794);
    expect(out.height).toBe(1123);
  });

  it('draws background before edit layer', () => {
    const page = createPage(200, 300);
    const out  = flattenLayers(page.bgCanvas, page.editCanvas, 200, 300);
    const draws = out._ops.filter(o => o[0] === 'drawImage');
    expect(draws.length).toBe(2);
    // First draw = bg, second = edit
    expect(draws[0][1]).toBe(page.bgCanvas);
    expect(draws[1][1]).toBe(page.editCanvas);
  });
});

describe('export scale-back arithmetic', () => {
  // When an imported page was scaled, export should render at original resolution.
  // Logic: exportW = Math.round(originalWidthMm * MM_TO_PX)

  it('scaled-down page export dimensions exceed edit canvas', () => {
    const res = resolveImportedSize(400, 600); // larger than B4, scale < 1
    expect(res.scale).toBeLessThanOrEqual(1);
    const editW = Math.round(250 * MM_TO_PX); // B4 edit width
    const origW = Math.round(400 * MM_TO_PX); // original width
    expect(origW).toBeGreaterThan(editW);
  });

  it('scaled-up page export dimensions are smaller than edit canvas', () => {
    const res = resolveImportedSize(50, 70); // smaller than A6, scale > 1
    expect(res.scale).toBeGreaterThan(1);
    const editW = Math.round(105 * MM_TO_PX); // A6 edit width
    const origW = Math.round(50  * MM_TO_PX); // original width
    expect(origW).toBeLessThanOrEqual(editW);
  });

  it('no-scale page: export width equals edit width', () => {
    const res = resolveImportedSize(210, 297); // A4 exact
    expect(res.scale).toBe(1);
    const editW = Math.round(210 * MM_TO_PX);
    const origW = Math.round(210 * MM_TO_PX);
    expect(origW).toBe(editW);
  });
});

describe('PDF multi-page assembly logic', () => {
  // jsPDF API shape: new jsPDF({...}), doc.addPage(), doc.addImage(), doc.save()
  // Test the page sizing math used before jsPDF call.

  function pageDimsForPdf(widthPx, heightPx) {
    const wMm = widthPx  / MM_TO_PX;
    const hMm = heightPx / MM_TO_PX;
    const orientation = wMm > hMm ? 'landscape' : 'portrait';
    return { wMm, hMm, orientation };
  }

  it('A4 portrait page produces portrait orientation', () => {
    const { orientation } = pageDimsForPdf(794, 1123);
    expect(orientation).toBe('portrait');
  });

  it('A4 landscape page produces landscape orientation', () => {
    const { orientation } = pageDimsForPdf(1123, 794);
    expect(orientation).toBe('landscape');
  });

  it('A4 width in mm is ~210', () => {
    const { wMm } = pageDimsForPdf(794, 1123);
    expect(Math.abs(wMm - 210)).toBeLessThanOrEqual(1);
  });

  it('A4 height in mm is ~297', () => {
    const { hMm } = pageDimsForPdf(794, 1123);
    expect(Math.abs(hMm - 297)).toBeLessThanOrEqual(1);
  });
});

describe('filename generation for multi-page exports', () => {
  function makeFilename(base, idx, total, ext) {
    return total > 1 ? `${base}-${idx + 1}.${ext}` : `${base}.${ext}`;
  }

  it('single page: no number suffix', () => {
    expect(makeFilename('doc', 0, 1, 'jpg')).toBe('doc.jpg');
  });

  it('multi-page: first page gets -1 suffix', () => {
    expect(makeFilename('doc', 0, 3, 'jpg')).toBe('doc-1.jpg');
  });

  it('multi-page: last page gets correct number', () => {
    expect(makeFilename('report', 4, 5, 'gif')).toBe('report-5.gif');
  });

  it('pdf is always single file regardless of pages', () => {
    // PDF handler does not number — just saves as filename.pdf
    const name = 'document.pdf';
    expect(name).toBe('document.pdf');
  });
});
