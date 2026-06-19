// ──────────────────────────────────────────────────────
// Extraction runner — single source of truth for SSE streaming
// ──────────────────────────────────────────────────────
//
// Used by both the legacy single-shot landing page and the new
// workspace queue. Returns a thin handle so the caller can render
// progress per file.

import type { ExtractionResult, StreamEvent } from './types'
import {
  categoriseError,
  shouldRetry,
  getRetryDelay,
  isRefusal,
  REFUSAL_PHRASES,
  MAX_RETRIES,
  INITIAL_RETRY_DELAY_MS,
  MAX_RETRY_DELAY_MS,
  JITTER_FACTOR
} from '@tta/shared'

export interface RunCallbacks {
  onText?: (chunk: string) => void
  onReasoning?: (step: string) => void
  onTokens?: (input: number, output: number) => void
  onResult?: (payload: ExtractionResult) => void
  onError?: (message: string) => void
  onAttempt?: (attempt: number, maxAttempts: number) => void
}

export interface RunOutcome {
  result: ExtractionResult | null
  durationMs: number
  tokensIn: number
  tokensOut: number
  errorMessage: string | null
}

/**
 * Optional "fix this sheet" re-extract context. When `feedback` + `priorResult`
 * are both set, the endpoint runs a multi-turn correction; `clientId` lets it
 * inject the client's GLOBAL learned hints.
 */
export interface ReExtractOptions {
  feedback?: string
  priorResult?: ExtractionResult | null
  clientId?: string
}

/**
 * Run a single extraction with retry on transient failures (rate limit,
 * network glitches, refusal-then-success, parse failures). Refusal
 * detection runs over the streamed reasoning + result payload.
 */
export async function runExtractionWithRetry(
  file: File,
  cb: RunCallbacks,
  signal?: AbortSignal,
  /** V2 grounding: JSON of the meeting's locked field ({races:[...]}). */
  fieldJson?: string,
  /** "Fix this sheet" re-extract context (feedback + prior result + clientId). */
  reExtract?: ReExtractOptions
): Promise<RunOutcome> {
  const maxAttempts = MAX_RETRIES + 1
  let lastOutcome: RunOutcome = {
    result: null,
    durationMs: 0,
    tokensIn: 0,
    tokensOut: 0,
    errorMessage: 'no attempts'
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (signal?.aborted) {
      return {
        ...lastOutcome,
        errorMessage: 'cancelled'
      }
    }
    cb.onAttempt?.(attempt + 1, maxAttempts)
    const outcome = await runExtractionOnce(file, cb, signal, fieldJson, reExtract)

    if (outcome.errorMessage === 'cancelled') return outcome

    // Detect a refusal posing as a successful response — should retry
    const isRefused =
      outcome.result === null &&
      outcome.errorMessage !== null &&
      REFUSAL_PHRASES.some((p) => outcome.errorMessage!.toLowerCase().includes(p))

    if (outcome.result && !isRefused) return outcome

    lastOutcome = outcome
    const cat = categoriseError(new Error(outcome.errorMessage ?? 'unknown'))
    if (!shouldRetry(cat, attempt, MAX_RETRIES)) {
      return { ...outcome, errorMessage: cat.userMessage }
    }
    const delay = getRetryDelay(
      attempt,
      INITIAL_RETRY_DELAY_MS,
      MAX_RETRY_DELAY_MS,
      JITTER_FACTOR
    )
    await wait(delay, signal)
  }
  return lastOutcome
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        reject(new DOMException('aborted', 'AbortError'))
      },
      { once: true }
    )
  })
}

/**
 * Single attempt — streams SSE events, returns outcome. Used directly
 * when caller wants no retry (legacy landing page), or via the retry
 * wrapper above (workspace queue).
 */
export async function runExtraction(
  file: File,
  cb: RunCallbacks,
  signal?: AbortSignal,
  fieldJson?: string,
  reExtract?: ReExtractOptions
): Promise<RunOutcome> {
  return runExtractionOnce(file, cb, signal, fieldJson, reExtract)
}

async function runExtractionOnce(
  file: File,
  cb: RunCallbacks,
  signal?: AbortSignal,
  fieldJson?: string,
  reExtract?: ReExtractOptions
): Promise<RunOutcome> {
  const fd = new FormData()
  fd.append('image', file)
  if (fieldJson) fd.append('field', fieldJson)
  // "Fix this sheet": feedback + prior JSON drive a multi-turn correction.
  if (reExtract?.feedback && reExtract.priorResult) {
    fd.append('feedback', reExtract.feedback)
    fd.append('priorResult', JSON.stringify(reExtract.priorResult))
  }
  if (reExtract?.clientId) fd.append('clientId', reExtract.clientId)

  const t0 = performance.now()
  let tokensIn = 0
  let tokensOut = 0
  let result: ExtractionResult | null = null
  let errorMessage: string | null = null
  let rawText = ''

  try {
    const res = await fetch('/api/extract', { method: 'POST', body: fd, signal })
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '')
      errorMessage = text || `HTTP ${res.status}`
      cb.onError?.(errorMessage)
      return { result: null, durationMs: Math.round(performance.now() - t0), tokensIn: 0, tokensOut: 0, errorMessage }
    }

    const decoder = new TextDecoder()
    const sseReader = res.body.getReader()
    let buffer = ''
    while (true) {
      const { value, done } = await sseReader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const raw of lines) {
        const line = raw.trim()
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (data === '[DONE]') continue
        try {
          const ev = JSON.parse(data) as StreamEvent
          switch (ev.type) {
            case 'text':
              rawText += ev.text
              cb.onText?.(ev.text)
              break
            case 'reasoning_step':
              cb.onReasoning?.(ev.text)
              break
            case 'tokens':
              tokensIn = ev.input
              tokensOut = ev.output
              cb.onTokens?.(ev.input, ev.output)
              break
            case 'extraction':
              result = ev.payload
              cb.onResult?.(ev.payload)
              break
            case 'error':
              errorMessage = ev.message
              cb.onError?.(ev.message)
              break
          }
        } catch {
          /* skip malformed line */
        }
      }
    }

    if (!result && !errorMessage) {
      // Try to recover by parsing accumulated raw text as JSON
      const recovered = parseLooseJson(rawText)
      if (recovered) {
        result = recovered
        cb.onResult?.(recovered)
      } else if (rawText && isRefusal(rawText)) {
        errorMessage = 'AI declined to process this image. Retrying.'
        cb.onError?.(errorMessage)
      } else {
        errorMessage = 'Stream completed but no extraction parsed.'
        cb.onError?.(errorMessage)
      }
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      errorMessage = 'cancelled'
    } else {
      errorMessage = err instanceof Error ? err.message : String(err)
      cb.onError?.(errorMessage)
    }
  }

  return {
    result,
    durationMs: Math.round(performance.now() - t0),
    tokensIn,
    tokensOut,
    errorMessage
  }
}

/** Server-echoed routing decision after persist. */
export interface PersistRouteResult {
  id: string
  meetingKey: string
  state: 'routed' | 'pending-meeting'
  pendingReason?: string
  derivedKey: string
  derivedDate: string
  derivedCategory: string
  derivedMeetingName: string
}

/** Persist an extraction to history. Returns the routing result, or null on error. */
export async function persistExtraction(args: {
  clientId: string
  filename: string
  durationMs: number
  tokensIn: number
  tokensOut: number
  model: string
  payload: ExtractionResult
  /** When set, overrides agent's category (workspace category strip selection). */
  overrideCategory?: string
  /** Hard-wall path: bind this extraction to an explicit locked meeting. */
  meetingKey?: string
}): Promise<PersistRouteResult | null> {
  try {
    const res = await fetch('/api/persist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(args)
    })
    if (!res.ok) return null
    return (await res.json()) as PersistRouteResult
  } catch {
    return null
  }
}

/**
 * Replace a persisted extraction's content in place after a "fix this sheet"
 * re-extract. Returns true on success. The row's identity + meeting routing
 * are preserved server-side; only the AI content + run metadata change.
 */
export async function replaceExtraction(args: {
  clientId: string
  id: string
  durationMs: number
  tokensIn: number
  tokensOut: number
  model: string
  payload: ExtractionResult
  /** Workspace category strip selection — overrides the agent's category. */
  overrideCategory?: string
}): Promise<boolean> {
  try {
    const res = await fetch('/api/reextract-persist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(args)
    })
    return res.ok
  } catch {
    return false
  }
}

function parseLooseJson(raw: string): ExtractionResult | null {
  let cleaned = raw.trim()
  const fenceStart = cleaned.indexOf('```')
  if (fenceStart !== -1) {
    cleaned = cleaned.slice(fenceStart + 3)
    if (cleaned.startsWith('json')) cleaned = cleaned.slice(4)
    const fenceEnd = cleaned.lastIndexOf('```')
    if (fenceEnd !== -1) cleaned = cleaned.slice(0, fenceEnd)
  }
  try {
    return JSON.parse(cleaned.trim()) as ExtractionResult
  } catch {
    return null
  }
}
