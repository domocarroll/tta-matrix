// Mint a share-link snapshot (Pete publishes a meeting to customers).
//
// POST /api/snapshot   body: { clientId, meetingKey, payload }
// → { token }

import type { RequestHandler } from './$types'
import { error, json } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'
import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = anyApi as any

export const POST: RequestHandler = async ({ request }) => {
  const url = env.CONVEX_URL
  if (!url) throw error(500, 'CONVEX_URL not configured')

  let body: { clientId: string; meetingKey: string; payload: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    throw error(400, 'Invalid JSON')
  }
  if (!body.clientId || !body.meetingKey) {
    throw error(400, 'Missing clientId or meetingKey')
  }

  const client = new ConvexHttpClient(url)
  const out = (await client.mutation(api.snapshots.create, {
    clientId: body.clientId,
    meetingKey: body.meetingKey,
    payload: body.payload
  })) as { token: string }
  return json(out)
}
