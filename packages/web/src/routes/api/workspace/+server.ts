// Workspace surface — full extractions for a client (today by default).
//
// GET /api/workspace?clientId=<uuid>&sinceMs=<ms>&limit=<n>

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

  const sinceParam = url.searchParams.get('sinceMs')
  const limitParam = url.searchParams.get('limit')
  const sinceMs = sinceParam ? Math.max(0, parseInt(sinceParam, 10)) : undefined
  const limit = limitParam
    ? Math.max(1, Math.min(500, parseInt(limitParam, 10)))
    : 200

  const client = new ConvexHttpClient(convexUrl)

  const [rows, corrections] = await Promise.all([
    client.query(api.extractions.listFullByClient, { clientId, sinceMs, limit }),
    client.query(api.corrections.listForClient, { clientId })
  ])

  return json({ rows, corrections })
}
