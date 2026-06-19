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

/**
 * Claude occasionally emits `horseNumber: null` for a selection it can read
 * the name of but not the saddlecloth. The Convex schema types horseNumber
 * as an optional float64 — `null` violates the validator. Normalise to
 * "omitted" so the document persists cleanly. Applies to every caller
 * (single-shot, workspace, classic).
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
  /**
   * Hard-wall path: when a tip sheet is dropped INTO a specific locked
   * meeting, the caller passes that meeting's key. The extraction binds
   * to it directly — no venue inference, no pending state.
   */
  meetingKey?: string
  /**
   * Client-generated idempotency key from the durable write outbox. Retries
   * carry the same key so the mutation returns the existing row rather than
   * inserting a duplicate.
   */
  clientTxId?: string
  /** Convex storageId of the persisted source image (optional). */
  imageStorageId?: string
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
    const result = await client.mutation(api.extractions.create, {
      clientId: body.clientId,
      filename: body.filename,
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
      model: body.model,
      ...(body.meetingKey ? { forceMeetingKey: body.meetingKey } : {}),
      ...(body.clientTxId ? { clientTxId: body.clientTxId } : {}),
      ...(body.imageStorageId ? { imageStorageId: body.imageStorageId } : {})
    })
    // Echo the routing decision so /work can show "routed → Gate 3" or
    // "pending — lock now" without re-deriving (which is racy). Existing
    // callers that only consume `id` keep working unchanged.
    return json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'persist failed'
    console.error('[persist] convex mutation failed:', msg)
    throw error(500, msg)
  }
}
