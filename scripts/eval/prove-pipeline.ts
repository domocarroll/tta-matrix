// End-to-end proof of the compound pipeline, on the real field.
//   LABOUR → GROUND → CATCH (Field Gate) → ADJUDICATE (reasoning model, mocked)
// The model call is MOCKED — this proves the CONTRACT and the confidence-gated
// funnel, not the model's real accuracy. Zero API.
//
//   npx tsx scripts/eval/prove-pipeline.ts

import { readFileSync } from 'node:fs'
import { validateAgainstField } from '../../packages/shared/src/fieldGate.ts'
import { reasoningAdjudicator, runAdjudication } from '../../packages/shared/src/adjudicator.ts'
import type { AdjudicationCase, AdjudicationPrompt, RawVerdict } from '../../packages/shared/src/adjudicator.ts'
import type { FieldRunner } from '../../packages/shared/src/fieldMatch.ts'

const field = JSON.parse(readFileSync('scripts/eval/field.json', 'utf8')) as Array<{ raceNumber: number; runners: Array<{ number: number; name: string }> }>
const fieldByRace = new Map<number, FieldRunner[]>(
  field.map((r) => [r.raceNumber, r.runners.map((x) => ({ number: x.number, name: x.name, jockey: '', trainer: '', barrier: 0, scratched: false }))]),
)

const tip = (horseName: string, horseNumber?: number) => ({ horseName, horseNumber, totalTips: 1, tipsterCount: 1, winTips: 1, place2Tips: 0, place3Tips: 0, place4Tips: 0 })
const race = (raceNumber: number, tips: ReturnType<typeof tip>[]) => ({ category: 'SR' as const, raceNumber, meetingName: 'Randwick', tips, totalSelectionsInRace: tips.length, totalTipstersInRace: 1 })

const races = [
  race(4, [tip('Just Glamourous', 6), tip('Bravissima', 7)]),       // clean + a number misread
  race(5, [tip('Just Glamourous', 6), tip('Imaginary Nag', 14)]),   // contamination + phantom
]

// CATCH — the real Field Gate
const flags = validateAgainstField(races, fieldByRace)

// build one adjudication case per flag (field + siblings as context)
const caseFor = (flag: (typeof flags)[number]): AdjudicationCase => {
  const f4 = fieldByRace.get(4)!, f5 = fieldByRace.get(5)!
  if (flag.type === 'number_mismatch') return { flag, pick: tip('Bravissima', 7), raceNumber: 4, field: f4, siblingPicks: races[0].tips }
  if (flag.type === 'cross_race') return { flag, pick: tip('Just Glamourous', 6), raceNumber: 5, field: f5, siblingPicks: races[1].tips }
  return { flag, pick: tip('Imaginary Nag', 14), raceNumber: 5, field: f5, siblingPicks: races[1].tips }
}
const cases = flags.map(caseFor)

// ADJUDICATE — a MOCK reasoning model. number-misread & phantom are clear;
// the cross-race pick is genuinely ambiguous (name=R4 horse, number=R5 #6 Polo)
// → low confidence → the gate downgrades it to a human escalation.
const mockCall = async (p: AdjudicationPrompt): Promise<RawVerdict> => {
  if (p.flag.type === 'number_mismatch') return { resolution: { kind: 'correct', horseName: 'Bravissima', horseNumber: 3, rationale: 'Image shows saddlecloth 3; the "7" was bleed from the adjacent column.' }, confidence: 0.95 }
  if (p.flag.type === 'phantom') return { resolution: { kind: 'drop', rationale: 'No runner reads like this; the row is a footer/header artefact.' }, confidence: 0.92 }
  return { resolution: { kind: 'drop', rationale: 'Probably R4 contamination — but #6 is Polo in R5.' }, confidence: 0.55 } // ambiguous
}

const adjudicator = reasoningAdjudicator({ model: 'claude-opus-4-8', minConfidence: 0.8, call: mockCall })

async function main() {
  const out = await runAdjudication(cases, adjudicator)

  console.log('\n  ════ COMPOUND PIPELINE — labour → ground → catch → adjudicate ════\n')
  console.log('  CATCH (Field Gate, deterministic):')
  for (const f of flags) console.log(`    ⚑ [${f.type}] ${f.description}`)

  console.log(`\n  ADJUDICATE (reasoning model @ minConfidence 0.80, MOCKED):`)
  console.log(`\n    ✓ auto-resolved (${out.resolved.length}) — applied without a human:`)
  for (const v of out.resolved) {
    const r: any = v.resolution
    const what = r.kind === 'correct' ? `→ #${r.horseNumber} ${r.horseName}` : `→ ${r.kind}`
    console.log(`        [${v.case.flag.type}] conf ${v.confidence.toFixed(2)}  ${what}   (${r.rationale})`)
  }
  console.log(`\n    ↑ escalated to human (${out.escalated.length}) — the irreducible residue:`)
  for (const v of out.escalated) {
    console.log(`        [${v.case.flag.type}] conf ${v.confidence.toFixed(2)}  → Pete   (${(v.resolution as any).rationale})`)
  }

  console.log(`\n  the funnel:  ~1,113 picks → ${flags.length} flagged → ${out.resolved.length} auto-resolved → ${out.escalated.length} to a human`)
  console.log(`  cheap model does the labour · cheap code catches · reasoning only touches the ambiguous · human sees ~one\n`)
}
main()
