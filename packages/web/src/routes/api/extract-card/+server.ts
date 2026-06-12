// Race-card extraction — single-shot Claude vision call.
//
// POST /api/extract-card
//   FormData: image (file)
//
// Returns: { races: [{raceNumber, distance?, runners: [{number,name,jockey?,trainer?,barrier?,scratched?}]}] }
//
// This is NOT persisted — caller reviews + approves, then POSTs to
// /api/user-fields to lock the field in for that meetingKey.

import type { RequestHandler } from './$types'
import { error, json } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'
import Anthropic from '@anthropic-ai/sdk'

const MODEL = () => env.TTA_MODEL || 'claude-sonnet-4-6'
const MAX_TOKENS = 16384
const MAX_IMAGE_BYTES = 8 * 1024 * 1024

const SYSTEM_PROMPT = `You read official Australian horse-racing race-cards / form-guides.

The image is the OFFICIAL acceptance card for a race meeting — the authoritative source of which runners are in which race. Extract every race shown.

For each race extract every runner:
  - number  (saddlecloth, 1-indexed integer)
  - name    (official horse name, title case, no quotes or asterisks)
  - jockey  (full name as printed; empty string if not shown)
  - trainer (full name as printed; empty string if not shown)
  - barrier (gate number, integer)
  - scratched (true if marked SCR / scratched / withdrawn; default false)

Output a single JSON object. No markdown fences, no prose.

{
  "races": [
    {
      "raceNumber": 1,
      "distance": 1200,
      "runners": [
        { "number": 1, "name": "Horse Name", "jockey": "J Smith", "trainer": "T Trainer", "barrier": 5, "scratched": false }
      ]
    }
  ]
}

Rules:
- raceNumber is the actual race number printed (1, 2, 3 ...).
- Include scratched runners with scratched:true — don't drop them.
- If a field is illegible omit it (jockey/trainer/barrier are optional).
- Never invent runners. If the card is partial, return only what is clearly readable.
- distance is the race distance in metres if printed; otherwise omit.`

function parseLooseJson(raw: string): unknown {
  let cleaned = raw.trim()
  const fenceStart = cleaned.indexOf('```')
  if (fenceStart !== -1) {
    cleaned = cleaned.slice(fenceStart + 3)
    if (cleaned.startsWith('json')) cleaned = cleaned.slice(4)
    const fenceEnd = cleaned.lastIndexOf('```')
    if (fenceEnd !== -1) cleaned = cleaned.slice(0, fenceEnd)
  }
  try {
    return JSON.parse(cleaned.trim())
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1))
      } catch {
        return null
      }
    }
    return null
  }
}

export const POST: RequestHandler = async ({ request }) => {
  const apiKey = env.ANTHROPIC_API_KEY
  if (!apiKey) throw error(500, 'ANTHROPIC_API_KEY not configured')

  const fd = await request.formData()
  const file = fd.get('image')
  if (!(file instanceof File)) throw error(400, 'Missing image file')
  if (!file.type.startsWith('image/')) throw error(400, `Invalid image type: ${file.type}`)
  if (file.size > MAX_IMAGE_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1)
    throw error(413, `Image too large (${mb} MB; limit 8 MB)`)
  }

  const buf = Buffer.from(await file.arrayBuffer())
  const base64 = buf.toString('base64')
  const mediaType = (
    ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)
      ? file.type
      : 'image/jpeg'
  ) as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

  // Always Anthropic direct — no proxy (see extract/+server.ts for why).
  const client = new Anthropic({ apiKey })

  const msg = await client.messages.create({
    model: MODEL(),
    max_tokens: MAX_TOKENS,
    temperature: 0.1,
    system: SYSTEM_PROMPT,
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
            text: 'Extract this race card. Output the JSON object only.'
          }
        ]
      }
    ]
  })

  const raw = msg.content
    .filter((c) => c.type === 'text')
    .map((c) => (c as { type: 'text'; text: string }).text)
    .join('')

  const parsed = parseLooseJson(raw)
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { races?: unknown }).races)) {
    return json({ ok: false, error: 'Failed to parse race-card JSON', raw }, { status: 500 })
  }

  return json({
    ok: true,
    races: (parsed as { races: unknown[] }).races,
    tokensIn: msg.usage.input_tokens,
    tokensOut: msg.usage.output_tokens,
    filename: file.name
  })
}
