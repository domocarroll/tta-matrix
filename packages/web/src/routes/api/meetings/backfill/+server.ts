// One-shot backfill — derives customerMeetings rows from existing
// extractions + userFields for a client. Idempotent. Called from /work
// page on first load.

import type { RequestHandler } from './$types'
import { error, json } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'
import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = anyApi as any

export const POST: RequestHandler = async ({ request }) => {
  const convexUrl = env.CONVEX_URL
  if (!convexUrl) throw error(500, 'CONVEX_URL not configured')
  const body = (await request.json()) as { clientId?: string }
  if (!body.clientId) throw error(400, 'Missing clientId')
  const client = new ConvexHttpClient(convexUrl)
  const out = await client.mutation(api.customerMeetings.backfillForClient, {
    clientId: body.clientId
  })
  return json(out)
}
