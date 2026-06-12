// The four method variants under test. V0 is the live app prompt, lifted
// verbatim. V1-V3 are the tuning hypotheses.
//
//   V0  baseline      verbose reasoning[]      no field        no thinking   (current prod)
//   V1  bounded       ~4 terse reasoning steps no field        no thinking
//   V2  grounded      bounded reasoning        FIELD in prompt no thinking
//   V3  thinking      no reasoning[] output    FIELD in prompt native adaptive

import { liftPrompt } from './lib.ts'

export const V0_PROMPT = liftPrompt('packages/web/src/routes/api/extract/+server.ts', 'SYSTEM_PROMPT')

// Bounded: same job + schema, but cap the reasoning narration. We rewrite the
// two lines that drive unbounded prose (instruction #8 + the reasoning schema hint).
export const V1_PROMPT = V0_PROMPT
  .replace(
    '  8. NARRATE every non-trivial decision: which prefixes you stripped, which duplicates you resolved',
    '  8. Record only genuinely non-trivial decisions as flags[]. Keep reasoning[] to AT MOST 4 short steps.'
  )
  .replace(
    '    "<a sentence per non-trivial observation>"',
    '    "<at most 4 terse steps total — not a sentence per observation>"'
  )

// Field-grounded: V1 + an injected official field. The model anchors picks to
// the known runners of each race instead of guessing.
export function v2Prompt(fieldText: string): string {
  return V1_PROMPT + `

OFFICIAL FIELD (authoritative — these are the ONLY valid runners per race):
${fieldText}

Use the field to resolve every pick:
- Match each selection to a runner in the SAME race by number first, then name.
- If a selection's number/name is not in that race's field, it is a misread or cross-race contamination — correct it to the right runner if obvious, else OMIT it and add an "uncertain" flag. Never emit a pick that isn't in the field.`
}

// Thinking: V2's grounding, but drop reasoning[] from the OUTPUT (the model
// reasons in the native thinking channel instead) — keep flags[] as the audit.
export function v3Prompt(fieldText: string): string {
  return v2Prompt(fieldText)
    .replace(/  8\. .*\n/, '  8. Think privately about ambiguities before answering. Do NOT include a reasoning[] array — output only data + flags.\n')
    .replace(/  "reasoning": \[[\s\S]*?\],\n/, '')
}

export const INSTRUCTION = 'Extract this tip sheet. Reason first, then output the JSON object. No prose outside JSON.'
export const INSTRUCTION_V3 = 'Extract this tip sheet. Output only the JSON object (data + flags). No prose outside JSON.'

// Compact the field.json into a token-lean text block for the prompt.
export function fieldToText(field: any[]): string {
  return field.map(r =>
    `R${r.raceNumber}: ${r.runners.filter((x:any)=>!x.scratched).map((x:any)=>`${x.number} ${x.name}`).join(', ')}`
  ).join('\n')
}
