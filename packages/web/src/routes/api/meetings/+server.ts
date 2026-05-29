// Customer meetings registry — Gate 1 of the 3-gate workspace.
//
// GET    /api/meetings?clientId=<id>                  → list
// POST   /api/meetings                                 → create
//        body: { clientId, date, category, name }
// PUT    /api/meetings                                 → setState
//        body: { clientId, meetingKey, state }
// DELETE /api/meetings?clientId=&meetingKey=           → remove + cascade

import type { RequestHandler } from './$types'
import { error, json } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'
import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = anyApi as any

const VALID_STATES = new Set(['draft', 'cards-pending', 'locked'])
const VALID_CATEGORIES = new Set(['SR', 'MR', 'BR', 'PR', 'AR', 'OR'])

export const GET: RequestHandler = async ({ url }) => {
  const convexUrl = env.CONVEX_URL
  if (!convexUrl) throw error(500, 'CONVEX_URL not configured')
  const clientId = url.searchParams.get('clientId')
  if (!clientId) throw error(400, 'Missing clientId')
  const sinceParam = url.searchParams.get('sinceMs')
  const sinceMs = sinceParam ? Math.max(0, parseInt(sinceParam, 10)) : undefined
  const client = new ConvexHttpClient(convexUrl)
  const rows = await client.query(api.customerMeetings.listForClient, {
    clientId,
    sinceMs
  })
  return json({ rows })
}

export const POST: RequestHandler = async ({ request }) => {
  const convexUrl = env.CONVEX_URL
  if (!convexUrl) throw error(500, 'CONVEX_URL not configured')
  const body = (await request.json()) as {
    clientId?: string
    date?: string
    category?: string
    name?: string
  }
  if (!body.clientId) throw error(400, 'Missing clientId')
  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    throw error(400, 'date must be YYYY-MM-DD')
  }
  if (!body.category || !VALID_CATEGORIES.has(body.category.toUpperCase())) {
    throw error(400, 'category must be one of SR/MR/BR/PR/AR/OR')
  }
  if (!body.name || body.name.trim().length === 0) {
    throw error(400, 'Missing name')
  }
  const client = new ConvexHttpClient(convexUrl)
  const out = await client.mutation(api.customerMeetings.create, {
    clientId: body.clientId,
    date: body.date,
    category: body.category,
    name: body.name
  })
  return json(out)
}

export const PUT: RequestHandler = async ({ request }) => {
  const convexUrl = env.CONVEX_URL
  if (!convexUrl) throw error(500, 'CONVEX_URL not configured')
  const body = (await request.json()) as {
    clientId?: string
    meetingKey?: string
    state?: string
  }
  if (!body.clientId || !body.meetingKey || !body.state) {
    throw error(400, 'Missing clientId/meetingKey/state')
  }
  if (!VALID_STATES.has(body.state)) throw error(400, 'invalid state')
  const client = new ConvexHttpClient(convexUrl)
  const out = await client.mutation(api.customerMeetings.setState, {
    clientId: body.clientId,
    meetingKey: body.meetingKey,
    state: body.state as 'draft' | 'cards-pending' | 'locked'
  })
  // If we just transitioned TO locked via this endpoint (rare — normal
  // path is userFields.setForMeeting which also handles re-routing), kick
  // a re-route for any pending extractions.
  if (body.state === 'locked') {
    try {
      await client.mutation(api.extractions.reroutePendingForMeeting, {
        clientId: body.clientId,
        meetingKey: body.meetingKey
      })
    } catch {
      // Non-fatal — re-route is opportunistic.
    }
  }
  return json(out)
}

export const DELETE: RequestHandler = async ({ url }) => {
  const convexUrl = env.CONVEX_URL
  if (!convexUrl) throw error(500, 'CONVEX_URL not configured')
  const clientId = url.searchParams.get('clientId')
  const meetingKey = url.searchParams.get('meetingKey')
  if (!clientId || !meetingKey) {
    throw error(400, 'Missing clientId/meetingKey')
  }
  const client = new ConvexHttpClient(convexUrl)
  const out = await client.mutation(api.customerMeetings.removeForMeeting, {
    clientId,
    meetingKey
  })
  return json(out)
}
