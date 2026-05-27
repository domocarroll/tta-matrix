// Incremental reasoning-step extractor for the streaming extraction endpoint.
//
// The model streams a single JSON object whose top-level "reasoning" key holds
// an array of strings. We can't wait for the whole document — we want to emit
// each reasoning bullet to the client the moment it is fully formed. This is a
// hand-rolled incremental string scanner that tolerates partial/truncated JSON
// (mid-stream) and never throws on malformed input.

/**
 * Create a stateful reasoning emitter.
 *
 * The returned function is called repeatedly with the *full accumulated* raw
 * stream so far. Each call walks the streaming raw JSON; whenever a new full
 * string element appears inside the top-level "reasoning" array, it invokes
 * `emit(step)` exactly once for that step (state is retained across calls so a
 * given step is never emitted twice).
 */
export function makeReasoningEmitter() {
  let lastEmittedCount = 0
  return (raw: string, emit: (step: string) => void) => {
    // Locate the reasoning array
    const key = '"reasoning"'
    const keyIdx = raw.indexOf(key)
    if (keyIdx < 0) return
    const arrStart = raw.indexOf('[', keyIdx)
    if (arrStart < 0) return
    // Find array end (best effort — may not exist yet during streaming)
    let depth = 0
    let arrEnd = -1
    let inString = false
    let escape = false
    for (let i = arrStart; i < raw.length; i++) {
      const ch = raw[i]
      if (escape) {
        escape = false
        continue
      }
      if (ch === '\\') {
        escape = true
        continue
      }
      if (ch === '"') {
        inString = !inString
        continue
      }
      if (inString) continue
      if (ch === '[') depth++
      else if (ch === ']') {
        depth--
        if (depth === 0) {
          arrEnd = i
          break
        }
      }
    }
    const arrSlice = raw.slice(arrStart + 1, arrEnd === -1 ? raw.length : arrEnd)
    // Extract complete JSON strings out of the slice
    const items: string[] = []
    let i = 0
    while (i < arrSlice.length) {
      // skip whitespace + commas
      while (i < arrSlice.length && /[\s,]/.test(arrSlice[i] ?? '')) i++
      if (arrSlice[i] !== '"') break
      let j = i + 1
      let esc = false
      let closed = false
      while (j < arrSlice.length) {
        const ch = arrSlice[j]
        if (esc) {
          esc = false
          j++
          continue
        }
        if (ch === '\\') {
          esc = true
          j++
          continue
        }
        if (ch === '"') {
          closed = true
          break
        }
        j++
      }
      if (!closed) break
      const jsonStr = arrSlice.slice(i, j + 1)
      try {
        items.push(JSON.parse(jsonStr) as string)
      } catch {
        break
      }
      i = j + 1
    }
    while (lastEmittedCount < items.length) {
      const v = items[lastEmittedCount]
      if (typeof v === 'string') emit(v)
      lastEmittedCount++
    }
  }
}
