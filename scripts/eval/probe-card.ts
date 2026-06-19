// Race-card extraction probe — verify the "emergencies bleed into the next
// race" bug on a real card, faithfully, before/after any prompt change.
//
// Runs the LIVE production race-card prompt (lifted verbatim from the route, so
// no drift) against one or more images and prints per-race runner counts +
// numbers, making an off-by-one emergency shift obvious at a glance.
//
// Usage:
//   tsx scripts/eval/probe-card.ts <image> [<image> ...]
//   tsx scripts/eval/probe-card.ts --feedback "emergencies for R1 bled into R2" <image>
//
// --feedback appends a correction note to the user turn — this is the same
// mechanism the planned chat re-extract feature will use, so the probe doubles
// as that experiment's testbed.

import { dirname, basename, resolve } from 'node:path'
import { call, client, MODEL, imageBlock, liftPrompt, parseLooseJson } from './lib.ts'

const ROUTE = 'packages/web/src/routes/api/extract-card/+server.ts'

interface Runner {
  number?: number
  name?: string
  scratched?: boolean
  emergency?: boolean // not in current schema — surfaced if a fixed prompt emits it
}
interface Race {
  raceNumber?: number
  runners?: Runner[]
}

function fmtRunner(r: Runner): string {
  const tags = [r.scratched ? 'SCR' : '', r.emergency ? 'EMG' : ''].filter(Boolean).join(',')
  return `${r.number ?? '?'}:${r.name ?? '?'}${tags ? ` (${tags})` : ''}`
}

async function probe(imgPath: string, feedback?: string): Promise<void> {
  const system = liftPrompt(ROUTE, 'SYSTEM_PROMPT')
  const dir = dirname(resolve(imgPath))
  const file = basename(imgPath)

  let instruction = 'Extract this race card. Output the JSON object only.'
  if (feedback) {
    instruction += `\n\nCORRECTION FROM REVIEWER — your previous attempt was wrong:\n${feedback}\nRedo the extraction keeping this in mind.`
  }

  const res = await call({
    system,
    content: [imageBlock(dir, file), { type: 'text', text: instruction }],
    maxTokens: 16384
  })

  const parsed = parseLooseJson(res.text) as { races?: Race[] } | null
  console.log(`\n=== ${file} ===  (${res.inTok} in / ${res.outTok} out, ${res.ms}ms${res.truncated ? ', TRUNCATED' : ''})`)
  if (!parsed?.races?.length) {
    console.log('  !! no races parsed. raw head:\n', res.text.slice(0, 400))
    return
  }
  for (const race of parsed.races) {
    const runners = race.runners ?? []
    const nums = runners.map((r) => r.number).filter((n): n is number => typeof n === 'number')
    const max = nums.length ? Math.max(...nums) : 0
    const emg = runners.filter((r) => r.emergency).length
    console.log(
      `  R${race.raceNumber}: ${runners.length} runners (max#${max}${emg ? `, ${emg} emergency` : ''})`
    )
    console.log(`     ${runners.map(fmtRunner).join('  ')}`)
  }
}

function printRaces(label: string, parsed: { races?: Race[] } | null): void {
  if (!parsed?.races?.length) {
    console.log(`  ${label}: no races parsed`)
    return
  }
  for (const race of parsed.races) {
    const runners = race.runners ?? []
    const nums = runners.map((r) => r.number).filter((n): n is number => typeof n === 'number')
    const max = nums.length ? Math.max(...nums) : 0
    const emg = runners.filter((r) => r.emergency).length
    console.log(`  ${label} R${race.raceNumber}: ${runners.length} runners (max#${max}${emg ? `, ${emg} emergency` : ''})`)
  }
}

// Faithful two-turn re-extract: pass 1 extracts, pass 2 sends the prior result
// + a reviewer correction (mirrors the /api/extract-card feedback path).
async function twoPass(imgPath: string, feedback: string): Promise<void> {
  const system = liftPrompt(ROUTE, 'SYSTEM_PROMPT')
  const dir = dirname(resolve(imgPath))
  const file = basename(imgPath)
  const img = imageBlock(dir, file)
  const instruction = 'Extract this race card. Output the JSON object only.'

  console.log(`\n=== ${file} — TWO-PASS ===`)
  const first = await call({ system, content: [img, { type: 'text', text: instruction }], maxTokens: 16384 })
  const firstParsed = parseLooseJson(first.text) as { races?: Race[] } | null
  printRaces('pass1', firstParsed)

  console.log(`  -- feedback: "${feedback}"`)
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 16384,
    temperature: 0.1,
    system,
    messages: [
      { role: 'user', content: [img, { type: 'text', text: instruction }] },
      { role: 'assistant', content: first.text },
      {
        role: 'user',
        content: `A human reviewer found problems:\n\n${feedback}\n\nRe-extract the ENTIRE card, applying this correction. Return the FULL JSON for ALL races. Output JSON only.`
      }
    ]
  })
  const secondRaw = msg.content.filter((c) => c.type === 'text').map((c) => (c as { type: 'text'; text: string }).text).join('')
  printRaces('pass2', parseLooseJson(secondRaw) as { races?: Race[] } | null)
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  let feedback: string | undefined
  let twoPassNote: string | undefined
  const fi = argv.indexOf('--feedback')
  if (fi !== -1) {
    feedback = argv[fi + 1]
    argv.splice(fi, 2)
  }
  const ti = argv.indexOf('--two-pass')
  if (ti !== -1) {
    twoPassNote = argv[ti + 1]
    argv.splice(ti, 2)
  }
  if (!argv.length) {
    console.error('usage: tsx scripts/eval/probe-card.ts [--feedback "..."] [--two-pass "<correction>"] <image> [...]')
    process.exit(1)
  }
  for (const img of argv) {
    try {
      if (twoPassNote) await twoPass(img, twoPassNote)
      else await probe(img, feedback)
    } catch (err) {
      console.error(`\n=== ${img} === FAILED:`, err instanceof Error ? err.message : err)
    }
  }
}

void main()
