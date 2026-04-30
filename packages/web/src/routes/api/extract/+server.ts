// Streaming extraction endpoint.
//
// POST /api/extract
//   FormData with `image` file field
//
// Streams Server-Sent Events of these shapes:
//   { type: 'text', text: '...' }                 — raw token deltas
//   { type: 'reasoning_step', text: '...' }       — a parsed reasoning bullet
//   { type: 'extraction', payload: {...} }        — final structured object
//   { type: 'tokens', input: n, output: n }       — usage at end
//   { type: 'error', message: '...' }             — fatal
//   data: [DONE]\n\n                              — close

import type { RequestHandler } from './$types'
import { error } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'
import Anthropic from '@anthropic-ai/sdk'
import type { ExtractionResult, StreamEvent } from '$lib/types'

const MODEL = () => env.TTA_MODEL || 'claude-sonnet-4-6'
const MAX_TOKENS = 16384

const SYSTEM_PROMPT = `You are TipBot v2, an agentic horse-racing tip extraction system for Australian racing.

You replace a deterministic OCR pipeline that has failed for months on edge cases:
  - publication-specific prefix markup (e.g. "XX" / "xxx" prefix bleeding into horse names)
  - cross-race contamination (horses appearing in races they don't belong to)
  - phantom horses (rows from headers/footers being treated as picks)
  - duplicate tipsters (same person, different abbreviation)
  - silent corruption when race numbers are missing or ambiguous

Your job is to REASON about the image first, then extract.

Process:
  1. Identify the publication (Daily Telegraph, Herald Sun, Winning Post, TAB grid, TV screenshot, etc.)
  2. Identify the meeting (Randwick, Flemington, etc.) and racing category (SR/MR/BR/PR/AR/OR)
  3. Identify the tipsters (column headers in grid format, or row headers in some layouts)
  4. For each race, extract each tipster's selections IN ORDER (1st pick, 2nd, 3rd, 4th)
  5. NORMALISE horse names: strip publication prefixes (XX, xxx, ★, etc.), title-case consistently
  6. DE-DUPLICATE: if a horse appears with and without a prefix, treat as one horse
  7. FLAG ambiguity: if you can't tell which race a tip belongs to, flag it — never guess
  8. NARRATE every non-trivial decision: which prefixes you stripped, which duplicates you resolved

Output a single JSON object matching this schema. No markdown fences, no prose outside JSON.

{
  "publication": "<publication name or 'unknown'>",
  "meeting": "<meeting venue>",
  "category": "<SR|MR|BR|PR|AR|OR>",
  "tipstersDetected": ["<name>", ...],
  "reasoning": [
    "<step 1 of your reasoning>",
    "<step 2 ...>",
    "<a sentence per non-trivial observation>"
  ],
  "races": [
    {
      "raceNumber": 1,
      "tips": [
        {
          "tipsterName": "<exact name>",
          "selections": [
            {"position": 1, "horseName": "<normalised name>", "horseNumber": 5},
            ...
          ]
        }
      ]
    }
  ],
  "flags": [
    {
      "type": "publication_artefact_stripped|duplicate_resolved|ambiguity|uncertain|anomaly",
      "race": 4,
      "description": "<what you noticed and what you did>"
    }
  ]
}

Rules:
- Never silently merge or split data. If you do something to clean up, flag it.
- Race numbers are 1-indexed integers, never strings, never 0.
- If you see a horse with an "XX"/"xxx" prefix that matches another horse without the prefix in the same race, the prefix is publication markup — strip it and de-duplicate. Add a publication_artefact_stripped flag.
- If a horse name looks like it migrated from an adjacent race column, do NOT include it in this race. Add an anomaly flag.
- If you can't read a tipster column or selection clearly, OMIT it and add an uncertain flag rather than guessing.`

function send(controller: ReadableStreamDefaultController, encoder: TextEncoder, ev: StreamEvent) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`))
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

/**
 * Walk the streaming raw JSON; whenever a new full string element appears
 * inside the top-level "reasoning" array, emit it as a reasoning_step event.
 */
function makeReasoningEmitter() {
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

export const POST: RequestHandler = async ({ request }) => {
  const apiKey = env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw error(500, 'ANTHROPIC_API_KEY not configured on server')
  }

  const fd = await request.formData()
  const file = fd.get('image')
  if (!(file instanceof File)) {
    throw error(400, 'Missing image file')
  }
  if (!file.type.startsWith('image/')) {
    throw error(400, `Invalid image type: ${file.type}`)
  }

  const buf = Buffer.from(await file.arrayBuffer())
  const base64 = buf.toString('base64')
  const mediaType = (
    ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)
      ? file.type
      : 'image/jpeg'
  ) as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

  const client = new Anthropic({ apiKey })
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const emitReasoning = makeReasoningEmitter()
        let raw = ''

        const anthropicStream = client.messages.stream({
          model: MODEL(),
          max_tokens: MAX_TOKENS,
          temperature: 0.1,
          system: [
            { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }
          ],
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: { type: 'base64', media_type: mediaType, data: base64 }
                },
                {
                  type: 'text',
                  text: 'Extract this tip sheet. Reason first, then output the JSON object. No prose outside JSON.'
                }
              ]
            }
          ]
        })

        anthropicStream.on('text', (delta: string) => {
          raw += delta
          send(controller, encoder, { type: 'text', text: delta })
          emitReasoning(raw, (step) => {
            send(controller, encoder, { type: 'reasoning_step', text: step })
          })
        })

        const final = await anthropicStream.finalMessage()
        const result = parseLooseJson(raw)
        if (result) {
          send(controller, encoder, { type: 'extraction', payload: result })
        } else {
          send(controller, encoder, {
            type: 'error',
            message: 'Failed to parse extraction JSON.'
          })
        }
        send(controller, encoder, {
          type: 'tokens',
          input: final.usage.input_tokens,
          output: final.usage.output_tokens
        })
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'stream failed'
        send(controller, encoder, { type: 'error', message: msg })
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      'x-accel-buffering': 'no'
    }
  })
}
