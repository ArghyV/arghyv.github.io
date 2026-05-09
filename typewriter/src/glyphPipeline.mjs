// Glyph stamp pipeline: keypress -> offscreen canvas -> composite onto edit canvas
// Text is NEVER stored as strings. Each stamp is pixels.

export const FONTS = {
  'prestige': { family: '"Courier Prime", "Courier New", monospace', label: 'Prestige Elite' },
  'gothic':   { family: '"Anonymous Pro", "Lucida Console", monospace', label: 'Letter Gothic' },
  'univers':  { family: '"Tex Gyre Heros", "Helvetica Neue", sans-serif', label: 'Univers' },
  'bembo':    { family: '"EB Garamond", "Garamond", serif', label: 'Bembo' },
};

export const FONT_SIZES = { small: 10, large: 12 };

// Almost-black purple: typewriter ribbon color
export const INK_COLOR = '#1a1225';

// Measure char dimensions for a given font config at 96dpi
export function measureChar(fontFamily, ptSize, ctx) {
  const pxSize = ptSize * (96 / 72);
  ctx.font = `${pxSize}px ${fontFamily}`;
  const m = ctx.measureText('M'); // em-square proxy
  const w = Math.ceil(m.width);
  const h = Math.ceil(pxSize * 1.2); // line height ~1.2em
  return { w, h, pxSize };
}

// Stamp a single glyph onto destCtx at (x, y) in page-local coords
// Uses offscreen canvas for isolation
// topPad: vertical offset (px) so glyph sits inside cursor border, not clipped at top.
// Pass state.topPad from measureCharCell; defaults to 0 for backward compat.
export function stampGlyph(char, fontFamily, pxSize, destCtx, x, y, charW, charH, clipRect, topPad = 0) {
  const off = new OffscreenCanvas(charW, charH);
  const offCtx = off.getContext('2d');
  offCtx.clearRect(0, 0, charW, charH);
  offCtx.font = `${pxSize}px ${fontFamily}`;
  offCtx.fillStyle = INK_COLOR;
  offCtx.textBaseline = 'alphabetic';
  const m = offCtx.measureText(char);
  const xOff = Math.round((charW - m.width) / 2);
  // Place baseline at topPad + ascent so glyph is vertically centered in cell
  const ascent = m.actualBoundingBoxAscent ?? pxSize * 0.8;
  offCtx.fillText(char, xOff, topPad + ascent);

  if (clipRect) {
    destCtx.save();
    destCtx.beginPath();
    destCtx.rect(clipRect.x, clipRect.y, clipRect.w, clipRect.h);
    destCtx.clip();
  }
  destCtx.drawImage(off, x, y);
  if (clipRect) destCtx.restore();
}

// Paint a correction rectangle (erase area) on edit canvas
// mode: 'erase' (white), 'highlight' (semi-transparent yellow), 'ink' (opaque black)
export function paintCorrection(destCtx, x, y, w, h, mode) {
  const colors = {
    erase:     { color: '#fefcf5', alpha: 1.0 },   // paper-white (slightly warm)
    highlight: { color: '#ffe066', alpha: 0.45 },  // semi-transparent yellow
    ink:       { color: '#000000', alpha: 1.0 },
  };
  const { color, alpha } = colors[mode] || colors.erase;
  destCtx.save();
  destCtx.globalAlpha = alpha;
  destCtx.fillStyle = color;
  destCtx.fillRect(x, y, w, h);
  destCtx.restore();
}

// Flatten background + edit canvas into a single ImageData (for export)
// Returns a new OffscreenCanvas
export function flattenLayers(bgCanvas, editCanvas, pageW, pageH) {
  const out = new OffscreenCanvas(pageW, pageH);
  const ctx = out.getContext('2d');
  ctx.drawImage(bgCanvas, 0, 0);
  ctx.drawImage(editCanvas, 0, 0);
  return out;
}

// Measure char cell with padding to avoid clipping ascenders/descenders.
// Returns { w, h, topPad, pxSize } where topPad is extra vertical space above baseline.
export function measureCharCell(fontFamily, ptSize, ctx) {
  const pxSize = ptSize * (96 / 72);
  ctx.font = `${pxSize}px ${fontFamily}`;
  const m = ctx.measureText('M');
  // Use bounding box metrics when available; ensure minimum covers full em
  const ascent  = Math.max(m.actualBoundingBoxAscent  ?? 0, pxSize * 0.8);
  const descent = Math.max(m.actualBoundingBoxDescent ?? 0, pxSize * 0.25);
  // 25% padding top/bottom so diacritics and descenders never clip cursor border
  const topPad    = Math.ceil(pxSize * 0.15);
  const bottomPad = Math.ceil(pxSize * 0.15);
  const w = Math.ceil(m.width * 1.1); // extra width for italic overhang
  const h = Math.ceil(ascent + descent + topPad + bottomPad);
  return { w, h, topPad, pxSize };
}
