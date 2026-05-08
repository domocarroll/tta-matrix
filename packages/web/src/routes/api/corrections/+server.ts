// Upsert / clear meeting corrections (Pete's review/edit overlay).
//
// PUT /api/corrections   body: { clientId, meetingKey, label?, notes?, horsePatches[] }
// DELETE /api/corrections?clientId&meetingKey

import type { RequestHandler } from './$types'
import { error, json } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'
import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = anyApi as any

interface PutBody {
  clientId: string
  meetingKey: string
  label?: string
  notes?: string
  horsePatches: Array<{
    raceNumber: number
    originalName: string
    action: 'rename' | 'renumber' | 'remove'
    newHorseName?: string
    newHorseNumber?: number
  }>
}

export const PUT: RequestHandler = async ({ request }) => {
  const url = env.CONVEX_URL
  if (!url) throw error(500, 'CONVEX_URL not configured')

  let body: PutBody
  try {
    body = (await request.json()) as PutBody
  } catch {
    throw error(400, 'Invalid JSON')
  }
  if (!body.clientId || !body.meetingKey) {
    throw error(400, 'Missing clientId or meetingKey')
  }

  const client = new ConvexHttpClient(url)
  const id = await client.mutation(api.corrections.upsert, {
    clientId: body.clientId,
    meetingKey: body.meetingKey,
    label: body.label,
    notes: body.notes,
    horsePatches: body.horsePatches ?? []
  })
  return json({ id })
}

export const DELETE: RequestHandler = async ({ url }) => {
  const convexUrl = env.CONVEX_URL
  if (!convexUrl) throw error(500, 'CONVEX_URL not configured')

  const clientId = url.searchParams.get('clientId')
  const meetingKey = url.searchParams.get('meetingKey')
  if (!clientId || !meetingKey) throw error(400, 'Missing clientId or meetingKey')

  const client = new ConvexHttpClient(convexUrl)
  await client.mutation(api.corrections.clearForMeeting, { clientId, meetingKey })
  return json({ ok: true })
}
