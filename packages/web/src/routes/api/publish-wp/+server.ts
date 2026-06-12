// Publish a meeting's aggregated tips straight to Pete's WordPress site.
//
// POST /api/publish-wp
//   Body (JSON): { csv: string, title?: string, raceDate?: string }
//
// Flow: this server-side handler holds the WP credentials (never the browser),
// mints a short-lived JWT via the jwt-auth/v1 plugin, then POSTs the CSV to the
// tta-upload-csv plugin's REST route (ttard/v1/publish), which runs the SAME
// parser + DB insert as the admin upload screen and returns a shortcode id.
//
// Cloudflare → WordPress note: the site sits behind Cloudflare, which 1010-bans
// non-browser request signatures. We send an explicit browser User-Agent on
// both hops so the WAF lets the server-to-server calls through.

import type { RequestHandler } from './$types'
import { error, json } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

function wpBase(): string {
  const raw = env.TTA_WP_URL
  if (!raw) throw error(500, 'TTA_WP_URL not configured on server')
  return raw.replace(/\/+$/, '')
}

async function mintToken(base: string): Promise<string> {
  const user = env.TTA_WP_USER
  const pass = env.TTA_WP_PASS
  if (!user || !pass) throw error(500, 'TTA_WP_USER / TTA_WP_PASS not configured on server')

  const res = await fetch(`${base}/wp-json/jwt-auth/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ username: user, password: pass })
  })
  const body = (await res.json().catch(() => null)) as { token?: string; message?: string } | null
  if (!res.ok || !body?.token) {
    throw error(502, `WordPress auth failed (${res.status})${body?.message ? `: ${stripTags(body.message)}` : ''}`)
  }
  return body.token
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, '').trim().slice(0, 200)
}

export const POST: RequestHandler = async ({ request }) => {
  const base = wpBase()

  let payload: { csv?: unknown; title?: unknown; raceDate?: unknown }
  try {
    payload = await request.json()
  } catch {
    throw error(400, 'Invalid JSON body')
  }

  const csv = payload.csv
  if (typeof csv !== 'string' || csv.trim() === '') {
    throw error(400, 'Missing csv')
  }
  const title = typeof payload.title === 'string' ? payload.title : undefined
  const raceDate =
    typeof payload.raceDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(payload.raceDate)
      ? payload.raceDate
      : undefined

  const token = await mintToken(base)

  const res = await fetch(`${base}/wp-json/ttard/v1/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': UA,
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ csv, title, race_date: raceDate })
  })

  const body = (await res.json().catch(() => null)) as {
    success?: boolean
    shortcode_id?: string
    shortcodes?: Record<string, string>
    stats?: { races: number; categories: string[]; tipsters: number }
    message?: string
  } | null

  if (!res.ok || !body?.success) {
    throw error(502, `WordPress publish failed (${res.status})${body?.message ? `: ${stripTags(body.message)}` : ''}`)
  }

  return json({
    ok: true,
    shortcodeId: body.shortcode_id,
    shortcodes: body.shortcodes,
    stats: body.stats
  })
}
