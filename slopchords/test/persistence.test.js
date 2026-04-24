import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { serialise, deserialise } from '../src/persistence.js'

const ok = (v, m) => assert.ok(v, m)
const is = (a, b) => assert.equal(a, b)
const eq = (a, b) => assert.deepEqual(a, b)

const W = (text, chord='', offsetX=0) => ({ type:'word', text, chord, offsetX })
const BAR = () => ({ type:'barline', chord:'', offsetX:0 })
const LB  = () => ({ type:'linebreak', chord:'', offsetX:0 })

describe('serialise', () => {
  it('returns a JSON string', () => {
    const s = serialise([W('hello')])
    is(typeof s, 'string')
    JSON.parse(s) // must not throw
  })

  it('output has __slopchords marker', () => {
    const obj = JSON.parse(serialise([W('hello')]))
    ok(obj.__slopchords)
  })

  it('preserves token fields: type, text, chord, offsetX', () => {
    const tokens = [W('hello','Am',2), BAR(), LB()]
    const obj = JSON.parse(serialise(tokens))
    eq(obj.tokens[0], { type:'word', text:'hello', chord:'Am', offsetX:2 })
    eq(obj.tokens[1], { type:'barline', chord:'', offsetX:0 })
  })

  it('does not include x (layout-computed field) in output', () => {
    const tokens = [{ ...W('hello'), x: 42 }]
    const obj = JSON.parse(serialise(tokens))
    ok(!('x' in obj.tokens[0]), 'x should be stripped from saved tokens')
  })
})

describe('deserialise', () => {
  it('round-trips tokens', () => {
    const tokens = [W('hello','G7',0), BAR(), W('world')]
    const restored = deserialise(serialise(tokens))
    eq(restored[0], W('hello','G7',0))
    eq(restored[1], BAR())
    eq(restored[2], W('world'))
  })

  it('throws on non-slopchords JSON', () => {
    assert.throws(() => deserialise(JSON.stringify({ foo: 'bar' })))
  })

  it('throws on invalid JSON', () => {
    assert.throws(() => deserialise('not json'))
  })

  it('all restored tokens have chord and offsetX defaults', () => {
    // Even if save file is missing fields, deserialise fills defaults
    const minimal = JSON.stringify({ __slopchords: true, tokens: [{ type:'word', text:'hi' }] })
    const restored = deserialise(minimal)
    is(restored[0].chord, '')
    is(restored[0].offsetX, 0)
  })
})
