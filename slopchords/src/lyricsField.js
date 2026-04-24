// lyricsField.js
// Owns the lyrics textarea state and input pipeline.
// Exports createLyricsField({ onTokens, onError }) → field API
// DOM wiring (textarea, drag-drop events) is in mountLyricsField() called from index.html.
// The core logic is DOM-free so it can be unit tested in Node.

import { tokenise } from './tokeniser.js'

// ─── createLyricsField ────────────────────────────────────────────────────────
// Factory for the lyrics field logic unit.
// onTokens(tokens[]) — called whenever text changes and re-parses cleanly
// onError(message)   — called on invalid input (non-text file, etc.)

export function createLyricsField({ onTokens, onError = () => {} }) {
  let _text = ''
  let _tokens = []

  function parse(text) {
    _text = text
    _tokens = tokenise(text)
    onTokens(_tokens)
  }

  // ── Public API (test surface + DOM bridge) ─────────────────────────────────

  function setValue(text) {
    parse(text)
  }

  function getValue() {
    return _text
  }

  // Called by layout field when it mutates tokens (chord labels, offsetX, splits).
  // Must NOT re-fire onTokens to avoid feedback loop.
  function setTokens(tokens) {
    _tokens = tokens
    // Reconstruct canonical text from tokens so getValue() stays consistent.
    _text = tokensToText(tokens)
    // Do not call onTokens.
  }

  function getTokens() {
    return _tokens
  }

  // ── Paste ──────────────────────────────────────────────────────────────────

  function simulatePaste(text) {
    parse(text)
  }

  // ── Drop ──────────────────────────────────────────────────────────────────
  // file: { type: string, content: string }
  // In real DOM this comes from DataTransfer; here it's a plain object for testing.

  async function simulateDrop(file) {
    const { type, content } = file

    // Saved slopchords JSON
    if (type === 'application/json' || type === 'text/plain' && content.trimStart().startsWith('{')) {
      return handleJson(content)
    }

    if (!type.startsWith('text/')) {
      onError(`Cannot import file of type "${type}". Only plain text files are supported.`)
      return
    }

    parse(content)
  }

  function handleJson(content) {
    let parsed
    try { parsed = JSON.parse(content) } catch {
      onError('File is not valid JSON.')
      return
    }
    if (!parsed.__slopchords) {
      onError('JSON file is not a SlopChords save file.')
      return
    }
    // Restore from saved state — bypass re-parse, set tokens directly with their chords/offsetX
    _tokens = parsed.tokens
    _text = tokensToText(_tokens)
    onTokens(_tokens)
  }

  return { setValue, getValue, setTokens, getTokens, simulatePaste, simulateDrop }
}

// ─── DOM mounting ─────────────────────────────────────────────────────────────
// Called from index.html with a real textarea element.
// Returns the field API so the app can call setValue / setTokens.

export function mountLyricsField(textarea, { onTokens, onError = () => {} }) {
  const field = createLyricsField({ onTokens, onError })

  // Debounce helper
  let debounceTimer = null
  function debounce(fn, ms = 120) {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(fn, ms)
  }

  // Input: live re-parse on every keystroke (debounced)
  textarea.addEventListener('input', () => {
    debounce(() => field.setValue(textarea.value))
  })

  // Paste: use the pasted text directly
  textarea.addEventListener('paste', e => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    textarea.value = text
    field.simulatePaste(text)
  })

  // Drag-drop onto the textarea
  textarea.addEventListener('dragover', e => e.preventDefault())
  textarea.addEventListener('drop', async e => {
    e.preventDefault()
    const dt = e.dataTransfer
    const file = dt.files[0]
    if (file) {
      const content = await file.text()
      await field.simulateDrop({ type: file.type || 'text/plain', content })
      textarea.value = field.getValue()
    } else {
      // Dragged text (not a file)
      const text = dt.getData('text/plain')
      textarea.value = text
      field.simulatePaste(text)
    }
  })

  // Wrap setValue so textarea stays in sync
  const origSetValue = field.setValue.bind(field)
  field.setValue = text => {
    origSetValue(text)
    textarea.value = field.getValue()
  }

  return field
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Reconstruct plaintext from token array (round-trip for setTokens → getValue).
// Chord labels and offsetX are not encoded in the text — they live in tokens only.
function tokensToText(tokens) {
  let out = ''
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]
    if (tok.type === 'word') {
      if (out && !out.endsWith('\n') && !out.endsWith('\f')) out += ' '
      out += tok.text
    } else if (tok.type === 'barline') {
      // Attach | to preceding word or emit standalone
      if (out && !out.endsWith(' ') && !out.endsWith('\n')) out += '|'
      else out += '|'
    } else if (tok.type === 'linebreak') {
      out += '\n'
    } else if (tok.type === 'parabreak') {
      out += '\n\n'
    } else if (tok.type === 'pagebreak') {
      out += '\f'
    }
  }
  return out
}
