// Cursor state: viewport-fixed height, x moves left/right
// Paper state: scrolls up/down, cursor height stays fixed
// marginLeft/marginRight are in page-local px coords

export function createCursorState({
  viewportWidth, viewportHeight,
  pageWidthPx, pageHeightPx,
  charWidthPx, charHeightPx,
}) {
  const initialPaperY = Math.round(viewportHeight * (2/3));
  const cursorViewportY = initialPaperY;
  const pageX = Math.round((viewportWidth - pageWidthPx) / 2);
  return {
    cursorX: pageX,
    cursorViewportY,
    paperY: initialPaperY,
    pageX,
    pageWidthPx,
    pageHeightPx,
    charWidthPx,
    charHeightPx,
    marginLeft: 0,
    marginRight: pageWidthPx,
    viewportWidth,
    viewportHeight,
  };
}

export function moveLeft(state) {
  const minX = state.pageX + state.marginLeft;
  return { ...state, cursorX: Math.max(minX, state.cursorX - state.charWidthPx) };
}

export function moveRight(state) {
  const maxX = state.pageX + state.marginRight - state.charWidthPx;
  return { ...state, cursorX: Math.min(maxX, state.cursorX + state.charWidthPx) };
}

export function scrollUp(state) {
  const minPaperY = state.viewportHeight * 0.25 - state.pageHeightPx + 1;
  return { ...state, paperY: Math.max(minPaperY, state.paperY - state.charHeightPx) };
}

export function scrollDown(state) {
  const maxPaperY = state.viewportHeight * 0.75;
  return { ...state, paperY: Math.min(maxPaperY, state.paperY + state.charHeightPx) };
}

// Carriage return: scroll paper up one line AND reset cursor to left margin (typewriter CR)
export function carriageReturn(state) {
  const scrolled = scrollUp(state);
  return { ...scrolled, cursorX: state.pageX + state.marginLeft };
}

export function setMarginLeft(state, pageLocalX) {
  const clamped = Math.max(0, Math.min(pageLocalX, state.marginRight - state.charWidthPx));
  const minCursorX = state.pageX + clamped;
  const cursorX = state.cursorX < minCursorX ? minCursorX : state.cursorX;
  return { ...state, marginLeft: clamped, cursorX };
}

export function setMarginRight(state, pageLocalX) {
  const clamped = Math.max(state.marginLeft + state.charWidthPx, Math.min(pageLocalX, state.pageWidthPx));
  const maxCursorX = state.pageX + clamped - state.charWidthPx;
  const cursorX = state.cursorX > maxCursorX ? maxCursorX : state.cursorX;
  return { ...state, marginRight: clamped, cursorX };
}

export function advanceCursor(state) { return moveRight(state); }

export function cursorPageLocal(state) {
  return { x: state.cursorX - state.pageX, y: state.cursorViewportY - state.paperY };
}

export function cursorOnPage(state) {
  const { x, y } = cursorPageLocal(state);
  return x >= 0 && y >= 0
    && x + state.charWidthPx <= state.pageWidthPx
    && y + state.charHeightPx <= state.pageHeightPx;
}

export function cursorPartiallyOnPage(state) {
  const { x, y } = cursorPageLocal(state);
  return (x + state.charWidthPx > 0) && (y + state.charHeightPx > 0)
    && x < state.pageWidthPx && y < state.pageHeightPx;
}

// Multi-page scroll: lower bound uses totalStackHeightPx instead of single pageHeightPx.
// totalStackHeightPx = sum of all page heights + gaps (computed from layouts in index.html).
export function scrollUpMulti(state, totalStackHeightPx) {
  const minPaperY = state.viewportHeight * 0.25 - totalStackHeightPx + 1;
  return { ...state, paperY: Math.max(minPaperY, state.paperY - state.charHeightPx) };
}

export function scrollDownMulti(state) {
  return scrollDown(state);
}
