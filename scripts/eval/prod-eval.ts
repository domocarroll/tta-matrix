// Production verification: hits the LIVE deployed endpoints, scores against
// the committed ground-truth field (scripts/eval/field.json).
//
//   npx tsx scripts/eval/prod-eval.ts <dir> [--cards] [--tips]
//
// Test 1 (--cards): POST 503-512 form guides to /api/extract-card, merge,
//   diff the rebuilt field against field.json.
// Test 2 (--tips):  POST 413-422 tip sheets to /api/extract with the locked
//   field attached (real V2 grounding path), parse the SSE stream, score
//   every pick: valid / wrong_number / cross_race / phantom + truncation.
//
// No flags = both. Sends Origin header (SvelteKit CSRF) like the browser does.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { nameKey, fuzzyEq, MEDIA } from './lib.ts'

const PROD = process.env.PROD_URL || 'https://tta-pete-demo.pages.dev'
const dir = process.argv[2] || '/tmp/tta_batch'
const flags = process.argv.slice(3)
const doCards = flags.length === 0 || flags.includes('--cards')
const doTips = flags.length === 0 || flags.includes('--tips')

const GUIDE_PREFIXES = ['503','504','505','506','507','508','509','510','511','512']
const TIP_PREFIXES = ['413','414','415','416','417','418','419','420','421','422']

interface Runner { number: number; name: string; scratched?: boolean }
interface Race { raceNumber: number; runners: Runner[] }

const field: Race[] = JSON.parse(readFileSync('scripts/eval/field.json', 'utf8'))

function filesFor(prefixes: string[]): string[] {
  return readdirSync(dir)
    .filter((f) => MEDIA[extname(f).toLowerCase()])
    .filter((f) => prefixes.some((p) => f.includes(p)))
    .sort()
}

function fileBlob(f: string): Blob {
  const buf = readFileSync(join(dir, f))
  return new Blob([buf], { type: MEDIA[extname(f).toLowerCase()] })
}

async function post(path: string, fd: FormData): Promise<Response> {
  return fetch(`${PROD}${path}`, {
    method: 'POST',
    body: fd,
    headers: { Origin: PROD },
  })
}

// ── Test 1: card path ───────────────────────────────────────────────────────

async function testCards() {
  console.log(`\n━━ TEST 1: /api/extract-card on prod (${PROD}) ━━\n`)
  const rebuilt = new Map<number, Map<number, Runner>>()
  const merge = (r: Race) => {
    if (!r?.runners) return
    if (!rebuilt.has(r.raceNumber)) rebuilt.set(r.raceNumber, new Map())
    const m = rebuilt.get(r.raceNumber)!
    for (const run of r.runners) {
      if (typeof run.number !== 'number' || !run.name) continue
      const score = (x?: Runner) => (x ? Object.values(x).filter((v) => v !== '' && v != null).length : -1)
      if (score(run) > score(m.get(run.number))) m.set(run.number, run)
    }
  }

  for (const f of filesFor(GUIDE_PREFIXES)) {
    const fd = new FormData()
    fd.set('image', fileBlob(f), f)
    const t0 = Date.now()
    try {
      const res = await post('/api/extract-card', fd)
      if (!res.ok) {
        console.log(`  ${f.padEnd(20)} → HTTP ${res.status}: ${(await res.text()).slice(0, 100)}`)
        continue
      }
      const j = (await res.json()) as { ok: boolean; races?: Race[]; error?: string }
      if (!j.ok || !j.races) {
        console.log(`  ${f.padEnd(20)} → API error: ${j.error}`)
        continue
      }
      for (const r of j.races) merge(r)
      const got = j.races.map((x) => `R${x.raceNumber}(${x.runners?.length || 0})`).join(' ')
      console.log(`  ${f.padEnd(20)} → ${got}  [${((Date.now() - t0) / 1000).toFixed(1)}s]`)
    } catch (e) {
      console.log(`  ${f.padEnd(20)} → ERR ${e instanceof Error ? e.message.slice(0, 80) : e}`)
    }
  }

  // diff vs ground truth
  console.log(`\n  ── rebuilt field vs committed field.json ──`)
  let matched = 0, missing = 0, extra = 0, renamed = 0
  for (const gt of field) {
    const re = rebuilt.get(gt.raceNumber)
    if (!re) {
      console.log(`  R${gt.raceNumber}: MISSING ENTIRELY (${gt.runners.length} runners)`)
      missing += gt.runners.length
      continue
    }
    const diffs: string[] = []
    for (const run of gt.runners) {
      const got = re.get(run.number)
      if (!got) { missing++; diffs.push(`-${run.number}.${run.name}`); continue }
      if (fuzzyEq(nameKey(got.name), nameKey(run.name))) matched++
      else { renamed++; diffs.push(`~${run.number}: "${got.name}" vs "${run.name}"`) }
    }
    for (const num of re.keys()) if (!gt.runners.some((r) => r.number === num)) { extra++; diffs.push(`+${num}.${re.get(num)!.name}`) }
    const status = diffs.length === 0 ? 'EXACT' : diffs.join('  ')
    console.log(`  R${String(gt.raceNumber).padStart(2)}: ${re.size}/${gt.runners.length} runners  ${status}`)
  }
  const total = field.reduce((n, r) => n + r.runners.length, 0)
  console.log(`\n  CARD RESULT: ${matched}/${total} matched, ${renamed} renamed, ${missing} missing, ${extra} extra\n`)
  return { matched, total, renamed, missing, extra }
}

// ── Test 2: grounded tip extraction ─────────────────────────────────────────

const byRace = new Map<number, { num: Map<number, string>; names: string[] }>()
const allNames: string[] = []
for (const r of field) {
  const num = new Map<number, string>(), names: string[] = []
  for (const run of r.runners) {
    const k = nameKey(run.name)
    num.set(run.number, k); names.push(k); allNames.push(k)
  }
  byRace.set(r.raceNumber, { num, names })
}
const fuzzyInList = (k: string, list: string[]) => list.some((n) => fuzzyEq(k, n))

type Verdict = 'valid' | 'wrong_number' | 'cross_race' | 'phantom'
function judgePick(raceNum: number, horseNum: number | undefined, horseName: string): Verdict {
  const race = byRace.get(raceNum)
  const k = nameKey(horseName)
  if (!race) return fuzzyInList(k, allNames) ? 'cross_race' : 'phantom'
  if (k && fuzzyInList(k, race.names)) {
    const atNum = horseNum != null ? race.num.get(horseNum) : undefined
    if (horseNum != null && atNum && !fuzzyEq(atNum, k)) return 'wrong_number'
    return 'valid'
  }
  if (horseNum != null && race.num.has(horseNum)) return 'valid'
  if (k && fuzzyInList(k, allNames)) return 'cross_race'
  return 'phantom'
}

// the endpoint expects field as {races:[...]} JSON string
const fieldPayload = JSON.stringify({ races: field })

interface SseResult { extraction: any; inTok: number; outTok: number; error?: string }

async function parseSse(res: Response): Promise<SseResult> {
  const out: SseResult = { extraction: null, inTok: 0, outTok: 0 }
  const reader = res.body!.getReader()
  const dec = new TextDecoder()
  let buf = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let idx: number
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const chunk = buf.slice(0, idx); buf = buf.slice(idx + 2)
      const line = chunk.split('\n').find((l) => l.startsWith('data: '))
      if (!line) continue
      const payload = line.slice(6)
      if (payload === '[DONE]') continue
      try {
        const ev = JSON.parse(payload)
        if (ev.type === 'extraction') out.extraction = ev.payload
        else if (ev.type === 'tokens') { out.inTok = ev.input; out.outTok = ev.output }
        else if (ev.type === 'error') out.error = ev.message
      } catch { /* partial frame */ }
    }
  }
  return out
}

interface SheetScore { sheet: string; picks: number; valid: number; wrongNum: number; crossRace: number; phantom: number; inTok: number; outTok: number; ms: number; err?: string }

async function testTips() {
  console.log(`\n━━ TEST 2: /api/extract (V2 field-grounded) on prod ━━\n`)
  const scores: SheetScore[] = []
  for (const f of filesFor(TIP_PREFIXES)) {
    const fd = new FormData()
    fd.set('image', fileBlob(f), f)
    fd.set('field', fieldPayload)
    const t0 = Date.now()
    const sc: SheetScore = { sheet: f, picks: 0, valid: 0, wrongNum: 0, crossRace: 0, phantom: 0, inTok: 0, outTok: 0, ms: 0 }
    try {
      const res = await post('/api/extract', fd)
      if (!res.ok) {
        sc.err = `HTTP ${res.status}: ${(await res.text()).slice(0, 120)}`
      } else {
        const r = await parseSse(res)
        sc.inTok = r.inTok; sc.outTok = r.outTok
        if (r.error) sc.err = r.error
        else if (!r.extraction) sc.err = 'no extraction event (truncated or parse fail)'
        else {
          for (const race of r.extraction.races || []) {
            for (const tip of race.tips || []) {
              for (const sel of tip.selections || []) {
                sc.picks++
                const v = judgePick(race.raceNumber, sel.horseNumber, sel.horseName || '')
                if (v === 'valid') sc.valid++
                else if (v === 'wrong_number') sc.wrongNum++
                else if (v === 'cross_race') sc.crossRace++
                else sc.phantom++
              }
            }
          }
        }
      }
    } catch (e) {
      sc.err = e instanceof Error ? e.message.slice(0, 120) : String(e)
    }
    sc.ms = Date.now() - t0
    scores.push(sc)
    const pct = sc.picks ? ((sc.valid / sc.picks) * 100).toFixed(1) : '—'
    console.log(`  ${f.padEnd(20)} → ${sc.err ? `ERR ${sc.err}` : `${sc.picks} picks, ${pct}% valid, xrace ${sc.crossRace}, phantom ${sc.phantom}, wrongNum ${sc.wrongNum}`}  [${(sc.ms / 1000).toFixed(1)}s, out ${sc.outTok}]`)
  }

  const tot = scores.reduce((a, s) => ({
    picks: a.picks + s.picks, valid: a.valid + s.valid, wrongNum: a.wrongNum + s.wrongNum,
    crossRace: a.crossRace + s.crossRace, phantom: a.phantom + s.phantom,
    inTok: a.inTok + s.inTok, outTok: a.outTok + s.outTok,
  }), { picks: 0, valid: 0, wrongNum: 0, crossRace: 0, phantom: 0, inTok: 0, outTok: 0 })
  const errs = scores.filter((s) => s.err)
  const cost = tot.inTok * (3 / 1e6) + tot.outTok * (15 / 1e6)

  console.log(`\n  TIP RESULT: ${tot.picks} picks — valid ${tot.valid} (${((tot.valid / Math.max(tot.picks, 1)) * 100).toFixed(2)}%), wrong_number ${tot.wrongNum}, cross_race ${tot.crossRace}, phantom ${tot.phantom}`)
  console.log(`  errors: ${errs.length}/${scores.length} sheets${errs.length ? ' — ' + errs.map((e) => e.sheet).join(', ') : ''}`)
  console.log(`  tokens: in ${tot.inTok} / out ${tot.outTok}  (~$${cost.toFixed(2)})\n`)
  writeFileSync('scripts/eval/prod-results.json', JSON.stringify(scores, null, 2))
  return scores
}

async function main() {
  console.log(`prod: ${PROD}`)
  console.log(`dir:  ${dir} (${filesFor(GUIDE_PREFIXES).length} guides, ${filesFor(TIP_PREFIXES).length} tips)`)
  if (doCards) await testCards()
  if (doTips) await testTips()
}
main().catch((e) => { console.error('FATAL:', e); process.exit(1) })
