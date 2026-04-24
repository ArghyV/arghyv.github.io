// Page model — dual OffscreenCanvas (bg + edit), immutable page-stack operations

const PAPER_WHITE = '#fefcf5';

export function createPage(widthPx, heightPx, bgImageBitmap = null) {
  const bgCanvas   = new OffscreenCanvas(widthPx, heightPx);
  const editCanvas = new OffscreenCanvas(widthPx, heightPx);
  const bgCtx      = bgCanvas.getContext('2d');

  if (bgImageBitmap) {
    bgCtx.drawImage(bgImageBitmap, 0, 0, widthPx, heightPx);
  } else {
    bgCtx.fillStyle = PAPER_WHITE;
    bgCtx.fillRect(0, 0, widthPx, heightPx);
  }

  return {
    widthPx, heightPx,
    bgCanvas, editCanvas,
    // Export round-trip metadata
    originalWidthMm:  null,
    originalHeightMm: null,
    rotated: false,
    scale:   1,
  };
}

export function addPageAfter(pages, index) {
  const ref     = pages[index] ?? pages[pages.length - 1];
  const newPage = Object.assign(createPage(ref.widthPx, ref.heightPx), {
    originalWidthMm:  ref.originalWidthMm,
    originalHeightMm: ref.originalHeightMm,
    rotated: ref.rotated,
    scale:   ref.scale,
  });
  return [...pages.slice(0, index + 1), newPage, ...pages.slice(index + 1)];
}

export function deletePage(pages, index) {
  if (pages.length <= 1) return pages;
  return pages.filter((_, i) => i !== index);
}

// Index of the page whose centre is nearest to cursorViewportY
export function nearestPageIndex(pageLayouts, cursorViewportY) {
  let best = 0, bestDist = Infinity;
  for (let i = 0; i < pageLayouts.length; i++) {
    const { y, h } = pageLayouts[i];
    const dist = Math.abs(y + h / 2 - cursorViewportY);
    if (dist < bestDist) { bestDist = dist; best = i; }
  }
  return best;
}

// Layout: pages stacked vertically, centred horizontally, separated by gap px
export function computePageLayouts(pages, paperY, viewportWidth, gap = 40) {
  let y = paperY;
  return pages.map(page => {
    const x = Math.round((viewportWidth - page.widthPx) / 2);
    const layout = { x, y, w: page.widthPx, h: page.heightPx };
    y += page.heightPx + gap;
    return layout;
  });
}
