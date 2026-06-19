// Distill a reviewer's correction into one reusable extraction rule.
//
// POST /api/distill-hint  { feedback, category?, venue? } → { hint }
//
// The "remember this correction" path runs raw feedback ("the emergencies for
// race 1 bled into race 2") through here to get a clean, general, instance-free
// rule ("Emergencies belong to the race listed above the block, not the next
// race.") before it is saved as a standing hint. Pete reviews/edits the result.

import type { RequestHandler } from './$types'
import { error, json } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'
import Anthropic from '@anthropic-ai/sdk'

const MODEL = () => env.TTA_MODEL || 'claude-sonnet-4-6'

const SYSTEM_PROMPT = `You convert a reviewer's correction about Australian horse-racing race-card extraction into ONE concise, general, reusable rule for the extraction model.

- Strip instance specifics (particular race numbers, horse names, dates) unless the rule genuinely depends on them.
- Make it an imperative, self-contained instruction the extractor can apply to ANY future card.
- Output ONLY the rule text. No quotes, no preamble, no markdown. Max ~25 words.`

interface Body {
  feedback?: string
  category?: string
  venue?: string
}

export const POST: RequestHandler = async ({ request }) => {
  const apiKey = env.ANTHROPIC_API_KEY
  if (!apiKey) throw error(500, 'ANTHROPIC_API_KEY not configured')

  const body = (await request.json().catch(() => null)) as Body | null
  const feedback = body?.feedback?.trim()
  if (!feedback) throw error(400, 'Missing feedback')

  const context = [body?.venue ? `Venue: ${body.venue}` : '', body?.category ? `Category: ${body.category}` : '']
    .filter(Boolean)
    .join(' · ')

  const client = new Anthropic({ apiKey, baseURL: 'https://api.anthropic.com' })
  try {
    const msg = await client.messages.create({
      model: MODEL(),
      max_tokens: 256,
      temperature: 0.3,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `${context ? context + '\n\n' : ''}Reviewer correction:\n${feedback}\n\nReturn the general rule.`
        }
      ]
    })
    const hint = msg.content
      .filter((c) => c.type === 'text')
      .map((c) => (c as { type: 'text'; text: string }).text)
      .join('')
      .trim()
      .replace(/^["']|["']$/g, '')
    if (!hint) return json({ hint: feedback }) // fall back to raw if the model returned nothing
    return json({ hint })
  } catch (err) {
    // Distillation is a nicety — never block the user. Fall back to raw text.
    console.error('[distill-hint] failed:', err instanceof Error ? err.message : err)
    return json({ hint: feedback })
  }
}
