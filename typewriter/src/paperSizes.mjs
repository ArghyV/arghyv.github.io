// Portrait [width_mm, height_mm] — ISO 216 / ANSI Y14.1
export const PAPER_SIZES = {
  B4:         [250, 353],
  Legal:      [216, 356],
  A4:         [210, 297],
  Letter:     [216, 279],
  A5:         [148, 210],
  HalfLetter: [140, 216],
  A6:         [105, 148],
};

// Sorted largest → smallest by area (B4=88250 … A6=15540)
export const SIZE_ORDER = ['B4', 'Legal', 'A4', 'Letter', 'A5', 'HalfLetter', 'A6'];

export const MM_TO_PX = 96 / 25.4; // 96 dpi
export const PX_TO_MM = 25.4 / 96;

export function mmToPx(mm) { return Math.round(mm * MM_TO_PX); }

export function getSizePx(name) {
  const [w, h] = PAPER_SIZES[name];
  return { w: mmToPx(w), h: mmToPx(h) };
}

// Returns { sizeName, scale, rotated, needsWarning }
// scale === 1  → page fits a named size without scaling
// rotated      → original was landscape; rotated to portrait for editing
export function resolveImportedSize(widthMm, heightMm) {
  const rotated = widthMm > heightMm;
  const pw = rotated ? heightMm : widthMm; // portrait width
  const ph = rotated ? widthMm  : heightMm;
  const area = pw * ph;

  const [maxW, maxH] = PAPER_SIZES['B4'];
  const [minW, minH] = PAPER_SIZES['A6'];
  const maxArea = maxW * maxH;
  const minArea = minW * minH;

  // Out-of-range: scale to boundary size
  if (area > maxArea) {
    const scale = Math.min(maxW / pw, maxH / ph);
    return { sizeName: 'B4', scale, rotated, needsWarning: true };
  }
  if (area < minArea) {
    const scale = Math.min(minW / pw, minH / ph);
    return { sizeName: 'A6', scale, rotated, needsWarning: true };
  }

  // In-range: find nearest named size by area difference
  let nearest = SIZE_ORDER[0], minDiff = Infinity;
  for (const name of SIZE_ORDER) {
    const [sw, sh] = PAPER_SIZES[name];
    const diff = Math.abs(sw * sh - area);
    if (diff < minDiff) { minDiff = diff; nearest = name; }
  }
  return { sizeName: nearest, scale: 1, rotated, needsWarning: false };
}
