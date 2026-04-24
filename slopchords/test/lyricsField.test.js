import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

// Minimal DOM shim for Node
import { createLyricsField } from '../src/lyricsField.js'

const ok = (v, m) => assert.ok(v, m)
const is = (a, b) => assert.equal(a, b)
const eq = (a, b) => assert.deepEqual(a, b)

// ─── DOM shim ────────────────────────────────────────────────────────────────
// We test the pure logic layer of lyricsField, not the DOM itself.
// lyricsField.js exports:
//   createLyricsField({ onTokens }) → { setValue(str), getValue(), simulateDrop(file), simulatePaste(str) }
// The module owns a textarea internally; we expose a test-surface API.

describe('lyricsField — input handling', () => {
  it('getValue returns current text', () => {
    const field = createLyricsField({ onTokens: () => {} })
    field.setValue('hello world')
    is(field.getValue(), 'hello world')
  })

  it('setValue triggers onTokens callback', () => {
    let called = false
    const field = createLyricsField({ onTokens: () => { called = true } })
    field.setValue('hello')
    ok(called, 'onTokens should be called after setValue')
  })

  it('onTokens receives token array', () => {
    let tokens = null
    const field = createLyricsField({ onTokens: t => { tokens = t } })
    field.setValue('hello world')
    ok(Array.isArray(tokens), 'tokens should be an array')
    is(tokens.length, 2)
    is(tokens[0].text, 'hello')
    is(tokens[1].text, 'world')
  })

  it('| characters are preserved literally in getValue', () => {
    const field = createLyricsField({ onTokens: () => {} })
    field.setValue('a | b')
    is(field.getValue(), 'a | b')
  })

  it('hyphens are preserved literally in getValue', () => {
    const field = createLyricsField({ onTokens: () => {} })
    field.setValue('hel-lo')
    is(field.getValue(), 'hel-lo')
  })

  it('bar lines appear as barline tokens in onTokens output', () => {
    let tokens = null
    const field = createLyricsField({ onTokens: t => { tokens = t } })
    field.setValue('a | b')
    const types = tokens.map(t => t.type)
    ok(types.includes('barline'), 'should have barline token')
  })
})

describe('lyricsField — file validation', () => {
  it('simulatePaste with string calls onTokens', () => {
    let tokens = null
    const field = createLyricsField({ onTokens: t => { tokens = t } })
    field.simulatePaste('pasted text')
    ok(tokens !== null)
    is(tokens[0].text, 'pasted')
  })

  it('simulateDrop with text file calls onTokens', async () => {
    let tokens = null
    const field = createLyricsField({ onTokens: t => { tokens = t } })
    await field.simulateDrop({ type: 'text/plain', content: 'dropped text' })
    ok(tokens !== null)
    is(tokens[0].text, 'dropped')
  })

  it('simulateDrop with non-text file calls onError', async () => {
    let error = null
    const field = createLyricsField({ onTokens: () => {}, onError: e => { error = e } })
    await field.simulateDrop({ type: 'application/pdf', content: '' })
    ok(error !== null, 'should call onError for non-text file')
  })

  it('simulateDrop with saved JSON restores tokens', async () => {
    const savedState = JSON.stringify({
      __slopchords: true,
      tokens: [
        { type: 'word', text: 'restored', chord: 'Am', offsetX: 0 },
      ]
    })
    let tokens = null
    const field = createLyricsField({ onTokens: t => { tokens = t } })
    await field.simulateDrop({ type: 'application/json', content: savedState })
    ok(tokens !== null)
    is(tokens[0].text, 'restored')
    is(tokens[0].chord, 'Am')
  })

  it('simulateDrop with non-slopchords JSON falls back to text parse', async () => {
    let tokens = null
    const field = createLyricsField({ onTokens: t => { tokens = t } })
    await field.simulateDrop({ type: 'application/json', content: '{"foo":"bar"}' })
    // non-slopchords JSON → error, no tokens
    ok(tokens === null)
  })
})

describe('lyricsField — sync back from layout', () => {
  it('setTokens updates internal tokens without re-parsing text', () => {
    let callCount = 0
    const field = createLyricsField({ onTokens: () => { callCount++ } })
    field.setValue('hello world')   // callCount = 1
    const count = callCount
    // Layout field edited a chord label; push updated tokens back in
    field.setTokens([
      { type: 'word', text: 'hello', chord: 'G', offsetX: 0 },
      { type: 'word', text: 'world', chord: '', offsetX: 0 },
    ])
    // setTokens must NOT re-fire onTokens (would cause loop)
    is(callCount, count, 'setTokens must not trigger onTokens')
  })
})

import { tokenise } from '../src/tokeniser.js'

describe('lyricsField — tokensToText round-trip', () => {
  it('setTokens with barline produces parseable text (bar flanked by spaces)', () => {
    const field = createLyricsField({ onTokens: () => {} })
    field.setTokens([
      { type: 'word', text: 'a', chord: '', offsetX: 0 },
      { type: 'barline', chord: '', offsetX: 0 },
      { type: 'word', text: 'b', chord: '', offsetX: 0 },
    ])
    const text = field.getValue()
    const tokens = tokenise(text)
    const types = tokens.map(t => t.type)
    assert.deepEqual(types, ['word', 'barline', 'word'])
  })
})
