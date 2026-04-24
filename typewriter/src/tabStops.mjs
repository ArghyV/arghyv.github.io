// Tab stops — sorted array of page-local x positions (px), per-document

export function createTabStops() { return []; }

// Toggle: remove stop within snapPx of x; otherwise insert (sorted)
export function toggleTabStop(stops, x, snapPx = 4) {
  const idx = stops.findIndex(s => Math.abs(s - x) <= snapPx);
  if (idx !== -1) return stops.filter((_, i) => i !== idx);
  return [...stops, x].sort((a, b) => a - b);
}

// First stop strictly right of cursorX; null if none
export function nextTabStop(stops, cursorX) {
  for (const s of stops) if (s > cursorX) return s;
  return null;
}

// Advance to next stop, or rightMarginX if none ahead
export function tabAdvance(stops, cursorX, rightMarginX) {
  const next = nextTabStop(stops, cursorX);
  return next !== null ? next : rightMarginX;
}
