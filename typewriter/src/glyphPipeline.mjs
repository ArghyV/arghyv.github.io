// Glyph stamp pipeline — text is pixels, never strings

export const FONTS = {
  prestige: { family: '"Courier Prime", "Courier New", monospace',    label: 'Courier Prime' },
  gothic:   { family: '"Anonymous Pro", "Lucida Console", monospace', label: 'Anonymous Pro' },
  univers:  { family: '"Arimo", "Arial", sans-serif',                 label: 'Arimo' },
  bembo:    { family: '"EB Garamond", "Garamond", serif',             label: 'EB Garamond' },
};

export const FONT_SIZES = { small: 10, large: 12 };

export const INK_COLOR = '#1a1225'; // near-black purple — typewriter ribbon

const PT_TO_PX = 96 / 72; // 96 dpi screen, 72 pt/inch

// Returns { w, h, pxSize } for a font at a given pt size
export function measureChar(fontFamily, ptSize, ctx) {
  const pxSize = ptSize * PT_TO_PX;
  ctx.font = `${pxSize}px ${fontFamily}`;
  return {
    w: Math.ceil(ctx.measureText('M').width),
    h: Math.ceil(pxSize * 1.2), // 1.2em line height
    pxSize,
  };
}

// Rasterise one glyph onto destCtx at page-local (x, y).
// clipRect: optional {x,y,w,h} clip region (for partial-on-page rendering).
export function stampGlyph(char, fontFamily, ptSize, destCtx, x, y, charW, charH, clipRect) {
  const pxSize = ptSize * PT_TO_PX;
  const off    = new OffscreenCanvas(charW, charH);
  const ctx    = off.getContext('2d');
  ctx.font         = `${pxSize}px ${fontFamily}`;
  ctx.fillStyle    = INK_COLOR;
  ctx.textBaseline = 'top';
  const xOff = Math.round((charW - ctx.measureText(char).width) / 2);
  ctx.fillText(char, xOff, 0);

  if (clipRect) {
    destCtx.save();
    destCtx.beginPath();
    destCtx.rect(clipRect.x, clipRect.y, clipRect.w, clipRect.h);
    destCtx.clip();
  }
  destCtx.drawImage(off, x, y);
  if (clipRect) destCtx.restore();
}

// Paint correction rectangle onto edit canvas.
// mode: 'erase' | 'highlight' | 'ink'
export function paintCorrection(destCtx, x, y, w, h, mode) {
  const MODES = {
    erase:     { color: '#fefcf5', alpha: 1.0  },
    highlight: { color: '#ffe066', alpha: 0.45 },
    ink:       { color: '#000000', alpha: 1.0  },
  };
  const { color, alpha } = MODES[mode] ?? MODES.erase;
  destCtx.save();
  destCtx.globalAlpha = alpha;
  destCtx.fillStyle   = color;
  destCtx.fillRect(x, y, w, h);
  destCtx.restore();
}

// Flatten bg + edit into a new OffscreenCanvas (for export / print)
export function flattenLayers(bgCanvas, editCanvas, pageW, pageH) {
  const out = new OffscreenCanvas(pageW, pageH);
  const ctx = out.getContext('2d');
  ctx.drawImage(bgCanvas,   0, 0);
  ctx.drawImage(editCanvas, 0, 0);
  return out;
}
