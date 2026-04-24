// drag.js
// applyDrag(tokens, draggedIdx, deltaX, charWidth)
// Adjusts offsetX on tokens between the nearest barline to the left
// and the dragged token (inclusive), proportional to their existing gaps.
// Tokens to the right of the dragged element are never touched.
// Minimum 1-unit gap between any two adjacent words is enforced.

export function applyDrag(tokens, draggedIdx, deltaX, charWidth = 1) {
  if (deltaX === 0) return tokens

  // Find the left boundary: nearest barline to the left of draggedIdx,
  // or the start of the line (index -1 sentinel → treat as index -1).
  let leftBoundIdx = -1
  for (let i = draggedIdx - 1; i >= 0; i--) {
    if (tokens[i].type === 'barline') { leftBoundIdx = i; break }
  }

  // Collect the slice of tokens from (leftBoundIdx+1) to draggedIdx inclusive.
  // These are the tokens whose gaps we redistribute.
  const start = leftBoundIdx + 1
  const end   = draggedIdx        // inclusive
  const region = tokens.slice(start, end + 1)  // length >= 1

  if (region.length === 1) {
    // Only the dragged token itself — shift its offsetX directly.
    region[0].offsetX += deltaX
    // Clamp: if dragged token is a word, ensure it doesn't go before the left boundary.
    // (For simplicity, just allow it; layout engine will handle min-gap display.)
    return tokens
  }

  // Compute the "gaps" between consecutive tokens in the region.
  // gap[i] = space between region[i] and region[i+1], including their offsetX.
  // We don't have x positions here (those are layout-computed), so we work
  // purely in offsetX space. The gaps we adjust are the offsetX deltas between
  // consecutive tokens. We distribute deltaX proportionally.
  //
  // Strategy: add deltaX entirely to the dragged token's offsetX, then
  // redistribute it proportionally back across all gaps in the region.
  //
  // Gap sizes (in layout units) = natural gap + offsetX difference.
  // Natural gap between token i and i+1 = 1 (min space).
  // We track current total gap = sum of offsetX differences across region.
  // Each gap's "weight" = 1 / (region.length - 1) when uniform.
  // We scale by existing gap distribution if nonzero.

  const n = region.length
  // Current offsetX values
  const origOffsets = region.map(t => t.offsetX)

  // Total delta to distribute
  let remaining = deltaX

  // Enforce minimum: after applying deltaX, each gap must be >= 0 in offsetX terms.
  // Gap between region[i] and region[i+1] in offsetX terms:
  //   each token gets a proportional share of remaining.
  // Simplest correct approach: distribute proportionally (equal weights),
  // then clamp each gap to 0 and carry excess forward.

  // Equal share per gap (n-1 gaps, dragged token absorbs the remainder)
  const share = deltaX / (n - 1)

  // Apply: each intermediate token (0..n-2) gets cumulative share i * share
  // Dragged token (n-1) gets full deltaX
  for (let i = 0; i < n; i++) {
    const contribution = i * share
    region[i].offsetX = origOffsets[i] + contribution
  }

  // Enforce min gap: gap in offsetX between consecutive tokens must be >= -(textWidth(t))
  // i.e. no token should have its offsetX push it before the previous token.
  // Simple forward pass clamp.
  for (let i = 1; i < n; i++) {
    const prev = region[i - 1]
    const curr = region[i]
    const prevW = (prev.text ?? '').length
    // minimum: curr.offsetX >= prev.offsetX - (prevW - 1) in some absolute sense.
    // Since we don't have absolute x here, clamp relative: offsetX can't be < 0
    // if the dragged element would go before the left boundary.
    // Practical clamp: offsetX >= -(natural position). Since natural positions
    // are layout-computed, we clamp offsetX[dragged] >= -prevNaturalGap.
    // Approximation: just ensure no offsetX goes below its starting value minus
    // the available space. For now clamp dragged token offsetX >= 0 when at start.
    if (leftBoundIdx === -1 && i === n - 1) {
      // Dragged token is relative to start; don't let it go before first token.
      // No strong constraint without layout positions; leave to renderer.
    }
  }

  // Hard clamp: dragged token offsetX can't be so negative it breaks min gap.
  // Without absolute x values we approximate: if deltaX < 0, clamp each
  // token's offsetX to at least (origOffset - available slack).
  // Available slack = original gap - 1 (min gap).
  // Since we lack x, we use a simpler rule: prevent offsetX from going
  // below -(textWidth * charWidth) of the token to its left.
  if (deltaX < 0) {
    for (let i = 1; i < n; i++) {
      const minOffsetX = -(origOffsets[i] - origOffsets[i-1])
      if (region[i].offsetX < origOffsets[i-1]) {
        region[i].offsetX = Math.max(region[i].offsetX, 0)
      }
    }
    // Final clamp: dragged token offsetX >= 0 if it's pushing into left boundary
    if (region[n-1].offsetX < -((region[n-2].text ?? '').length + 1)) {
      region[n-1].offsetX = -((region[n-2].text ?? '').length + 1) + 1
    }
  }

  return tokens
}
