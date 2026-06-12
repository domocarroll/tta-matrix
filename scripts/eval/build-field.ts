// Ground-truth field builder. Runs the faithful Gate-1 card prompt over the
// form-guide images, merges runners by race, writes field.json.
//
//   npx tsx scripts/eval/build-field.ts <form-guide-dir> [glob-prefix]
//
// Default: all images in dir. We pass the 503-512 form guides explicitly.

import { readdirSync, writeFileSync } from 'node:fs'
import { extname } from 'node:path'
import { call, imageBlock, liftPrompt, parseLooseJson, MEDIA, PRICE_IN, PRICE_OUT } from './lib.ts'

const dir = process.argv[2] || '/tmp/tta_batch'
const prefixes = (process.argv[3] || '503,504,505,506,507,508,509,510,511,512').split(',')

const CARD_PROMPT = liftPrompt('packages/web/src/routes/api/extract-card/+server.ts', 'SYSTEM_PROMPT')

interface Runner { number: number; name: string; jockey?: string; trainer?: string; barrier?: number; scratched?: boolean }
interface Race { raceNumber: number; distance?: number; runners: Runner[] }

const races = new Map<number, Map<number, Runner>>()  // raceNumber -> number -> runner

function merge(r: Race) {
  if (!r?.runners) return
  if (!races.has(r.raceNumber)) races.set(r.raceNumber, new Map())
  const m = races.get(r.raceNumber)!
  for (const run of r.runners) {
    if (typeof run.number !== 'number' || !run.name) continue
    const prev = m.get(run.number)
    // keep the entry with more populated fields
    const score = (x?: Runner) => x ? Object.values(x).filter(v => v !== '' && v != null).length : -1
    if (score(run) > score(prev)) m.set(run.number, run)
  }
}

async function main() {
  const files = readdirSync(dir)
    .filter(f => MEDIA[extname(f).toLowerCase()])
    .filter(f => prefixes.some(p => f.includes(p)))
    .sort()
  console.log(`\n  field source: ${files.length} form-guide images\n`)
  let inTot = 0, outTot = 0
  for (const f of files) {
    try {
      const r = await call({
        system: CARD_PROMPT,
        content: [imageBlock(dir, f), { type: 'text', text: 'Extract this race card. Output the JSON object only.' }],
        maxTokens: 16384,
      })
      inTot += r.inTok; outTot += r.outTok
      const j = parseLooseJson(r.text)
      const rs: Race[] = j?.races || []
      for (const race of rs) merge(race)
      const got = rs.map(x => `R${x.raceNumber}(${x.runners?.length || 0})`).join(' ')
      console.log(`  ${f.padEnd(18)} → ${got || 'no races'}  [${r.outTok} out${r.truncated?', TRUNC':''}]`)
    } catch (e) {
      console.log(`  ${f.padEnd(18)} → ERR ${e instanceof Error ? e.message.slice(0,60) : e}`)
    }
  }

  // serialise
  const out = [...races.entries()].sort((a,b)=>a[0]-b[0]).map(([rn, m]) => ({
    raceNumber: rn,
    runners: [...m.values()].sort((a,b)=>a.number-b.number),
  }))
  writeFileSync('scripts/eval/field.json', JSON.stringify(out, null, 2))

  console.log(`\n  ──────────────────────────────────────────`)
  console.log(`  GROUND-TRUTH FIELD  (scripts/eval/field.json)`)
  for (const r of out) {
    console.log(`  R${String(r.raceNumber).padStart(2)}: ${r.runners.length} runners  ${r.runners.map(x=>`${x.number}.${x.name}`).join(', ').slice(0,140)}`)
  }
  console.log(`  ──────────────────────────────────────────`)
  console.log(`  cost: $${(inTot*PRICE_IN + outTot*PRICE_OUT).toFixed(4)}  (in ${inTot} / out ${outTot})\n`)
}
main().catch(e => { console.error('FATAL:', e); process.exit(1) })
