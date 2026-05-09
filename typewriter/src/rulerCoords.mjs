// Pure coordinate helpers for the top ruler.
// The ruler always spans B4 width (250mm) centered on the page's center X.
// All x values are in viewport pixels (canvas offsetX).

export const MM_TO_PX = 96 / 25.4;
export const B4_W_PX  = Math.round(250 * MM_TO_PX); // ~945px

// pageLeft  = viewport x of page left edge (layout.x)
// pageWidth = page width in px
export function rulerOrigin(pageLeft, pageWidth) {
  const pageCenterX = pageLeft + pageWidth / 2;
  return {
    rulerLeft:   pageCenterX - B4_W_PX / 2,
    pageCenterX,
  };
}

// Convert a ruler canvas click x → page-local px (0 = page left edge).
// rulerLeft: viewport x where ruler ticks begin (from rulerOrigin)
// pageLeft:  viewport x of page left edge
export function rulerXToPageLocal(clickX, rulerLeft, pageLeft) {
  return Math.round(clickX - pageLeft);
}

// Convert page-local px → ruler canvas x (for drawing markers at correct position).
export function pageLocalToRulerX(pageLocal, rulerLeft, pageLeft) {
  return pageLocal + pageLeft;
}

// Label value at a given ruler canvas x (centered on pageCenterX).
// Returns signed integer number of cm from page center.
export function rulerLabelAt(x, rulerLeft, pageCenterX, cmPx) {
  return Math.round((x - pageCenterX) / cmPx);
}
