// Learned extraction corrections (compounding) — list + save.
//
// GET  /api/extraction-hints?clientId=<id>   → { hints: [...] }
// POST /api/extraction-hints                  → { id, deduped }
//        body: { clientId, scope, category?, venue?, hint, source }

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
  const hints = await client.query(api.extractionHints.listForClient, { clientId })
  return json({ hints })
}

interface PostBody {
  clientId?: string
  scope?: 'global' | 'category' | 'venue'
  category?: string
  venue?: string
  hint?: string
  source?: 'manual' | 'derived'
}

export const POST: RequestHandler = async ({ request }) => {
  const convexUrl = env.CONVEX_URL
  if (!convexUrl) throw error(500, 'CONVEX_URL not configured')

  let body: PostBody
  try {
    body = (await request.json()) as PostBody
  } catch {
    throw error(400, 'Invalid JSON')
  }
  if (!body.clientId || !body.hint?.trim()) throw error(400, 'Missing clientId or hint')
  const scope = body.scope ?? 'venue'
  if (!['global', 'category', 'venue'].includes(scope)) throw error(400, 'Invalid scope')

  const client = new ConvexHttpClient(convexUrl)
  const out = await client.mutation(api.extractionHints.add, {
    clientId: body.clientId,
    scope,
    category: body.category,
    venue: body.venue,
    hint: body.hint.trim(),
    source: body.source ?? 'derived'
  })
  return json(out)
}
