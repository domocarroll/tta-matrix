// ──────────────────────────────────────────────────────
// Authoritative race-field resolution — Perplexity Agent API
// ──────────────────────────────────────────────────────
//
// Runs the Perplexity call IN THIS SERVER, not in a Convex action. The
// Convex action runtime on the dev deployment is wedged (queries/mutations
// fine, all actions 500), and the field call only needs network + the key
// — both available here. The client (lib/fieldResolution.ts) guards repeat
// calls per session, so we skip cross-session Convex caching for now.
//
// Contract: NEVER throws to the caller. On any miss → { resolved:false, reason }.

import type { RequestHandler } from './$types'
import { json } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'
import type { FieldRunner } from '@tta/shared'

const PERPLEXITY_URL = 'https://api.perplexity.ai/v1/responses'
const PERPLEXITY_PRESET = 'deep-research'
// deep-research routinely needs 60-180s for a full meeting card. Generous
// ceiling — caller-side guard (lib/fieldResolution.ts) already gates retries.
const REQUEST_TIMEOUT_MS = 180_000

interface ResolvedRace {
  raceNumber: number
  runners: FieldRunner[]
}

interface ResolveFieldRequest {
  date: string
  meetingName: string
  category: string
  force?: boolean
}

function parseLoose(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1))
      } catch {
        return null
      }
    }
    return null
  }
}

function coerceRaces(parsed: unknown): ResolvedRace[] | null {
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as { races?: unknown }).races)
  ) {
    return null
  }
  const out: ResolvedRace[] = []
  for (const r of (parsed as { races: unknown[] }).races) {
    if (typeof r !== 'object' || r === null) continue
    const rr = r as Record<string, unknown>
    const raceNumber = Number(rr.raceNumber)
    if (!Number.isFinite(raceNumber) || raceNumber <= 0) continue
    const runnersRaw = Array.isArray(rr.runners) ? rr.runners : []
    const runners: FieldRunner[] = []
    for (const h of runnersRaw) {
      if (typeof h !== 'object' || h === null) continue
      const hh = h as Record<string, unknown>
      const number = Number(hh.number)
      const name = typeof hh.name === 'string' ? hh.name.trim() : ''
      if (!Number.isFinite(number) || number <= 0 || name === '') continue
      runners.push({
        number,
        name,
        jockey: typeof hh.jockey === 'string' ? hh.jockey.trim() : 'TBA',
        trainer: typeof hh.trainer === 'string' ? hh.trainer.trim() : 'TBA',
        barrier: Number.isFinite(Number(hh.barrier)) ? Number(hh.barrier) : 0,
        scratched: hh.scratched === true
      })
    }
    if (runners.length > 0) out.push({ raceNumber, runners })
  }
  return out.length > 0 ? out : null
}

async function callPerplexity(
  apiKey: string,
  meetingName: string,
  date: string
): Promise<{ races: ResolvedRace[]; citations: string[] } | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const input =
      `Official acceptance field for the Australian thoroughbred meeting ` +
      `"${meetingName}" on ${date}. For EVERY race list every runner: ` +
      `saddlecloth number, horse name, jockey, trainer, barrier, ` +
      `scratched(true/false). Include scratched runners with scratched=true. ` +
      `Return ONLY JSON: {"races":[{"raceNumber":1,"runners":[{"number":1,` +
      `"name":"","jockey":"","trainer":"","barrier":1,"scratched":false}]}]}`

    const res = await fetch(PERPLEXITY_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ preset: PERPLEXITY_PRESET, input })
    })
    if (!res.ok) {
      console.warn(`[resolve-field] perplexity ${res.status} ${res.statusText}`)
      return null
    }
    const data = (await res.json()) as { output?: unknown }
    const out = Array.isArray(data.output) ? data.output : []
    let answer = ''
    const citations: string[] = []
    for (const it of out) {
      const item = it as { type?: string; content?: unknown; results?: unknown }
      if (item?.type === 'message' && Array.isArray(item.content)) {
        for (const c of item.content) {
          const text = (c as { text?: unknown })?.text
          if (typeof text === 'string') answer += text
        }
      }
      if (item?.type === 'search_results' && Array.isArray(item.results)) {
        for (const rr of item.results) {
          const url = (rr as { url?: unknown })?.url
          if (typeof url === 'string') citations.push(url)
        }
      }
    }
    if (answer.trim() === '') return null
    const races = coerceRaces(parseLoose(answer))
    return races ? { races, citations } : null
  } catch (err) {
    console.warn(`[resolve-field] perplexity failed: ${err instanceof Error ? err.message : String(err)}`)
    return null
  } finally {
    clearTimeout(timer)
  }
}

export const POST: RequestHandler = async ({ request }) => {
  let body: ResolveFieldRequest
  try {
    body = (await request.json()) as ResolveFieldRequest
  } catch {
    return json({ resolved: false, reason: 'request_failed' })
  }
  if (!body.date || !body.meetingName || !body.category) {
    return json({ resolved: false, reason: 'request_failed' })
  }

  const apiKey = env.PERPLEXITY_API_KEY
  if (!apiKey) return json({ resolved: false, reason: 'no_api_key' })

  const result = await callPerplexity(apiKey, body.meetingName, body.date)
  if (!result) return json({ resolved: false, reason: 'field_unavailable' })

  return json({
    resolved: true,
    source: `perplexity:${PERPLEXITY_PRESET}`,
    fetchedAt: Date.now(),
    citations: result.citations,
    races: result.races
  })
}
