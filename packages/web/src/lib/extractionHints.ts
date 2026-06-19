// Learned extraction corrections (compounding) — shared types, an isomorphic
// relevance filter (used server-side when injecting into the prompt), and
// client wrappers for the review UI.

export type HintScope = 'global' | 'category' | 'venue'

export interface ExtractionHint {
  id: string
  scope: HintScope
  category?: string
  venue?: string
  hint: string
  source: 'manual' | 'derived'
  createdAt: number
  /** Present only on the "all" variant (loadAllHints); active hints are injected into prompts. */
  active?: boolean
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase()
}

/**
 * Pick the hints that apply to a given meeting. Global hints always apply;
 * category/venue hints apply only when they match. Pure — safe on the server.
 */
export function selectRelevantHints(
  hints: ReadonlyArray<ExtractionHint>,
  ctx: { category?: string; venue?: string }
): ExtractionHint[] {
  const cat = norm(ctx.category)
  const venue = norm(ctx.venue)
  return hints.filter((h) => {
    if (h.scope === 'global') return true
    if (h.scope === 'category') return norm(h.category) === cat && cat !== ''
    if (h.scope === 'venue') return norm(h.venue) === venue && venue !== ''
    return false
  })
}

/** Render relevant hints as a system-prompt block, or '' if none. */
export function hintsPromptBlock(hints: ReadonlyArray<ExtractionHint>): string {
  if (hints.length === 0) return ''
  const lines = hints.map((h) => `- ${h.hint.trim()}`).join('\n')
  return `\n\nLEARNED CORRECTIONS — this customer's reviewer fixed these before on similar cards. Apply them:\n${lines}`
}

// ── Client wrappers ──────────────────────────────────────

export async function loadHints(clientId: string): Promise<ExtractionHint[]> {
  try {
    const r = await fetch(`/api/extraction-hints?clientId=${encodeURIComponent(clientId)}`)
    if (!r.ok) return []
    const j = (await r.json()) as { hints: ExtractionHint[] }
    return j.hints
  } catch {
    return []
  }
}

/**
 * Load ALL hints for a client — active and inactive, across every scope —
 * each carrying an `active` flag. Powers the global "what it's learned" page.
 */
export async function loadAllHints(clientId: string): Promise<ExtractionHint[]> {
  try {
    const r = await fetch(
      `/api/extraction-hints?clientId=${encodeURIComponent(clientId)}&all=1`
    )
    if (!r.ok) return []
    const j = (await r.json()) as { hints: ExtractionHint[] }
    return j.hints
  } catch {
    return []
  }
}

export async function saveHint(input: {
  clientId: string
  scope: HintScope
  category?: string
  venue?: string
  hint: string
  source?: 'manual' | 'derived'
}): Promise<boolean> {
  try {
    const r = await fetch('/api/extraction-hints', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input)
    })
    return r.ok
  } catch {
    return false
  }
}

export async function setHintActive(clientId: string, id: string, active: boolean): Promise<boolean> {
  try {
    const r = await fetch('/api/extraction-hints', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientId, id, active })
    })
    return r.ok
  } catch {
    return false
  }
}

export async function deleteHint(clientId: string, id: string): Promise<boolean> {
  try {
    const r = await fetch(
      `/api/extraction-hints?clientId=${encodeURIComponent(clientId)}&id=${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    )
    return r.ok
  } catch {
    return false
  }
}

/** Turn a raw reviewer correction into a clean, general, reusable rule. */
export async function distillHint(input: {
  feedback: string
  category?: string
  venue?: string
}): Promise<string> {
  try {
    const r = await fetch('/api/distill-hint', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input)
    })
    if (!r.ok) return input.feedback
    const j = (await r.json()) as { hint?: string }
    return j.hint?.trim() || input.feedback
  } catch {
    return input.feedback
  }
}
