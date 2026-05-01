// Detail of a single extraction.
//
// GET /api/history/<id>?clientId=<uuid>
// DELETE /api/history/<id>?clientId=<uuid>

import type { RequestHandler } from './$types'
import { error, json } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'
import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = anyApi as any

function getClient(): ConvexHttpClient {
  const url = env.CONVEX_URL
  if (!url) throw error(500, 'CONVEX_URL not configured')
  return new ConvexHttpClient(url)
}

export const GET: RequestHandler = async ({ url, params }) => {
  const clientId = url.searchParams.get('clientId')
  if (!clientId) throw error(400, 'Missing clientId')
  if (!params.id) throw error(400, 'Missing id')

  const client = getClient()
  const row = await client.query(api.extractions.getById, {
    id: params.id,
    clientId
  })
  if (!row) throw error(404, 'Not found')
  return json(row)
}

export const DELETE: RequestHandler = async ({ url, params }) => {
  const clientId = url.searchParams.get('clientId')
  if (!clientId) throw error(400, 'Missing clientId')
  if (!params.id) throw error(400, 'Missing id')

  const client = getClient()
  const result = await client.mutation(api.extractions.remove, {
    id: params.id,
    clientId
  })
  if (!result.ok) {
    throw error(result.reason === 'not_found' ? 404 : 403, result.reason)
  }
  return json({ ok: true })
}
