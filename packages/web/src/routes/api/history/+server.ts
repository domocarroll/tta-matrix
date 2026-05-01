// List a client's extraction history.
//
// GET /api/history?clientId=<uuid>&limit=<n>

import type { RequestHandler } from './$types'
import { error, json } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'
import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = anyApi as any

export const GET: RequestHandler = async ({ url }) => {
  const convexUrl = env.CONVEX_URL
  if (!convexUrl) throw error(500, 'CONVEX_URL not configured')

  const clientId = url.searchParams.get('clientId')
  if (!clientId) throw error(400, 'Missing clientId')

  const limitParam = url.searchParams.get('limit')
  const limit = limitParam ? Math.max(1, Math.min(200, parseInt(limitParam, 10))) : 50

  const client = new ConvexHttpClient(convexUrl)
  const [rows, stats] = await Promise.all([
    client.query(api.extractions.listByClient, { clientId, limit }),
    client.query(api.extractions.statsByClient, { clientId })
  ])

  return json({ rows, stats })
}
