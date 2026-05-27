import { describe, it, expect } from 'vitest'
import { makeReasoningEmitter } from '../reasoningEmitter.ts'

/**
 * Drive the emitter with a sequence of *accumulated* raw chunks (mirroring how
 * the stream handler feeds it: `raw += delta`) and collect every emitted step.
 */
function runChunks(chunks: string[]): string[] {
  const emit = makeReasoningEmitter()
  const out: string[] = []
  let raw = ''
  for (const chunk of chunks) {
    raw += chunk
    emit(raw, (step) => out.push(step))
  }
  return out
}

describe('makeReasoningEmitter', () => {
  it('returns nothing for empty input', () => {
    expect(runChunks([''])).toEqual([])
    expect(runChunks([])).toEqual([])
  })

  it('emits nothing until the "reasoning" key appears', () => {
    expect(
      runChunks(['{"publication":"Daily Telegraph","meeting":"Randwick"']),
    ).toEqual([])
  })

  it('emits one reasoning step at a time as chunks arrive', () => {
    const out = runChunks([
      '{"reasoning":[',
      '"Identified the publication as Daily Telegraph"',
      ',"Found 8 races in a grid layout"',
      ',"Stripped XX prefixes from 3 horses"]}',
    ])
    expect(out).toEqual([
      'Identified the publication as Daily Telegraph',
      'Found 8 races in a grid layout',
      'Stripped XX prefixes from 3 horses',
    ])
  })

  it('does not re-emit steps already delivered on a prior call', () => {
    const emit = makeReasoningEmitter()
    const out: string[] = []
    let raw = '{"reasoning":["step one","step two"'
    emit(raw, (s) => out.push(s))
    expect(out).toEqual(['step one', 'step two'])
    raw += ',"step three"]}'
    emit(raw, (s) => out.push(s))
    expect(out).toEqual(['step one', 'step two', 'step three'])
  })

  it('yields nothing for a partial/truncated string until it is complete', () => {
    // First chunk: string is opened but not closed -> emit nothing
    let out = runChunks(['{"reasoning":["a partially streamed step that is no'])
    expect(out).toEqual([])
    // Now the same step completed across a boundary -> emitted once, intact
    out = runChunks([
      '{"reasoning":["a partially streamed step that is no',
      't yet finished but now it is"]}',
    ])
    expect(out).toEqual(['a partially streamed step that is not yet finished but now it is'])
  })

  it('handles escaped quotes and backslashes inside a step string', () => {
    const tricky = 'He said \\"strip the XX\\" then a path C:\\\\temp\\\\x and a tab\\tend'
    const out = runChunks([`{"reasoning":["${tricky}"]}`])
    expect(out).toEqual(['He said "strip the XX" then a path C:\\temp\\x and a tab\tend'])
  })

  it('does not let an escaped quote prematurely terminate a step', () => {
    // A bracket and a quote inside the string must not confuse array scanning.
    const out = runChunks(['{"reasoning":["a [bracket] and a \\" quote","second"]}'])
    expect(out).toEqual(['a [bracket] and a " quote', 'second'])
  })

  it('emits multiple steps that arrive across many small chunk boundaries', () => {
    const full = '{"reasoning":["one","two","three","four"]}'
    // Feed one character at a time.
    const chunks = full.split('')
    const out = runChunks(chunks)
    expect(out).toEqual(['one', 'two', 'three', 'four'])
  })

  it('never throws on malformed JSON and emits nothing', () => {
    expect(() =>
      runChunks(['{"reasoning":[ this is not valid json at all }}}']),
    ).not.toThrow()
    expect(runChunks(['{"reasoning":[ not "quoted, garbage ]'])).toEqual([])
  })

  it('emits valid leading steps then stops at the first malformed element', () => {
    // First two are clean strings; the third is a bare number (not a JSON
    // string) so scanning stops there without throwing.
    const out = runChunks(['{"reasoning":["good one","good two",42,"never"]}'])
    expect(out).toEqual(['good one', 'good two'])
  })

  it('emits steps even before the reasoning array (or whole doc) is closed', () => {
    const out = runChunks([
      '{"meeting":"Flemington","reasoning":["first complete step","second complete step"',
    ])
    expect(out).toEqual(['first complete step', 'second complete step'])
  })
})
