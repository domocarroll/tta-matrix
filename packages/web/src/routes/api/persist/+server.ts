// Persist a completed extraction to Convex.
//
// POST /api/persist
//   { clientId, filename, durationMs, tokensIn, tokensOut, model, payload }
//
// Returns: { id: string } — the Convex extraction document id.

import type { RequestHandler } from './$types'
import { error, json } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'
import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'
import type { ExtractionResult } from '$lib/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = anyApi as any

interface PersistRequest {
  clientId: string
  filename: string
  durationMs: number
  tokensIn: number
  tokensOut: number
  model: string
  payload: ExtractionResult
  /**
   * Optional override applied AFTER agent extraction. Pete uses this from
   * the workspace category strip to force grouping when the agent
   * mis-detects venue (e.g. a TV screenshot of a Brisbane race in a
   * Sydney newspaper layout).
   */
  overrideCategory?: string
}

export const POST: RequestHandler = async ({ request }) => {
  const url = env.CONVEX_URL
  if (!url) throw error(500, 'CONVEX_URL not configured on server')

  let body: PersistRequest
  try {
    body = (await request.json()) as PersistRequest
  } catch {
    throw error(400, 'Invalid JSON body')
  }

  if (!body.clientId || typeof body.clientId !== 'string') {
    throw error(400, 'Missing clientId')
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
    const id = await client.mutation(api.extractions.create, {
      clientId: body.clientId,
      filename: body.filename,
      publication: body.payload.publication,
      meeting: body.payload.meeting,
      category: finalCategory,
      tipstersDetected: body.payload.tipstersDetected as string[],
      reasoning: body.payload.reasoning as string[],
      races: body.payload.races,
      flags: body.payload.flags,
      tokensIn: body.tokensIn,
      tokensOut: body.tokensOut,
      durationMs: body.durationMs,
      model: body.model
    })
    return json({ id })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'persist failed'
    console.error('[persist] convex mutation failed:', msg)
    throw error(500, msg)
  }
}
