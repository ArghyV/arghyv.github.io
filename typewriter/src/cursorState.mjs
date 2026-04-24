// Cursor state — pure functions, no side effects
// cursorX / cursorViewportY: viewport coords of cursor top-left
// paperY: viewport Y of page top edge (scrolls; cursorViewportY is fixed)
// marginLeft / marginRight: page-local px from page left edge

export function createCursorState({
  viewportWidth, viewportHeight,
  pageWidthPx, pageHeightPx,
  charWidthPx, charHeightPx,
}) {
  const paperY         = Math.round(viewportHeight * (2 / 3));
  const cursorViewportY = paperY;
  const pageX           = Math.round((viewportWidth - pageWidthPx) / 2);
  return {
    cursorX: pageX, cursorViewportY,
    paperY,
    pageX, pageWidthPx, pageHeightPx,
    charWidthPx, charHeightPx,
    marginLeft: 0, marginRight: pageWidthPx,
    viewportWidth, viewportHeight,
  };
}

export function moveLeft(s) {
  return { ...s, cursorX: Math.max(s.pageX + s.marginLeft, s.cursorX - s.charWidthPx) };
}

export function moveRight(s) {
  return { ...s, cursorX: Math.min(s.pageX + s.marginRight - s.charWidthPx, s.cursorX + s.charWidthPx) };
}

export function scrollUp(s) {
  // Paper moves up (paperY decreases). Clamp: ≥1 char of page must remain visible at 25% vh.
  const min = s.viewportHeight * 0.25 - s.pageHeightPx + s.charHeightPx;
  return { ...s, paperY: Math.max(min, s.paperY - s.charHeightPx) };
}

export function scrollDown(s) {
  // Paper moves down. Clamp: top of page ≤ 75% vh.
  return { ...s, paperY: Math.min(s.viewportHeight * 0.75, s.paperY + s.charHeightPx) };
}

export function setMarginLeft(s, pageLocalX) {
  const clamped  = Math.max(0, Math.min(pageLocalX, s.marginRight - s.charWidthPx));
  const cursorX  = Math.max(s.pageX + clamped, s.cursorX);
  return { ...s, marginLeft: clamped, cursorX };
}

export function setMarginRight(s, pageLocalX) {
  const clamped  = Math.max(s.marginLeft + s.charWidthPx, Math.min(pageLocalX, s.pageWidthPx));
  const cursorX  = Math.min(s.pageX + clamped - s.charWidthPx, s.cursorX);
  return { ...s, marginRight: clamped, cursorX };
}

export function advanceCursor(s) { return moveRight(s); }

// Cursor top-left in page-local coordinates
export function cursorPageLocal(s) {
  return { x: s.cursorX - s.pageX, y: s.cursorViewportY - s.paperY };
}

export function cursorOnPage(s) {
  const { x, y } = cursorPageLocal(s);
  return x >= 0 && y >= 0
      && x + s.charWidthPx  <= s.pageWidthPx
      && y + s.charHeightPx <= s.pageHeightPx;
}

export function cursorPartiallyOnPage(s) {
  const { x, y } = cursorPageLocal(s);
  return x + s.charWidthPx > 0 && y + s.charHeightPx > 0
      && x < s.pageWidthPx && y < s.pageHeightPx;
}
