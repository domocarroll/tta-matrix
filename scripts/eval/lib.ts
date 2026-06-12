// Shared helpers for the method eval. Faithful to the app's Anthropic calls;
// adds high maxRetries so the low-tier dev key (8K out-tok/min) self-paces
// through 429s via the SDK's retry-after handling.

import { readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'

export const MODEL = process.env.TTA_MODEL || 'claude-sonnet-4-6'
export const PRICE_IN = 3 / 1e6, PRICE_OUT = 15 / 1e6

export const MEDIA: Record<string, 'image/png'|'image/jpeg'|'image/webp'> =
  { '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp' }

export function getKey(): string {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY
  for (const p of ['.env', 'packages/web/.env']) {
    try {
      for (const line of readFileSync(p, 'utf8').split('\n')) {
        const m = line.match(/^ANTHROPIC_API_KEY=(.+)$/)
        if (m) return m[1].trim()
      }
    } catch {}
  }
  throw new Error('ANTHROPIC_API_KEY not found')
}

// lift a `const NAME = \`...\`` template literal verbatim from a source file
export function liftPrompt(file: string, name: string): string {
  const src = readFileSync(file, 'utf8')
  const re = new RegExp(`const ${name} = \`([\\s\\S]*?)\`\\n`)
  const m = src.match(re)
  if (!m) throw new Error(`could not lift ${name} from ${file}`)
  return m[1]
}

export const client = new Anthropic({ apiKey: getKey(), maxRetries: 25 })

export function imageBlock(dir: string, file: string) {
  const ext = extname(file).toLowerCase()
  const data = readFileSync(join(dir, file)).toString('base64')
  return { type: 'image' as const, source: { type: 'base64' as const, media_type: MEDIA[ext] || 'image/jpeg', data } }
}

export interface CallResult { text: string; thinking: string; inTok: number; outTok: number; ms: number; truncated: boolean }

// One faithful extraction call. opts.thinking enables native adaptive thinking.
// Streams (via .finalMessage()) so high max_tokens (up to 64K) won't HTTP-timeout
// — required above ~16K, and the only fair way to test native thinking, whose
// thinking tokens share the output budget.
export async function call(opts: {
  system?: string
  content: any[]
  maxTokens: number
  thinking?: boolean
}): Promise<CallResult> {
  const t0 = Date.now()
  const body: any = {
    model: MODEL,
    max_tokens: opts.maxTokens,
    messages: [{ role: 'user', content: opts.content }],
  }
  if (opts.system) body.system = [{ type: 'text', text: opts.system, cache_control: { type: 'ephemeral' } }]
  if (opts.thinking) body.thinking = { type: 'adaptive' }   // adaptive thinking; no temperature (incompatible)
  else body.temperature = 0.1                                // faithful to the app's temp
  const stream = client.messages.stream(body)
  const r = await stream.finalMessage()
  let text = '', thinking = ''
  for (const b of r.content as any[]) {
    if (b.type === 'text') text += b.text
    else if (b.type === 'thinking') thinking += b.thinking
  }
  const u = r.usage as any
  return {
    text, thinking,
    inTok: u.input_tokens,
    outTok: (u.output_tokens || 0),
    ms: Date.now() - t0,
    truncated: r.stop_reason === 'max_tokens',
  }
}

export function parseLooseJson(raw: string): any {
  let c = raw.trim()
  const f = c.indexOf('```')
  if (f !== -1) { c = c.slice(f + 3); if (c.startsWith('json')) c = c.slice(4); const e = c.lastIndexOf('```'); if (e !== -1) c = c.slice(0, e) }
  try { return JSON.parse(c.trim()) } catch {}
  const s = c.indexOf('{'), e = c.lastIndexOf('}')
  if (s >= 0 && e > s) { try { return JSON.parse(c.slice(s, e + 1)) } catch {} }
  return null
}

// canonical horse-name key: lowercase, drop parenthetical country codes
// ("(FR)", "(Nz)"), strip non-alphanumeric. Tipsters omit the country suffix
// the official card carries, so it must go before comparison.
export function nameKey(s: string): string {
  return (s || '').toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]/g, '')
}

// Levenshtein for fuzzy name match (handles Glamorous/Glamourous spelling drift)
export function lev(a: string, b: string): number {
  const m = a.length, n = b.length
  if (!m) return n; if (!n) return m
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++)
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i-1] === b[j-1] ? 0 : 1))
    prev = cur
  }
  return prev[n]
}

// fuzzy equal: exact key, or edit distance within ~15% of length (min 2)
export function fuzzyEq(a: string, b: string): boolean {
  if (a === b) return true
  const d = lev(a, b)
  return d <= Math.max(2, Math.floor(Math.min(a.length, b.length) * 0.15))
}
