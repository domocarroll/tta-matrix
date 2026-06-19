// Mint a short-lived Convex upload URL. The browser POSTs image bytes directly
// to the returned URL (bypassing this Worker), then attaches the resulting
// storageId to its extraction / userField via the normal persist routes.
//
// POST /api/upload-url → { uploadUrl }

import type { RequestHandler } from './$types'
import { error, json } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'
import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = anyApi as any

export const POST: RequestHandler = async () => {
  const url = env.CONVEX_URL
  if (!url) throw error(500, 'CONVEX_URL not configured')
  try {
    const client = new ConvexHttpClient(url)
    const uploadUrl = (await client.mutation(api.files.generateUploadUrl, {})) as string
    return json({ uploadUrl })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'failed to mint upload URL'
    console.error('[upload-url] failed:', msg)
    throw error(500, msg)
  }
}
