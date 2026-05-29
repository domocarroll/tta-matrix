// User-approved race field persistence.
//
// GET    /api/user-fields?clientId=<id>           → all approved fields for client
// POST   /api/user-fields                          → upsert one (body: {clientId, meetingKey, races, sourceFilenames})
// DELETE /api/user-fields?clientId=&meetingKey=    → unapprove

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
  const client = new ConvexHttpClient(convexUrl)
  const rows = await client.query(api.userFields.listForClient, { clientId })
  return json({ rows })
}

export const POST: RequestHandler = async ({ request }) => {
  const convexUrl = env.CONVEX_URL
  if (!convexUrl) throw error(500, 'CONVEX_URL not configured')
  const body = (await request.json()) as {
    clientId?: string
    meetingKey?: string
    races?: unknown
    sourceFilenames?: string[]
  }
  if (!body.clientId || !body.meetingKey) throw error(400, 'Missing clientId/meetingKey')
  if (!Array.isArray(body.races)) throw error(400, 'races must be an array')
  const client = new ConvexHttpClient(convexUrl)
  const out = await client.mutation(api.userFields.setForMeeting, {
    clientId: body.clientId,
    meetingKey: body.meetingKey,
    races: body.races,
    sourceFilenames: body.sourceFilenames ?? []
  })
  return json(out)
}

export const DELETE: RequestHandler = async ({ url }) => {
  const convexUrl = env.CONVEX_URL
  if (!convexUrl) throw error(500, 'CONVEX_URL not configured')
  const clientId = url.searchParams.get('clientId')
  const meetingKey = url.searchParams.get('meetingKey')
  if (!clientId || !meetingKey) throw error(400, 'Missing clientId/meetingKey')
  const client = new ConvexHttpClient(convexUrl)
  const out = await client.mutation(api.userFields.removeForMeeting, {
    clientId,
    meetingKey
  })
  return json(out)
}
