// Faithful cost measurement of the /work Gate-2 tip-extraction path.
// Replicates packages/web/src/routes/api/extract/+server.ts exactly:
// same model, SYSTEM_PROMPT (+ cache_control), image+instruction, max_tokens, temp.
// Sums real usage across a folder. No Perplexity, no Convex — just the Claude calls.
//
//   npx tsx scripts/measure-batch-cost.ts <folder>

import { readFileSync, readdirSync } from 'node:fs'
import { join, extname } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'

const dir = process.argv[2]
if (!dir) { console.error('usage: tsx scripts/measure-batch-cost.ts <folder>'); process.exit(1) }

// pull the API key from .env (same as the app)
function getKey(): string {
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

// lift SYSTEM_PROMPT verbatim from the real endpoint so the measurement can't drift
function liftSystemPrompt(): string {
  const src = readFileSync('packages/web/src/routes/api/extract/+server.ts', 'utf8')
  const m = src.match(/const SYSTEM_PROMPT = `([\s\S]*?)`\n/)
  if (!m) throw new Error('could not lift SYSTEM_PROMPT')
  return m[1]
}

const MODEL = process.env.TTA_MODEL || 'claude-sonnet-4-6'
const MAX_TOKENS = 16384
const CONCURRENCY = Number(process.env.CONCURRENCY || 5)
const DELAY_MS = Number(process.env.DELAY_MS || 0)
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const PRICE_IN = 3 / 1e6, PRICE_OUT = 15 / 1e6, PRICE_CACHE_WRITE = 3.75 / 1e6, PRICE_CACHE_READ = 0.3 / 1e6
const MEDIA: Record<string, 'image/png'|'image/jpeg'|'image/webp'> = { '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp' }

const SYSTEM_PROMPT = liftSystemPrompt()
const client = new Anthropic({ apiKey: getKey() })

interface U { in: number; out: number; cw: number; cr: number }
const ZERO: U = { in:0, out:0, cw:0, cr:0 }

async function one(file: string): Promise<U> {
  const ext = extname(file).toLowerCase()
  const data = readFileSync(join(dir, file)).toString('base64')
  const r = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    temperature: 0.1,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: MEDIA[ext] || 'image/jpeg', data } },
      { type: 'text', text: 'Extract this tip sheet. Reason first, then output the JSON object. No prose outside JSON.' },
    ] }],
  })
  const u = r.usage as any
  return { in: u.input_tokens, out: u.output_tokens, cw: u.cache_creation_input_tokens||0, cr: u.cache_read_input_tokens||0 }
}

async function main() {
  const files = readdirSync(dir).filter(f => MEDIA[extname(f).toLowerCase()]).sort()
  console.log(`\n  ${files.length} images · ${MODEL} · ${CONCURRENCY} at a time\n`)
  const totals = { ...ZERO }
  let done = 0, ok = 0
  for (let i = 0; i < files.length; i += CONCURRENCY) {
    const batch = files.slice(i, i + CONCURRENCY)
    const rs = await Promise.all(batch.map(async f => {
      try { return { f, u: await one(f) } }
      catch (e) { return { f, u: ZERO, err: e instanceof Error ? e.message : String(e) } }
    }))
    for (const { f, u, err } of rs as any) {
      done++
      if (!err) ok++
      totals.in += u.in; totals.out += u.out; totals.cw += u.cw; totals.cr += u.cr
      const cost = u.in*PRICE_IN + u.out*PRICE_OUT + u.cw*PRICE_CACHE_WRITE + u.cr*PRICE_CACHE_READ
      console.log(`  [${String(done).padStart(2)}/${files.length}] ${f.padEnd(20)} in:${String(u.in).padStart(5)} out:${String(u.out).padStart(5)} cacheR:${String(u.cr).padStart(5)}  $${cost.toFixed(4)}${err?'  ERR '+String(err).slice(0,40):''}`)
    }
    if (DELAY_MS && i + CONCURRENCY < files.length) await sleep(DELAY_MS)
  }
  const cost = totals.in*PRICE_IN + totals.out*PRICE_OUT + totals.cw*PRICE_CACHE_WRITE + totals.cr*PRICE_CACHE_READ
  console.log(`\n  ──────────────────────────────────────────`)
  console.log(`  input (uncached) : ${totals.in.toLocaleString()}`)
  console.log(`  output           : ${totals.out.toLocaleString()}`)
  console.log(`  cache write      : ${totals.cw.toLocaleString()}`)
  console.log(`  cache read       : ${totals.cr.toLocaleString()}`)
  console.log(`  ──────────────────────────────────────────`)
  const perSheet = ok ? cost / ok : 0
  console.log(`  completed        : ${ok}/${files.length}`)
  console.log(`  COST (${ok} sheets)  : $${cost.toFixed(4)}`)
  console.log(`  per sheet        : $${perSheet.toFixed(4)}`)
  console.log(`  → 20-sheet pull  : $${(perSheet*20).toFixed(2)}`)
  console.log(`  → annualised 52w : $${(perSheet*20*52).toFixed(2)}`)
  console.log(`  ──────────────────────────────────────────\n`)
}
main().catch(e => { console.error('FATAL:', e); process.exit(1) })
