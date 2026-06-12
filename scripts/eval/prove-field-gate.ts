// Proof: the Field Gate catches real error patterns against the real Randwick
// field, and ignores spelling/country-code noise. Deterministic, zero API.
//
//   npx tsx scripts/eval/prove-field-gate.ts

import { readFileSync } from 'node:fs'
import { validateAgainstField } from '../../packages/shared/src/fieldGate.ts'
import type { FieldRunner } from '../../packages/shared/src/fieldMatch.ts'

const field = JSON.parse(readFileSync('scripts/eval/field.json', 'utf8')) as Array<{
  raceNumber: number
  runners: Array<{ number: number; name: string }>
}>

// field.json → Map<raceNumber, FieldRunner[]>
const fieldByRace = new Map<number, FieldRunner[]>(
  field.map((r) => [
    r.raceNumber,
    r.runners.map((x) => ({
      number: x.number, name: x.name, jockey: '', trainer: '', barrier: 0, scratched: false,
    })),
  ]),
)

// Minimal AggregatedTip factory
const tip = (horseName: string, horseNumber?: number) => ({
  horseName, horseNumber, totalTips: 1, tipsterCount: 1, winTips: 1, place2Tips: 0, place3Tips: 0, place4Tips: 0,
})
const race = (raceNumber: number, tips: ReturnType<typeof tip>[]) => ({
  category: 'SR' as const, raceNumber, meetingName: 'Randwick', tips,
  totalSelectionsInRace: tips.length, totalTipstersInRace: 1,
})

// Test set: 3 real errors + 3 noise cases the gate must NOT flag.
const races = [
  race(4, [
    tip('Just Glamourous', 6),     // clean → no flag
    tip('Just Glamorous', 6),      // spelling drift (no 'u') → must MATCH, no flag
    tip('Extraordinaire', 2),      // country-code drop ((FR)) → must MATCH, no flag
    tip('Bravissima', 7),          // field has Bravissima as #3 → NUMBER_MISMATCH
  ]),
  race(5, [
    tip('Just Glamourous', 6),     // runs in R4 → CROSS_RACE (attributed to R4 #6)
    tip('Imaginary Nag', 14),      // nowhere in field → PHANTOM
  ]),
]

const flags = validateAgainstField(races, fieldByRace)

console.log('\n  ── THE FIELD GATE — deterministic catch on real field ──\n')
console.log(`  6 picks checked  ·  ${flags.length} flagged  ·  3 clean (spelling/country noise ignored)\n`)
for (const f of flags) console.log(`  ⚑ [${f.type}]  ${f.description}`)

const kinds = flags.map((f) => f.type).sort().join(',')
const expected = 'cross_race,number_mismatch,phantom'
const pass = kinds === expected && flags.length === 3
console.log(`\n  expected: ${expected}`)
console.log(`  got:      ${kinds}`)
console.log(`\n  ${pass ? '✓ PASS — catches the 3 real errors, ignores the 3 noise cases' : '✗ FAIL'}\n`)
process.exit(pass ? 0 : 1)
