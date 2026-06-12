// Runs all four variants over the tip sheets, scores each extraction against
// the ground-truth field, writes results.json + prints a comparison table.
//
//   npx tsx scripts/eval/run-eval.ts <dir> [tip-prefixes]
//
// Requires scripts/eval/field.json (build-field.ts) to exist first.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { extname } from 'node:path'
import { call, imageBlock, parseLooseJson, nameKey, fuzzyEq, MEDIA, PRICE_IN, PRICE_OUT } from './lib.ts'
import { V0_PROMPT, V1_PROMPT, v2Prompt, v3Prompt, INSTRUCTION, INSTRUCTION_V3, fieldToText } from './variants.ts'

const dir = process.argv[2] || '/tmp/tta_batch'
const tipPrefixes = (process.argv[3] || '413,414,415,416,417,418,419,420,421,422').split(',')
const MAX_TOKENS = Number(process.env.MAX_TOKENS || 16384)
const OUT_FILE = process.env.OUT_FILE || 'scripts/eval/results.json'

const field = JSON.parse(readFileSync('scripts/eval/field.json', 'utf8'))
const fieldText = fieldToText(field)

// index field: raceNumber -> { num:Map<int,nameKey>, names:nameKey[] }, + global list
const byRace = new Map<number, { num: Map<number,string>; names: string[] }>()
const allNames: string[] = []
for (const r of field) {
  const num = new Map<number,string>(), names: string[] = []
  for (const run of r.runners) {
    const k = nameKey(run.name)
    num.set(run.number, k); names.push(k); allNames.push(k)
  }
  byRace.set(r.raceNumber, { num, names })
}
const fuzzyInList = (k: string, list: string[]) => list.some(n => fuzzyEq(k, n))

type Verdict = 'valid' | 'wrong_number' | 'cross_race' | 'phantom'
function judgePick(raceNum: number, horseNum: number | undefined, horseName: string): Verdict {
  const race = byRace.get(raceNum)
  const k = nameKey(horseName)
  if (!race) return fuzzyInList(k, allNames) ? 'cross_race' : 'phantom'
  // name fuzzy-matches a runner in THIS race → valid (number may be misread = wrong_number)
  if (k && fuzzyInList(k, race.names)) {
    const atNum = horseNum != null ? race.num.get(horseNum) : undefined
    if (horseNum != null && atNum && !fuzzyEq(atNum, k)) return 'wrong_number'
    return 'valid'
  }
  // no name match here — but a correct saddlecloth number in this race anchors it
  if (horseNum != null && race.num.has(horseNum)) return 'valid'
  // name lives in another race → contamination
  if (k && fuzzyInList(k, allNames)) return 'cross_race'
  return 'phantom'
}

interface SheetScore { sheet: string; variant: string; truncated: boolean; picks: number; valid: number; wrongNum: number; crossRace: number; phantom: number; inTok: number; outTok: number; ms: number; err?: string }

function scoreExtraction(j: any): { picks:number; valid:number; wrongNum:number; crossRace:number; phantom:number } {
  let picks=0, valid=0, wrongNum=0, crossRace=0, phantom=0
  for (const race of (j?.races || [])) {
    const rn = race.raceNumber
    for (const tip of (race.tips || [])) {
      for (const sel of (tip.selections || [])) {
        picks++
        const v = judgePick(rn, sel.horseNumber, sel.horseName)
        if (v==='valid') valid++; else if (v==='wrong_number') wrongNum++; else if (v==='cross_race') crossRace++; else phantom++
      }
    }
  }
  return { picks, valid, wrongNum, crossRace, phantom }
}

const ALL_VARIANTS = [
  { id:'V0_baseline', system:()=>V0_PROMPT,        instr:INSTRUCTION,    thinking:false },
  { id:'V1_bounded',  system:()=>V1_PROMPT,        instr:INSTRUCTION,    thinking:false },
  { id:'V2_grounded', system:()=>v2Prompt(fieldText), instr:INSTRUCTION, thinking:false },
  { id:'V3_thinking', system:()=>v3Prompt(fieldText), instr:INSTRUCTION_V3, thinking:true },
]
const FILTER = (process.env.VARIANTS || '').split(',').filter(Boolean)
const VARIANTS = FILTER.length ? ALL_VARIANTS.filter(v => FILTER.includes(v.id)) : ALL_VARIANTS

async function main() {
  const sheets = readdirSync(dir).filter(f => MEDIA[extname(f).toLowerCase()]).filter(f => tipPrefixes.some(p => f.includes(p))).sort()
  console.log(`\n  ${sheets.length} tip sheets × ${VARIANTS.length} variants = ${sheets.length*VARIANTS.length} calls  (max_tokens=${MAX_TOKENS}, streaming)\n`)
  const rows: SheetScore[] = []
  for (const sheet of sheets) {
    for (const v of VARIANTS) {
      try {
        const r = await call({
          system: v.system(),
          content: [imageBlock(dir, sheet), { type:'text', text: v.instr }],
          maxTokens: MAX_TOKENS,
          thinking: v.thinking,
        })
        const j = parseLooseJson(r.text)
        const s = scoreExtraction(j)
        rows.push({ sheet, variant:v.id, truncated:r.truncated, ...s, inTok:r.inTok, outTok:r.outTok, ms:r.ms })
        console.log(`  ${sheet.slice(-7)} ${v.id.padEnd(12)} picks:${String(s.picks).padStart(3)} ok:${String(s.valid).padStart(3)} xrace:${s.crossRace} phantom:${s.phantom} wrong#:${s.wrongNum} ${r.truncated?'TRUNC ':''}[${r.outTok}out]`)
      } catch (e) {
        rows.push({ sheet, variant:v.id, truncated:false, picks:0,valid:0,wrongNum:0,crossRace:0,phantom:0, inTok:0,outTok:0,ms:0, err:e instanceof Error?e.message:String(e) })
        console.log(`  ${sheet.slice(-7)} ${v.id.padEnd(12)} ERR ${(e instanceof Error?e.message:String(e)).slice(0,50)}`)
      }
    }
  }
  writeFileSync(OUT_FILE, JSON.stringify(rows, null, 2))

  // aggregate per variant
  console.log(`\n  ════════════════ RESULTS BY VARIANT ════════════════`)
  console.log(`  variant       picks  valid%  xrace  phantom  wrong#  trunc  out-tok   $/sheet`)
  for (const v of VARIANTS) {
    const rs = rows.filter(r => r.variant===v.id && !r.err)
    const picks = rs.reduce((a,r)=>a+r.picks,0)
    const valid = rs.reduce((a,r)=>a+r.valid,0)
    const xr = rs.reduce((a,r)=>a+r.crossRace,0)
    const ph = rs.reduce((a,r)=>a+r.phantom,0)
    const wn = rs.reduce((a,r)=>a+r.wrongNum,0)
    const tr = rs.filter(r=>r.truncated).length
    const inT = rs.reduce((a,r)=>a+r.inTok,0), outT = rs.reduce((a,r)=>a+r.outTok,0)
    const cost = inT*PRICE_IN + outT*PRICE_OUT
    const validPct = picks? (100*valid/picks).toFixed(1) : '—'
    console.log(`  ${v.id.padEnd(12)} ${String(picks).padStart(5)}  ${String(validPct).padStart(5)}  ${String(xr).padStart(5)}  ${String(ph).padStart(7)}  ${String(wn).padStart(6)}  ${String(tr).padStart(5)}  ${String(Math.round(outT/Math.max(rs.length,1))).padStart(7)}  $${(cost/Math.max(rs.length,1)).toFixed(4)}`)
  }
  console.log(`  ─────────────────────────────────────────────────────`)
  console.log(`  valid% = picks that exist in the official field for their race`)
  console.log(`  xrace  = pick belongs to a different race (contamination)`)
  console.log(`  phantom= horse not in the field at all`)
  console.log(`  results → scripts/eval/results.json\n`)
}
main().catch(e => { console.error('FATAL:', e); process.exit(1) })
