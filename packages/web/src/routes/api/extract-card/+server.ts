// Race-card extraction — Claude vision call (single-shot, or multi-turn chat
// re-extract when a reviewer correction is supplied).
//
// POST /api/extract-card
//   FormData:
//     image        one or more image files (FormData may repeat the key)
//     feedback?    reviewer correction → triggers a multi-turn re-extract
//     priorResult? JSON of the previous extraction (the assistant turn)
//     clientId?    + meetingKey?  → inject this client's learned hints
//
// Returns: { ok, races:[{raceNumber, distance?, runners:[{number,name,jockey?,
//   trainer?,barrier?,scratched?,emergency?}]}], flags, hintsApplied, ... }
//
// This is NOT persisted — caller reviews + approves, then POSTs to
// /api/user-fields to lock the field in for that meetingKey.

import type { RequestHandler } from './$types'
import { error, json } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'
import Anthropic from '@anthropic-ai/sdk'
import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'
import { sanitiseRaces } from '$lib/sanitiseRaces.ts'
import {
  selectRelevantHints,
  hintsPromptBlock,
  type ExtractionHint
} from '$lib/extractionHints'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const convexApi = anyApi as any

type MediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

interface ImagePart {
  type: 'image'
  source: { type: 'base64'; media_type: MediaType; data: string }
}

/** Read every uploaded image (FormData may carry one or several). */
async function readImages(fd: FormData): Promise<{ parts: ImagePart[]; filenames: string[] }> {
  const files = fd.getAll('image').filter((f): f is File => f instanceof File)
  if (files.length === 0) throw error(400, 'Missing image file')
  const parts: ImagePart[] = []
  const filenames: string[] = []
  for (const file of files) {
    if (!file.type.startsWith('image/')) throw error(400, `Invalid image type: ${file.type}`)
    if (file.size > MAX_IMAGE_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1)
      throw error(413, `Image too large (${mb} MB; limit 8 MB)`)
    }
    const media: MediaType = (
      ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)
        ? file.type
        : 'image/jpeg'
    ) as MediaType
    parts.push({
      type: 'image',
      source: { type: 'base64', media_type: media, data: Buffer.from(await file.arrayBuffer()).toString('base64') }
    })
    filenames.push(file.name)
  }
  return { parts, filenames }
}

/** Fetch + filter this client's learned hints for the meeting being extracted. */
async function relevantHintsFor(clientId: string, meetingKey: string): Promise<ExtractionHint[]> {
  const convexUrl = env.CONVEX_URL
  if (!convexUrl) return []
  // meetingKey is `YYYY-MM-DD|CATEGORY|Venue Name`.
  const [, category = '', venue = ''] = meetingKey.split('|')
  try {
    const client = new ConvexHttpClient(convexUrl)
    const hints = (await client.query(convexApi.extractionHints.listForClient, {
      clientId
    })) as ExtractionHint[]
    return selectRelevantHints(hints, { category, venue })
  } catch {
    return []
  }
}

const MODEL = () => env.TTA_MODEL || 'claude-sonnet-4-6'
const MAX_TOKENS = 16384
const MAX_IMAGE_BYTES = 8 * 1024 * 1024

const SYSTEM_PROMPT = `You read official Australian horse-racing race-cards / form-guides.

The image is the OFFICIAL acceptance card for a race meeting — the authoritative source of which runners are in which race. Extract every race shown.

For each race extract every runner:
  - number    (saddlecloth, 1-indexed integer)
  - name      (official horse name, title case, no quotes or asterisks)
  - jockey    (full name as printed; empty string if not shown)
  - trainer   (full name as printed; empty string if not shown)
  - barrier   (gate number, integer)
  - scratched (true if marked SCR / scratched / withdrawn; default false)
  - emergency (true if the runner is listed in this race's "Emergencies" block; default false)

Output a single JSON object. No markdown fences, no prose.

{
  "races": [
    {
      "raceNumber": 1,
      "distance": 1200,
      "runners": [
        { "number": 1, "name": "Horse Name", "jockey": "J Smith", "trainer": "T Trainer", "barrier": 5, "scratched": false, "emergency": false },
        { "number": 15, "name": "Reserve Horse", "jockey": "A Jones", "trainer": "B Trainer", "barrier": 12, "scratched": false, "emergency": true }
      ]
    }
  ]
}

EMERGENCIES — read this carefully, it is the most common mistake:
- A race may list reserve runners in an "Emergencies" / "EMERGENCIES (In order)" / "EMG" block, printed BELOW that race's main field.
- These emergencies belong to the race ABOVE the block — the race whose field they follow. They do NOT belong to the next race, even though the block sits just above the next race's header. The header you see directly under an Emergencies block starts a NEW race; the emergencies are NOT part of it.
- Attach each emergency to the correct (preceding) race, set emergency:true, and KEEP its own printed saddlecloth number (e.g. 15, 16) — never renumber it and never carry it forward into the next race.
- If you genuinely cannot tell which race an emergency belongs to, omit it rather than guessing it into the wrong race.

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
  const { parts, filenames } = await readImages(fd)

  // Optional chat re-extract: prior result + a reviewer correction. When both
  // are present we run a multi-turn call so the model sees its own previous
  // answer and the fix, then re-extracts the WHOLE card.
  const feedback = (fd.get('feedback') as string | null)?.trim() || ''
  const priorResult = (fd.get('priorResult') as string | null) || ''
  // Optional context for injecting this client's learned corrections (hints).
  const clientId = (fd.get('clientId') as string | null) || ''
  const meetingKey = (fd.get('meetingKey') as string | null) || ''

  const hints = clientId && meetingKey ? await relevantHintsFor(clientId, meetingKey) : []
  const system = SYSTEM_PROMPT + hintsPromptBlock(hints)

  const baseInstruction = 'Extract this race card. Output the JSON object only.'
  const messages: Anthropic.MessageParam[] =
    feedback && priorResult
      ? [
          { role: 'user', content: [...parts, { type: 'text', text: baseInstruction }] },
          { role: 'assistant', content: priorResult },
          {
            role: 'user',
            content: `A human reviewer checked your previous extraction (above) and found problems:\n\n${feedback}\n\nRe-extract the ENTIRE card from the image(s), applying this correction. Return the FULL JSON object for ALL races — not only the race you fixed. Output JSON only.`
          }
        ]
      : [{ role: 'user', content: [...parts, { type: 'text', text: baseInstruction }] }]

  // Always Anthropic direct, baseURL pinned explicitly so the SDK can't fall
  // back to a stale process.env.ANTHROPIC_BASE_URL (see extract/+server.ts).
  const client = new Anthropic({ apiKey, baseURL: 'https://api.anthropic.com' })

  const msg = await client.messages.create({
    model: MODEL(),
    max_tokens: MAX_TOKENS,
    temperature: 0.1,
    system,
    messages
  })

  const raw = msg.content
    .filter((c) => c.type === 'text')
    .map((c) => (c as { type: 'text'; text: string }).text)
    .join('')

  const parsed = parseLooseJson(raw)
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { races?: unknown }).races)) {
    return json({ ok: false, error: 'Failed to parse race-card JSON', raw }, { status: 500 })
  }

  const { races, flags } = sanitiseRaces((parsed as { races: Array<{ raceNumber?: unknown }> }).races)

  return json({
    ok: true,
    races,
    flags,
    hintsApplied: hints.length,
    tokensIn: msg.usage.input_tokens,
    tokensOut: msg.usage.output_tokens,
    filename: filenames[0] ?? '',
    filenames
  })
}
