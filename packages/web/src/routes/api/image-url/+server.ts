// Resolve a Convex storageId to a short-lived signed image URL (lazy — only
// when the UI actually shows a thumbnail).
//
// GET /api/image-url?storageId=<id> → { url }

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
  const storageId = url.searchParams.get('storageId')
  if (!storageId) throw error(400, 'Missing storageId')
  try {
    const client = new ConvexHttpClient(convexUrl)
    const signed = (await client.query(api.files.getUrl, { storageId })) as string | null
    return json({ url: signed })
  } catch (err) {
    console.error('[image-url] failed:', err instanceof Error ? err.message : err)
    return json({ url: null })
  }
}
