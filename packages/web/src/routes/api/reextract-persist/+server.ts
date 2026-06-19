// Replace a persisted extraction's content in place after a "fix this sheet"
// re-extract on the tip-sheet surface.
//
// POST /api/reextract-persist
//   { clientId, id, durationMs, tokensIn, tokensOut, model, payload, overrideCategory? }
//
// Returns: { ok: true, id } — or 404/403 if the row is missing / not the
// caller's. The row's identity (_id, meetingKey, state) is preserved; only the
// AI-produced content + run metadata change.

import type { RequestHandler } from './$types'
import { error, json } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'
import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'
import type { ExtractionResult } from '$lib/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = anyApi as any

/**
 * Claude occasionally emits `horseNumber: null` for a selection it can read the
 * name of but not the saddlecloth. The Convex schema types horseNumber as an
 * optional float64 — `null` violates the validator. Normalise to "omitted".
 */
function sanitizeRaces(races: ExtractionResult['races']): ExtractionResult['races'] {
  return races.map((race) => ({
    raceNumber: race.raceNumber,
    tips: race.tips.map((tip) => ({
      tipsterName: tip.tipsterName,
      selections: tip.selections.map((sel) => {
        const n = sel.horseNumber
        const clean: { position: number; horseName: string; horseNumber?: number } = {
          position: sel.position,
          horseName: sel.horseName
        }
        if (typeof n === 'number' && Number.isFinite(n)) clean.horseNumber = n
        return clean
      })
    }))
  }))
}

interface ReExtractPersistRequest {
  clientId: string
  id: string
  durationMs: number
  tokensIn: number
  tokensOut: number
  model: string
  payload: ExtractionResult
  /** Workspace category strip selection — overrides the agent's category. */
  overrideCategory?: string
}

export const POST: RequestHandler = async ({ request }) => {
  const url = env.CONVEX_URL
  if (!url) throw error(500, 'CONVEX_URL not configured on server')

  let body: ReExtractPersistRequest
  try {
    body = (await request.json()) as ReExtractPersistRequest
  } catch {
    throw error(400, 'Invalid JSON body')
  }

  if (!body.clientId || typeof body.clientId !== 'string') {
    throw error(400, 'Missing clientId')
  }
  if (!body.id || typeof body.id !== 'string') {
    throw error(400, 'Missing id')
  }
  if (!body.payload || !body.payload.races) {
    throw error(400, 'Missing payload')
  }

  const validCategories = new Set(['SR', 'MR', 'BR', 'PR', 'AR', 'OR'])
  const finalCategory =
    body.overrideCategory && validCategories.has(body.overrideCategory)
      ? body.overrideCategory
      : body.payload.category

  const client = new ConvexHttpClient(url)
  try {
    const result = (await client.mutation(api.extractions.replaceById, {
      clientId: body.clientId,
      id: body.id,
      publication: body.payload.publication,
      meeting: body.payload.meeting,
      category: finalCategory,
      tipstersDetected: body.payload.tipstersDetected as string[],
      reasoning: body.payload.reasoning as string[],
      races: sanitizeRaces(body.payload.races),
      flags: body.payload.flags,
      tokensIn: body.tokensIn,
      tokensOut: body.tokensOut,
      durationMs: body.durationMs,
      model: body.model
    })) as { ok: boolean; reason?: string; id?: string }

    if (!result.ok) {
      const status = result.reason === 'wrong_client' ? 403 : 404
      throw error(status, result.reason ?? 'replace failed')
    }
    return json(result)
  } catch (err) {
    // Re-throw SvelteKit HttpErrors (404/403 above) untouched.
    if (err && typeof err === 'object' && 'status' in err) throw err
    const msg = err instanceof Error ? err.message : 'replace failed'
    console.error('[reextract-persist] convex mutation failed:', msg)
    throw error(500, msg)
  }
}
