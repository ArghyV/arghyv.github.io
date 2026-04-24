// persistence.js
// serialise(tokens) → JSON string
// deserialise(jsonString) → tokens[]

const FIELDS = ['type', 'text', 'chord', 'offsetX']

export function serialise(tokens) {
  const clean = tokens.map(tok => {
    const out = {}
    for (const f of FIELDS) if (f in tok) out[f] = tok[f]
    return out
  })
  return JSON.stringify({ __slopchords: true, version: 1, tokens: clean }, null, 2)
}

export function deserialise(jsonString) {
  let obj
  try { obj = JSON.parse(jsonString) } catch { throw new Error('Invalid JSON') }
  if (!obj.__slopchords) throw new Error('Not a SlopChords save file')
  return (obj.tokens ?? []).map(tok => ({
    type:    tok.type    ?? 'word',
    chord:   tok.chord   ?? '',
    offsetX: tok.offsetX ?? 0,
    ...(tok.text !== undefined ? { text: tok.text } : {}),
  }))
}
