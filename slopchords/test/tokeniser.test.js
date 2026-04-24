import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { tokenise } from '../src/tokeniser.js'

const eq = (a, b) => assert.deepEqual(a, b)
const is = (a, b) => assert.equal(a, b)
const throws = fn => assert.throws(fn)

const W = (text) => ({ type: 'word', text, chord: '', offsetX: 0 })
const BAR = { type: 'barline', chord: '', offsetX: 0 }

describe('tokenise — basic words', () => {
  it('splits on whitespace', () => eq(tokenise('hello world'), [W('hello'), W('world')]))
  it('collapses multiple spaces', () => eq(tokenise('a   b').map(x => x.text), ['a', 'b']))
  it('trims leading/trailing whitespace', () => { const t = tokenise('  hi  '); is(t.length, 1); is(t[0].text, 'hi') })
})

describe('tokenise — breaks', () => {
  it('single newline → linebreak', () => is(tokenise('a\nb')[1].type, 'linebreak'))
  it('double newline → parabreak', () => is(tokenise('a\n\nb')[1].type, 'parabreak'))
  it('3+ newlines → single parabreak', () => { const t = tokenise('a\n\n\nb'); is(t[1].type, 'parabreak'); is(t.length, 3) })
  it('break tokens have no text property', () => is(tokenise('a\nb')[1].text, undefined))
  it('\\f → pagebreak', () => is(tokenise('a\fb')[1].type, 'pagebreak'))
})

describe('tokenise — bar lines', () => {
  it('leading | → barline then word', () => eq(tokenise('|hello'), [BAR, W('hello')]))
  it('mid-word | → word barline word', () => eq(tokenise('hel|lo'), [W('hel'), BAR, W('lo')]))
  it('trailing | → word then barline', () => eq(tokenise('hello|'), [W('hello'), BAR]))
  it('standalone | → barline', () => is(tokenise('a | b')[1].type, 'barline'))
  it('multiple |', () => eq(tokenise('|a|b|').map(x => x.type), ['barline','word','barline','word','barline']))
})

describe('tokenise — hyphen splitting', () => {
  it('hyphen surrounded by spaces → word token "-"', () => eq(tokenise('a - b')[1], W('-')))
  it('hyphen with left space only → no split', () => is(tokenise('a -b')[1].text, '-b'))
  it('hyphen with right space only → no split', () => is(tokenise('a- b')[0].text, 'a-'))
  it('internal hyphen → pre hyphen post tokens', () => eq(tokenise('hel-lo'), [W('hel'), W('-'), W('lo')]))
  it('adjacent hyphens → single word, no split', () => { const t = tokenise('a--b'); is(t.length, 1); is(t[0].text, 'a--b') })
  it('leading hyphen at input start → no split', () => is(tokenise('-hello')[0].text, '-hello'))
})

describe('tokenise — underscore', () => {
  it('single _ is a word token', () => eq(tokenise('_'), [W('_')]))
  it('_ among other words', () => is(tokenise('a _ b')[1].text, '_'))
})

describe('tokenise — token defaults', () => {
  it('all tokens have chord ""', () => tokenise('a\nb|c').forEach(t => is(t.chord, '')))
  it('all tokens have offsetX 0', () => tokenise('a\nb|c').forEach(t => is(t.offsetX, 0)))
})

describe('tokenise — input validation', () => {
  it('\\r\\n normalises to linebreak', () => is(tokenise('a\r\nb')[1].type, 'linebreak'))
  it('throws on null', () => throws(() => tokenise(null)))
  it('throws on number', () => throws(() => tokenise(42)))
})
