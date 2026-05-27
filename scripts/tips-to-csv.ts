// ──────────────────────────────────────────────────────
// TTA — Folder of tip-sheet images → one aggregated CSV
// ──────────────────────────────────────────────────────
//
//   npx tsx scripts/tips-to-csv.ts <folder> [outfile.csv]
//
// Reads every image in <folder>, has Claude extract each sheet
// (meeting + category + per-tipster selections), groups by meeting,
// aggregates consensus rankings, and writes ONE CSV in the exact
// layout Pete's website parses. No server, no Convex — pure Claude.

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, extname, resolve } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { jsonrepair } from 'jsonrepair'
import {
  aggregateRaces,
  buildMeetingCsv,
  matchField,
  type RaceCategory,
  type ExpandedTip,
  type FieldRunner,
} from '../packages/shared/src/index.ts'

const MODEL = process.env.TTA_MODEL || 'claude-sonnet-4-6'
const CONCURRENCY = 5
const VALID_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp'])
const MEDIA: Record<string, 'image/png' | 'image/jpeg' | 'image/webp'> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
}

const SYSTEM_PROMPT = `You extract Australian horse-racing tips from a single newspaper/TV/grid image.
Reason about the image, then output ONE JSON object — no markdown, no prose outside JSON:
{
  "meeting": "<venue, e.g. Randwick, Gosford; 'unknown' if unreadable>",
  "category": "<SR|MR|BR|PR|AR|OR>",   // Sydney/Melbourne/Brisbane/Perth/Adelaide/Other
  "meetingDate": "<YYYY-MM-DD or 'unknown'>",
  "races": [
    { "raceNumber": 1, "tips": [
      { "tipsterName": "<name>", "selections": [
        { "horseName": "<normalised>", "horseNumber": <int or omit> }
      ] }
    ] }
  ]
}
Rules: strip publication prefixes (XX/xxx/★) from horse names and de-duplicate. List selections in order (1st,2nd,3rd,4th). Race numbers are 1-indexed integers. Omit anything you can't read rather than guessing. If the image has no tips, return {"meeting":"unknown","category":"OR","meetingDate":"unknown","races":[]}.`

interface SheetExtraction {
  meeting: string
  category: RaceCategory
  meetingDate: string
  races: ExpandedTip[]
}

function getKey(): string {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY
  // fallback: parse repo .env
  try {
    const env = readFileSync(resolve(process.cwd(), '.env'), 'utf8')
    const m = env.match(/^ANTHROPIC_API_KEY=(.*)$/m)
    if (m) return m[1].trim()
  } catch {
    /* ignore */
  }
  throw new Error('ANTHROPIC_API_KEY not set (env or .env)')
}

function parseJson(raw: string): SheetExtraction | null {
  let s = raw.trim()
  const fence = s.indexOf('```')
  if (fence !== -1) {
    s = s.slice(fence + 3).replace(/^json/i, '')
    const end = s.lastIndexOf('```')
    if (end !== -1) s = s.slice(0, end)
  }
  const start = s.indexOf('{')
  const last = s.lastIndexOf('}')
  if (start >= 0 && last > start) s = s.slice(start, last + 1)
  for (const candidate of [s, (() => { try { return jsonrepair(s) } catch { return s } })()]) {
    try {
      return JSON.parse(candidate) as SheetExtraction
    } catch {
      /* try next */
    }
  }
  return null
}

async function extractOne(client: Anthropic, file: string, dir: string): Promise<SheetExtraction | null> {
  const ext = extname(file).toLowerCase()
  const b64 = readFileSync(join(dir, file)).toString('base64')
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 16384,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: MEDIA[ext], data: b64 } },
          { type: 'text', text: 'Extract the tips from this sheet as the specified JSON.' },
        ],
      },
    ],
  })
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
  const parsed = parseJson(text)
  if (!parsed || !Array.isArray(parsed.races)) return null
  return parsed
}

// ── Field anchoring (Perplexity Agent API) ───────────────────────────
// Pulls the OFFICIAL acceptance field for a meeting so tips can be
// validated against reality: drops horses that aren't in a race's field
// (cross-race contamination) and locks names+numbers to the official entry
// (the "same horse, two numbers" double-up). Ported from
// packages/web/src/routes/api/resolve-field/+server.ts.
const FIELD_PRESET = process.env.FIELD_PRESET || 'fast-search'
const FIELD_TIMEOUT_MS = 240_000

function getPerplexityKey(): string {
  if (process.env.PERPLEXITY_API_KEY) return process.env.PERPLEXITY_API_KEY
  for (const p of ['.env', 'packages/web/.env']) {
    try {
      const m = readFileSync(resolve(process.cwd(), p), 'utf8').match(/^PERPLEXITY_API_KEY=(.*)$/m)
      if (m) return m[1].trim()
    } catch {
      /* next */
    }
  }
  throw new Error('PERPLEXITY_API_KEY not set (env or .env)')
}

function coerceField(parsed: unknown): { raceNumber: number; runners: FieldRunner[] }[] | null {
  const races = (parsed as { races?: unknown })?.races
  if (!Array.isArray(races)) return null
  const out: { raceNumber: number; runners: FieldRunner[] }[] = []
  for (const r of races) {
    const rr = r as Record<string, unknown>
    const raceNumber = Number(rr?.raceNumber)
    if (!Number.isFinite(raceNumber) || raceNumber <= 0) continue
    const runners: FieldRunner[] = []
    for (const h of Array.isArray(rr.runners) ? rr.runners : []) {
      const hh = h as Record<string, unknown>
      const number = Number(hh?.number)
      const name = typeof hh?.name === 'string' ? hh.name.trim() : ''
      if (!Number.isFinite(number) || number <= 0 || name === '') continue
      runners.push({
        number,
        name,
        jockey: typeof hh.jockey === 'string' ? hh.jockey.trim() : 'TBA',
        trainer: typeof hh.trainer === 'string' ? hh.trainer.trim() : 'TBA',
        barrier: Number.isFinite(Number(hh.barrier)) ? Number(hh.barrier) : 0,
        scratched: hh.scratched === true,
      })
    }
    if (runners.length > 0) out.push({ raceNumber, runners })
  }
  return out.length > 0 ? out : null
}

async function resolveField(
  apiKey: string,
  meeting: string,
  date: string,
): Promise<{ byRace: Map<number, FieldRunner[]>; citations: string[] } | null> {
  const input =
    `Official acceptance field for the Australian thoroughbred meeting ` +
    `"${meeting}" on ${date}. For EVERY race list every runner: saddlecloth ` +
    `number, horse name, jockey, trainer, barrier, scratched(true/false). ` +
    `Include scratched runners with scratched=true. Return ONLY JSON: ` +
    `{"races":[{"raceNumber":1,"runners":[{"number":1,"name":"","jockey":"",` +
    `"trainer":"","barrier":1,"scratched":false}]}]}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FIELD_TIMEOUT_MS)
  try {
    const res = await fetch('https://api.perplexity.ai/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ preset: FIELD_PRESET, input }),
    })
    if (!res.ok) {
      console.warn(`    field ${res.status} ${res.statusText}`)
      return null
    }
    const data = (await res.json()) as { output?: unknown }
    const out = Array.isArray(data.output) ? data.output : []
    let answer = ''
    const citations: string[] = []
    for (const it of out) {
      const item = it as { type?: string; content?: unknown; results?: unknown }
      if (item?.type === 'message' && Array.isArray(item.content))
        for (const c of item.content) {
          const t = (c as { text?: unknown })?.text
          if (typeof t === 'string') answer += t
        }
      if (item?.type === 'search_results' && Array.isArray(item.results))
        for (const rr of item.results) {
          const u = (rr as { url?: unknown })?.url
          if (typeof u === 'string') citations.push(u)
        }
    }
    let parsed: unknown = null
    try {
      parsed = JSON.parse(answer)
    } catch {
      const s = answer.indexOf('{')
      const e = answer.lastIndexOf('}')
      if (s >= 0 && e > s) {
        try {
          parsed = JSON.parse(answer.slice(s, e + 1))
        } catch {
          parsed = null
        }
      }
    }
    const races = coerceField(parsed)
    if (!races) return null
    const byRace = new Map<number, FieldRunner[]>()
    for (const r of races) byRace.set(r.raceNumber, r.runners)
    return { byRace, citations }
  } catch (err) {
    console.warn(`    field failed: ${err instanceof Error ? err.message : String(err)}`)
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function pool<T, R>(items: T[], n: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let idx = 0
  async function worker() {
    while (idx < items.length) {
      const i = idx++
      out[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker))
  return out
}

// ── Fuzzy horse-name de-duplication ──────────────────────────────────
// Across many sheets the same horse arrives spelled slightly differently
// ("Priory Park" / "Priorty Park" / "Priority Park"). Left alone the
// aggregator counts them as separate horses — the exact fragmentation the
// old pipeline suffered. We collapse them per race using saddlecloth
// number first (authoritative), then conservative fuzzy name match.
function lev(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (!m) return n
  if (!n) return m
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[n]
}
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

function canonicalise(tips: ExpandedTip[]): ExpandedTip[] {
  const byRace = new Map<number, ExpandedTip[]>()
  for (const t of tips) {
    const arr = byRace.get(t.raceNumber) ?? []
    arr.push(t)
    byRace.set(t.raceNumber, arr)
  }
  const out: ExpandedTip[] = []
  for (const [raceNumber, raceTips] of byRace) {
    // Modal name per saddlecloth number
    const numNames = new Map<number, Map<string, number>>()
    for (const t of raceTips)
      for (const tip of t.tips)
        for (const s of tip.selections)
          if (s.horseNumber != null) {
            const m = numNames.get(s.horseNumber) ?? new Map<string, number>()
            m.set(s.horseName, (m.get(s.horseName) ?? 0) + 1)
            numNames.set(s.horseNumber, m)
          }
    const canonForNum = new Map<number, string>()
    for (const [num, names] of numNames)
      canonForNum.set(num, [...names.entries()].sort((a, b) => b[1] - a[1])[0][0])

    const resolveSel = (s: { horseName: string; horseNumber?: number }) => {
      if (s.horseNumber != null && canonForNum.has(s.horseNumber))
        return { horseName: canonForNum.get(s.horseNumber)!, horseNumber: s.horseNumber }
      // numberless → fuzzy match to a numbered canonical (conservative)
      const ns = norm(s.horseName)
      for (const [num, cn] of canonForNum) {
        const ncn = norm(cn)
        if (ncn.length >= 5 && lev(ns, ncn) <= 2) return { horseName: cn, horseNumber: num }
      }
      return { horseName: s.horseName, horseNumber: s.horseNumber }
    }

    for (const t of raceTips)
      out.push({
        raceNumber,
        tips: t.tips.map((tip) => ({
          tipsterName: tip.tipsterName,
          selections: tip.selections.map(resolveSel),
        })),
      })
  }
  return out
}

// When the same meeting arrives across several sheets, the same tipster can
// appear more than once (e.g. a columnist printed on two pages). Counting
// their pick twice inflates the consensus (win-count > tipster-count). Keep
// one entry per tipster per race (first occurrence wins).
function dedupeTipsters(tips: ExpandedTip[]): ExpandedTip[] {
  const byRace = new Map<number, Map<string, ExpandedTip['tips'][number]>>()
  for (const t of tips) {
    const m = byRace.get(t.raceNumber) ?? new Map<string, ExpandedTip['tips'][number]>()
    for (const tip of t.tips) {
      const name = tip.tipsterName.trim().toLowerCase()
      if (!m.has(name)) m.set(name, tip)
    }
    byRace.set(t.raceNumber, m)
  }
  return [...byRace.entries()].map(([raceNumber, m]) => ({ raceNumber, tips: [...m.values()] }))
}

async function main() {
  const dir = resolve(process.argv[2] || '')
  if (!process.argv[2]) {
    console.error('usage: npx tsx scripts/tips-to-csv.ts <folder> [outfile.csv]')
    process.exit(1)
  }
  const outfile = process.argv[3] || join(dir, 'aggregated-tips.csv')
  const files = readdirSync(dir).filter((f) => VALID_EXT.has(extname(f).toLowerCase())).sort()
  if (files.length === 0) {
    console.error(`No images (${[...VALID_EXT].join(', ')}) in ${dir}`)
    process.exit(1)
  }

  console.log(`\n  ${files.length} images in ${dir}`)
  console.log(`  extracting with ${MODEL} (${CONCURRENCY} at a time)…\n`)

  const cachePath = outfile + '.raw.json'
  let results: (SheetExtraction | null)[]
  if (process.env.FROM_CACHE && existsSync(cachePath)) {
    results = JSON.parse(readFileSync(cachePath, 'utf8')) as (SheetExtraction | null)[]
    console.log(`  (loaded ${results.length} cached extractions — skipping Claude)\n`)
  } else {
    const client = new Anthropic({ apiKey: getKey() })
    let done = 0
    results = await pool(files, CONCURRENCY, async (file) => {
      let r: SheetExtraction | null = null
      // Vision is non-deterministic; a dense grid can truncate/parse-fail.
      // Retry once before giving up so the hero sheets don't drop out.
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          r = await extractOne(client, file, dir)
        } catch {
          r = null
        }
        if (r && r.races.length > 0) break
      }
      done++
      const tag = r && r.races.length > 0 ? `${r.category} ${r.meeting}` : 'no tips'
      console.log(`  [${String(done).padStart(2)}/${files.length}] ${file.padEnd(34)} → ${tag}`)
      return r
    })
    writeFileSync(cachePath, JSON.stringify(results))
  }

  // Group by MEETING NAME only — a venue is one meeting regardless of how
  // each sheet got category-tagged. Category is then decided by majority
  // vote so "SR Gosford" + "OR Gosford" collapse into one clean meeting.
  type Group = {
    meeting: string
    tips: ExpandedTip[]
    catVotes: Map<RaceCategory, number>
    dateVotes: Map<string, number>
  }
  // Optional authority override: when the SOURCE (e.g. Pete's email subject
  // "BR" / "SR tipsters") already declares the meeting, trust that over the
  // per-image guess. MEETING_BY_PREFIX = JSON { "<filename-prefix>": "CAT|Meeting" }.
  const prefixMap: Record<string, string> = process.env.MEETING_BY_PREFIX
    ? JSON.parse(process.env.MEETING_BY_PREFIX)
    : {}
  const overrideFor = (file: string): { category: RaceCategory; meeting: string } | null => {
    for (const [pfx, val] of Object.entries(prefixMap)) {
      if (file.startsWith(pfx)) {
        const [cat, ...rest] = val.split('|')
        return { category: cat as RaceCategory, meeting: rest.join('|') }
      }
    }
    return null
  }

  const groups = new Map<string, Group>()
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    if (!r || r.races.length === 0) continue
    const ov = overrideFor(files[i] ?? '')
    const meeting = ov?.meeting ?? ((r.meeting || 'Unknown').replace(/\s*\(.*?\)\s*/g, '').trim() || 'Unknown')
    const category = ov?.category ?? ((r.category || 'OR') as RaceCategory)
    const key = meeting.toLowerCase()
    const g = groups.get(key) ?? {
      meeting,
      tips: [],
      catVotes: new Map<RaceCategory, number>(),
      dateVotes: new Map<string, number>(),
    }
    g.catVotes.set(category, (g.catVotes.get(category) ?? 0) + 1)
    if (r.meetingDate && r.meetingDate !== 'unknown')
      g.dateVotes.set(r.meetingDate, (g.dateVotes.get(r.meetingDate) ?? 0) + 1)
    g.tips.push(...r.races)
    groups.set(key, g)
  }
  const dominantCat = (g: Group): RaceCategory =>
    [...g.catVotes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'OR'
  const today = new Date().toISOString().slice(0, 10)
  const forceDate = process.env.FORCE_DATE
  const dominantDate = (g: Group): string =>
    forceDate || ([...g.dateVotes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? today)

  if (groups.size === 0) {
    console.error('\n  No tips extracted from any image. CSV not written.')
    process.exit(1)
  }

  // Build one CSV — a header block per meeting (v0 multi-meeting layout)
  const blocks: string[] = []
  let totalRaces = 0
  let totalHorses = 0
  const anchor = !!process.env.ANCHOR
  const pplxKey = anchor ? getPerplexityKey() : ''
  const sorted = [...groups.values()].sort((a, b) => a.meeting.localeCompare(b.meeting))
  for (const g of sorted) {
    let races = aggregateRaces(dedupeTipsters(canonicalise(g.tips)), dominantCat(g), g.meeting)
    let withField = false

    if (anchor) {
      const date = dominantDate(g)
      console.log(`  anchoring ${g.meeting} ${date} (official field, ${FIELD_PRESET})…`)
      const field = await resolveField(pplxKey, g.meeting, date)
      if (field && field.byRace.size > 0) {
        withField = true
        let dropped = 0
        let flagCount = 0
        races = races.map((race) => {
          const runners = field.byRace.get(race.raceNumber) ?? []
          const { race: m, flags } = matchField(race, runners)
          flagCount += flags.length
          let tips = m.tips
          // Field solidly resolved for this race → drop off-card horses
          // (cross-race contamination). matchField marks keepers fieldMatched.
          if (runners.length >= 4) {
            const before = tips.length
            tips = tips.filter((t) => t.fieldMatched)
            dropped += before - tips.length
          }
          return { ...m, tips, totalSelectionsInRace: tips.reduce((s, t) => s + t.totalTips, 0) }
        })
        console.log(
          `    ✓ ${field.byRace.size} races · ${field.citations.length} sources · ${dropped} off-card horses removed · ${flagCount} flags`,
        )
      } else {
        console.log(`    field unavailable — left un-anchored (graceful degrade)`)
      }
    }

    totalRaces += races.length
    for (const race of races) totalHorses += race.tips.length
    blocks.push(buildMeetingCsv(races, { meeting: g.meeting, date: dominantDate(g) }, { includeFieldData: withField }))
  }
  const csv = blocks.join('\n')
  writeFileSync(outfile, csv)

  console.log(`\n  ──────────────────────────────────────────`)
  console.log(`  meetings : ${groups.size}`)
  for (const g of sorted) console.log(`             · ${dominantCat(g)} ${g.meeting} (${dominantDate(g)})`)
  console.log(`  races    : ${totalRaces}`)
  console.log(`  horses   : ${totalHorses}`)
  console.log(`  CSV      : ${outfile}`)
  console.log(`  ──────────────────────────────────────────\n`)
  console.log(`  ✓ Ready to upload to the website.\n`)
}

main().catch((e) => {
  console.error('FATAL:', e instanceof Error ? e.message : e)
  process.exit(1)
})
