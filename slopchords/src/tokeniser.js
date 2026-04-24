// tokeniser.js
// plaintext → token[]
// token: { type: 'word'|'barline'|'linebreak'|'parabreak'|'pagebreak', text?, chord, offsetX }

const DEFAULTS = { chord: '', offsetX: 0 }
const mkWord = text => ({ type: 'word', text, ...DEFAULTS })
const mkBreak = type => ({ type, ...DEFAULTS })

// Split a single non-whitespace chunk (may contain | and internal hyphens) into tokens.
// chunk has no surrounding whitespace, no \n, no \f.
// leftIsSpace: true if preceded by whitespace (or start of input)
// rightIsSpace: true if followed by whitespace (or end of input)
function chunkToTokens(chunk, leftIsSpace, rightIsSpace) {
  // First split on | to extract barlines
  const parts = chunk.split('|')
  const tokens = []
  for (let i = 0; i < parts.length; i++) {
    if (i > 0) tokens.push(mkBreak('barline'))
    const part = parts[i]
    if (!part) continue
    // Only split on internal hyphen when:
    // - not adjacent to another hyphen (no --)
    // - hyphen is internal (not first or last char of the part)
    // - the part is not the whole chunk's leading/trailing position
    //   (hyphen with space on one side only → don't split)
    tokens.push(...splitHyphen(part, leftIsSpace && i === 0, rightIsSpace && i === parts.length - 1))
  }
  return tokens
}

// Split a bar-segment on internal hyphens.
// leftIsSpace / rightIsSpace refer to the original whitespace context (used only for leading/trailing hyphens).
function splitHyphen(part, leftIsSpace, rightIsSpace) {
  // No split if contains adjacent hyphens
  if (/--/.test(part)) return [mkWord(part)]

  // Find candidate internal hyphens (not at index 0, not at last index)
  // A hyphen is "internal" only if it has a non-hyphen char on both sides within this part.
  // Hyphens at position 0: only split if leftIsSpace is false (attached to previous word without space)
  //   but plan says "hyphen with space on only one side does not split" → position 0 with leftIsSpace means it looks like " -foo" which is a word "-foo", not a split.
  // Hyphens at last position: similarly.
  // So: only split hyphens that are strictly internal (index > 0 && index < part.length-1).

  const result = []
  let cursor = 0
  for (let i = 1; i < part.length - 1; i++) {
    if (part[i] === '-' && part[i-1] !== '-' && part[i+1] !== '-') {
      result.push(mkWord(part.slice(cursor, i)))
      result.push(mkWord('-'))
      cursor = i + 1
    }
  }
  result.push(mkWord(part.slice(cursor)))
  return result
}

export function tokenise(input) {
  if (typeof input !== 'string') throw new TypeError('tokenise: input must be a string')

  // Normalise \r\n and \r to \n, \f stays as pagebreak marker
  const normalised = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  const tokens = []

  // Split into segments: either a run of \n (breaks) or \f (pagebreak) or non-break text.
  // We process character by character accumulating words and breaks.
  let i = 0
  const len = normalised.length

  // We'll collect text runs between breaks, then parse each run for words/bars/hyphens.
  function flushTextRun(run, prevCharIsBreak, nextCharIsBreak) {
    // run is a string with no \n or \f; may have spaces, |, hyphens
    // Split into whitespace-separated chunks
    const chunks = run.split(/(\s+)/)
    // chunks alternates: text, space, text, space ...  (split with capture keeps separators)
    for (let ci = 0; ci < chunks.length; ci++) {
      const chunk = chunks[ci]
      if (!chunk) continue
      if (/^\s+$/.test(chunk)) continue // whitespace separator, skip
      const leftIsSpace = ci === 0 ? prevCharIsBreak || /^\s/.test(run) || run[0] === ' ' || (ci > 0)
                                   : true // preceded by a whitespace chunk
      // leftIsSpace: true if this chunk is preceded by whitespace or is at start after a break
      const leftCtx = ci === 0 ? (prevCharIsBreak || /^\s/.test(run)) : true
      const rightCtx = ci === chunks.length - 1 ? (nextCharIsBreak || /\s$/.test(run)) : true
      tokens.push(...chunkToTokens(chunk, leftCtx, rightCtx))
    }
  }

  // Simpler approach: tokenise break structure first, then parse text runs.
  // Segment types: 'text' | 'linebreak' | 'parabreak' | 'pagebreak'
  const segments = []
  let textBuf = ''

  function pushText() {
    if (textBuf) { segments.push({ kind: 'text', value: textBuf }); textBuf = '' }
  }

  let j = 0
  while (j < len) {
    const ch = normalised[j]
    if (ch === '\f') {
      pushText(); segments.push({ kind: 'pagebreak' }); j++
    } else if (ch === '\n') {
      // Count consecutive newlines
      let count = 0
      while (j < len && normalised[j] === '\n') { count++; j++ }
      pushText()
      segments.push({ kind: count >= 2 ? 'parabreak' : 'linebreak' })
    } else {
      textBuf += ch; j++
    }
  }
  pushText()

  // Now parse each text segment for words, bars, hyphens
  for (let si = 0; si < segments.length; si++) {
    const seg = segments[si]
    if (seg.kind !== 'text') {
      tokens.push(mkBreak(seg.kind))
      continue
    }
    const prevIsBreak = si === 0 || segments[si-1].kind !== 'text'
    const nextIsBreak = si === segments.length - 1 || segments[si+1].kind !== 'text'
    parseTextRun(seg.value, prevIsBreak, nextIsBreak, tokens)
  }

  return tokens
}

function parseTextRun(run, prevIsBreak, nextIsBreak, tokens) {
  // Split on whitespace, keeping track of position to know left/right context per chunk
  // We iterate over matches of non-whitespace chunks
  const re = /\S+/g
  let match
  let chunkIndex = 0
  const allChunks = [...run.matchAll(/\S+/g)]

  for (let ci = 0; ci < allChunks.length; ci++) {
    const m = allChunks[ci]
    const chunk = m[0]
    const startIndex = m.index
    const endIndex = startIndex + chunk.length

    // leftIsSpace: true if preceded by whitespace or by a break (start of run after break)
    const leftIsSpace = startIndex === 0 ? prevIsBreak : true  // always true if not at index 0 (whitespace between chunks)
    // At index 0 with prevIsBreak=false: the run starts immediately after another text segment (shouldn't happen after our segmentation, but be safe)
    const rightIsSpace = endIndex === run.length ? nextIsBreak : true

    tokens.push(...chunkToTokens(chunk, leftIsSpace, rightIsSpace))
  }
}
