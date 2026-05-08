// Public read of a meeting snapshot.
//
// GET /api/snapshot/<token>

import type { RequestHandler } from './$types'
import { error, json } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'
import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = anyApi as any

export const GET: RequestHandler = async ({ params }) => {
  const url = env.CONVEX_URL
  if (!url) throw error(500, 'CONVEX_URL not configured')

  const token = params.token
  if (!token) throw error(400, 'Missing token')

  const client = new ConvexHttpClient(url)
  const row = await client.query(api.snapshots.getByToken, { token })
  if (!row) throw error(404, 'Snapshot not found')
  return json(row)
}
