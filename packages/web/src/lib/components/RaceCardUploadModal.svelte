<script lang="ts">
  import { onMount } from 'svelte'
  import { saveUserField, type UserFieldRace, type UserFieldRunner } from '$lib/userFields'
  import {
    saveHint,
    loadHints,
    deleteHint,
    distillHint,
    selectRelevantHints,
    type ExtractionHint,
    type HintScope
  } from '$lib/extractionHints'

  interface Props {
    clientId: string
    meetingKey: string
    meetingLabel: string
    meetingDate: string
    onClose: () => void
    onApproved: () => void | Promise<void>
  }

  let { clientId, meetingKey, meetingLabel, meetingDate, onClose, onApproved }: Props = $props()

  type Stage = 'pick' | 'extracting' | 'review' | 'saving' | 'done' | 'error'
  let stage = $state<Stage>('pick')
  let errorMsg = $state<string | null>(null)
  let races = $state<UserFieldRace[]>([])
  let sourceFilenames = $state<string[]>([])
  let progressMsg = $state<string>('')

  // Chat re-extract state. Files are retained so a correction can re-send them.
  let files = $state<File[]>([])
  let feedback = $state('')
  let feedbackHistory = $state<string[]>([])
  let reExtracting = $state(false)
  let hintsApplied = $state(0)

  // Learned-hints (compounding) state.
  let relevantHints = $state<ExtractionHint[]>([])
  let showHints = $state(false)
  let teaching = $state(false) // distillation in flight
  let proposedHint = $state('') // editable distilled rule awaiting save
  let hintScope = $state<HintScope>('venue')
  let savingHint = $state(false)

  // meetingKey = `YYYY-MM-DD|CATEGORY|Venue`. Use the key's venue (not the
  // display label) so creation + the server-side filter agree.
  const meetingCategory = $derived(meetingKey.split('|')[1] ?? '')
  const meetingVenue = $derived(meetingKey.split('|')[2] ?? meetingLabel)

  async function refreshHints(): Promise<void> {
    const all = await loadHints(clientId)
    relevantHints = selectRelevantHints(all, { category: meetingCategory, venue: meetingVenue })
  }

  onMount(() => {
    void refreshHints()
  })

  async function removeHint(h: ExtractionHint): Promise<void> {
    await deleteHint(clientId, h.id)
    await refreshHints()
  }

  // Distill the accumulated corrections into a proposed rule for Pete to edit.
  async function suggestRule(): Promise<void> {
    if (feedbackHistory.length === 0 || teaching) return
    teaching = true
    try {
      proposedHint = await distillHint({
        feedback: feedbackHistory.join(' '),
        category: meetingCategory,
        venue: meetingVenue
      })
    } finally {
      teaching = false
    }
  }

  async function saveProposedHint(): Promise<void> {
    const hint = proposedHint.trim()
    if (!hint || savingHint) return
    savingHint = true
    try {
      await saveHint({
        clientId,
        scope: hintScope,
        category: hintScope === 'global' ? undefined : meetingCategory,
        venue: hintScope === 'venue' ? meetingVenue : undefined,
        hint,
        source: 'derived'
      })
      proposedHint = ''
      await refreshHints()
    } finally {
      savingHint = false
    }
  }

  async function extractFile(file: File): Promise<{ races: UserFieldRace[]; filename: string } | null> {
    const fd = new FormData()
    fd.append('image', file)
    fd.append('clientId', clientId)
    fd.append('meetingKey', meetingKey)
    const r = await fetch('/api/extract-card', { method: 'POST', body: fd })
    const j = (await r.json()) as
      | { ok: true; races: UserFieldRace[]; filename: string; hintsApplied?: number }
      | { ok: false; error: string }
    if (!r.ok || !('ok' in j) || j.ok !== true) {
      errorMsg = 'ok' in j && !j.ok ? j.error : `HTTP ${r.status}`
      return null
    }
    hintsApplied = j.hintsApplied ?? 0
    return { races: j.races, filename: j.filename }
  }

  async function handleFiles(list: FileList | null): Promise<void> {
    if (!list || list.length === 0) return
    files = Array.from(list)
    stage = 'extracting'
    errorMsg = null
    const mergedByRace = new Map<number, UserFieldRunner[]>()
    const filenames: string[] = []
    let i = 0
    for (const file of Array.from(list)) {
      i += 1
      progressMsg = `Extracting ${i}/${list.length} — ${file.name}`
      const out = await extractFile(file)
      if (!out) {
        stage = 'error'
        return
      }
      filenames.push(out.filename)
      for (const race of out.races) {
        const arr = mergedByRace.get(race.raceNumber) ?? []
        // Append runners not already present (by number)
        const seenNumbers = new Set(arr.map((r) => r.number))
        for (const rn of race.runners) {
          if (!seenNumbers.has(rn.number)) {
            arr.push(rn)
            seenNumbers.add(rn.number)
          }
        }
        mergedByRace.set(race.raceNumber, arr)
      }
    }
    races = Array.from(mergedByRace.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([raceNumber, runners]) => ({
        raceNumber,
        runners: runners.sort((a, b) => a.number - b.number)
      }))
    sourceFilenames = filenames
    stage = races.length > 0 ? 'review' : 'error'
    if (races.length === 0) errorMsg = 'No races extracted from the upload.'
  }

  // Chat re-extract: re-run the whole card with the reviewer's correction
  // (and the current table state as the prior answer), then replace the table.
  async function reExtract(): Promise<void> {
    const note = feedback.trim()
    if (!note || files.length === 0 || reExtracting) return
    reExtracting = true
    errorMsg = null
    try {
      const fd = new FormData()
      for (const f of files) fd.append('image', f)
      fd.append('feedback', note)
      fd.append('priorResult', JSON.stringify({ races }))
      fd.append('clientId', clientId)
      fd.append('meetingKey', meetingKey)
      const r = await fetch('/api/extract-card', { method: 'POST', body: fd })
      const j = (await r.json()) as
        | { ok: true; races: UserFieldRace[]; hintsApplied?: number }
        | { ok: false; error: string }
      if (!r.ok || !('ok' in j) || j.ok !== true) {
        errorMsg = 'ok' in j && !j.ok ? j.error : `HTTP ${r.status}`
        return
      }
      races = j.races
        .slice()
        .sort((a, b) => a.raceNumber - b.raceNumber)
        .map((race) => ({ ...race, runners: race.runners.slice().sort((a, b) => a.number - b.number) }))
      hintsApplied = j.hintsApplied ?? hintsApplied
      feedbackHistory = [...feedbackHistory, note]
      feedback = ''
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : 'Re-extract failed'
    } finally {
      reExtracting = false
    }
  }

  function updateRunner(rIdx: number, runnerIdx: number, field: keyof UserFieldRunner, value: string): void {
    const next = races.map((r, i) => {
      if (i !== rIdx) return r
      return {
        ...r,
        runners: r.runners.map((rn, j) => {
          if (j !== runnerIdx) return rn
          if (field === 'number' || field === 'barrier') {
            const n = parseInt(value, 10)
            return { ...rn, [field]: Number.isNaN(n) ? undefined : n } as UserFieldRunner
          }
          if (field === 'scratched') {
            return { ...rn, scratched: value === 'true' }
          }
          return { ...rn, [field]: value } as UserFieldRunner
        })
      }
    })
    races = next
  }

  function toggleScratched(rIdx: number, runnerIdx: number): void {
    const next = races.map((r, i) => {
      if (i !== rIdx) return r
      return {
        ...r,
        runners: r.runners.map((rn, j) =>
          j === runnerIdx ? { ...rn, scratched: !rn.scratched } : rn
        )
      }
    })
    races = next
  }

  function toggleEmergency(rIdx: number, runnerIdx: number): void {
    const next = races.map((r, i) => {
      if (i !== rIdx) return r
      return {
        ...r,
        runners: r.runners.map((rn, j) =>
          j === runnerIdx ? { ...rn, emergency: !rn.emergency } : rn
        )
      }
    })
    races = next
  }

  function removeRunner(rIdx: number, runnerIdx: number): void {
    const next = races.map((r, i) => {
      if (i !== rIdx) return r
      return { ...r, runners: r.runners.filter((_, j) => j !== runnerIdx) }
    })
    races = next
  }

  async function approve(): Promise<void> {
    stage = 'saving'
    const ok = await saveUserField({ clientId, meetingKey, races, sourceFilenames })
    if (!ok) {
      stage = 'error'
      errorMsg = 'Failed to save approved field.'
      return
    }
    stage = 'done'
    await onApproved()
  }

  function close(): void {
    onClose()
  }
</script>

<div
  class="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 overflow-y-auto"
  role="dialog"
  aria-modal="true"
>
  <div class="w-full max-w-5xl my-8 rounded-md border border-border bg-bg-card shadow-2xl">
    <header class="flex items-baseline justify-between px-6 py-4 border-b border-border">
      <div>
        <div class="mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
          official race card · {meetingDate}
        </div>
        <h2 class="serif text-2xl text-text-primary mt-1">{meetingLabel}</h2>
      </div>
      <button
        type="button"
        onclick={close}
        class="mono text-[11px] uppercase tracking-wider text-text-muted hover:text-text-primary"
      >
        close ✕
      </button>
    </header>

    {#snippet learnedHints(heading: string)}
      {#if relevantHints.length > 0}
        <div class="mb-4 rounded-md border border-border bg-bg-surface/20 px-4 py-2.5">
          <button type="button" class="flex w-full items-center justify-between" onclick={() => (showHints = !showHints)}>
            <span class="mono text-[11px] uppercase tracking-wider text-accent">
              {showHints ? '▾' : '▸'} {heading} ({relevantHints.length})
            </span>
            <span class="mono text-[10px] uppercase tracking-wider text-text-muted">applied automatically</span>
          </button>
          {#if showHints}
            <ul class="mt-2 space-y-1.5">
              {#each relevantHints as h (h.id)}
                <li class="flex items-start gap-2 text-sm">
                  <span class="mono text-[9px] uppercase tracking-wider px-1 py-0.5 rounded bg-bg-surface text-text-muted shrink-0" title="{h.scope} scope">{h.scope}</span>
                  <span class="flex-1 text-text-secondary">{h.hint}</span>
                  <button type="button" class="mono text-[10px] uppercase tracking-wider text-text-muted hover:text-error shrink-0" title="Stop applying & remove this hint" onclick={() => removeHint(h)}>✕</button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      {/if}
    {/snippet}

    <div class="px-6 py-5">
      {#if stage === 'pick'}
        {@render learnedHints(`learned for ${meetingVenue}`)}
        <div class="rounded-md border border-dashed border-border bg-bg-surface/40 px-6 py-10 text-center">
          <p class="serif text-xl text-text-primary">Drop the official card image(s)</p>
          <p class="mt-2 text-text-secondary">
            One image for the full meeting, or several — they merge by race number.
            We'll extract <span class="mono">number · horse · jockey · trainer · barrier · scratched · emergency</span>,
            then you review and approve.
          </p>
          <label class="inline-block mt-6 cursor-pointer rounded-md border border-border bg-bg-card hover:bg-bg-card-hover px-5 py-2 text-text-primary">
            <input
              type="file"
              accept="image/*"
              multiple
              class="hidden"
              onchange={(e) => {
                const t = e.currentTarget as HTMLInputElement
                void handleFiles(t.files)
              }}
            />
            choose image(s)
          </label>
        </div>
      {:else if stage === 'extracting'}
        <div class="rounded-md border border-border bg-bg-surface/40 px-6 py-10 text-center">
          <p class="serif text-xl text-text-primary">Reading the card…</p>
          <p class="mt-2 mono text-xs uppercase tracking-wider text-text-muted">
            {progressMsg}
          </p>
        </div>
      {:else if stage === 'review'}
        <div class="mb-4 flex items-baseline justify-between">
          <p class="mono text-[11px] uppercase tracking-wider text-text-muted">
            review {races.length} race{races.length === 1 ? '' : 's'} ·
            {races.reduce((n, r) => n + r.runners.length, 0)} runners ·
            source{sourceFilenames.length === 1 ? '' : 's'} · {sourceFilenames.join(' + ')}
          </p>
          <p class="mono text-[10px] uppercase tracking-wider text-text-muted">
            edit any field — then approve to lock in
          </p>
        </div>
        {@render learnedHints('learned & applied to this card')}
        <div class="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
          {#each races as race, rIdx (race.raceNumber)}
            <section class="rounded-md border border-border bg-bg-surface/30">
              <header class="px-3 py-2 border-b border-border flex items-baseline gap-3">
                <span class="mono text-[10px] uppercase tracking-wider text-text-muted">race</span>
                <span class="serif text-xl text-accent">{race.raceNumber}</span>
                <span class="text-text-secondary text-sm">
                  {race.runners.length} runner{race.runners.length === 1 ? '' : 's'}
                </span>
              </header>
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="text-left text-text-muted mono text-[10px] uppercase tracking-wider">
                      <th class="px-2 py-1.5">#</th>
                      <th class="px-2 py-1.5">Horse</th>
                      <th class="px-2 py-1.5">Jockey</th>
                      <th class="px-2 py-1.5">Trainer</th>
                      <th class="px-2 py-1.5">Brr</th>
                      <th class="px-2 py-1.5">Scr</th>
                      <th class="px-2 py-1.5" title="Emergency / reserve runner">Emg</th>
                      <th class="px-2 py-1.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each race.runners as runner, runnerIdx (runnerIdx)}
                      <tr class="border-t border-border/60 {runner.scratched ? 'opacity-50 line-through' : ''} {runner.emergency ? 'bg-accent/5' : ''}">
                        <td class="px-2 py-1">
                          <div class="flex items-center gap-1">
                            <input
                              type="number"
                              value={runner.number}
                              class="w-14 bg-bg-surface border border-border rounded px-1.5 py-0.5 text-text-primary"
                              onchange={(e) => updateRunner(rIdx, runnerIdx, 'number', (e.currentTarget as HTMLInputElement).value)}
                            />
                            {#if runner.emergency}
                              <span class="mono text-[9px] uppercase tracking-wider text-accent" title="Emergency runner">e</span>
                            {/if}
                          </div>
                        </td>
                        <td class="px-2 py-1">
                          <input
                            type="text"
                            value={runner.name}
                            class="w-full bg-bg-surface border border-border rounded px-1.5 py-0.5 text-text-primary"
                            onchange={(e) => updateRunner(rIdx, runnerIdx, 'name', (e.currentTarget as HTMLInputElement).value)}
                          />
                        </td>
                        <td class="px-2 py-1">
                          <input
                            type="text"
                            value={runner.jockey ?? ''}
                            class="w-full bg-bg-surface border border-border rounded px-1.5 py-0.5 text-text-primary"
                            onchange={(e) => updateRunner(rIdx, runnerIdx, 'jockey', (e.currentTarget as HTMLInputElement).value)}
                          />
                        </td>
                        <td class="px-2 py-1">
                          <input
                            type="text"
                            value={runner.trainer ?? ''}
                            class="w-full bg-bg-surface border border-border rounded px-1.5 py-0.5 text-text-primary"
                            onchange={(e) => updateRunner(rIdx, runnerIdx, 'trainer', (e.currentTarget as HTMLInputElement).value)}
                          />
                        </td>
                        <td class="px-2 py-1">
                          <input
                            type="number"
                            value={runner.barrier ?? ''}
                            class="w-14 bg-bg-surface border border-border rounded px-1.5 py-0.5 text-text-primary"
                            onchange={(e) => updateRunner(rIdx, runnerIdx, 'barrier', (e.currentTarget as HTMLInputElement).value)}
                          />
                        </td>
                        <td class="px-2 py-1 text-center">
                          <input
                            type="checkbox"
                            checked={runner.scratched ?? false}
                            onchange={() => toggleScratched(rIdx, runnerIdx)}
                          />
                        </td>
                        <td class="px-2 py-1 text-center">
                          <input
                            type="checkbox"
                            checked={runner.emergency ?? false}
                            onchange={() => toggleEmergency(rIdx, runnerIdx)}
                          />
                        </td>
                        <td class="px-2 py-1 text-right">
                          <button
                            type="button"
                            class="mono text-[10px] uppercase tracking-wider text-text-muted hover:text-error"
                            onclick={() => removeRunner(rIdx, runnerIdx)}
                          >
                            remove
                          </button>
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </section>
          {/each}
        </div>

        <!-- Chat re-extract: tell it what's wrong and have it redo the card -->
        <div class="mt-5 rounded-md border border-border bg-bg-surface/20 px-4 py-3">
          <div class="flex items-baseline justify-between">
            <p class="mono text-[11px] uppercase tracking-wider text-text-muted">
              not right? tell it what to fix
            </p>
            {#if hintsApplied > 0}
              <span class="mono text-[10px] uppercase tracking-wider text-accent" title="Learned corrections applied to this extraction">
                {hintsApplied} learned hint{hintsApplied === 1 ? '' : 's'} applied
              </span>
            {/if}
          </div>
          {#if feedbackHistory.length > 0}
            <ul class="mt-2 space-y-1">
              {#each feedbackHistory as note, i (i)}
                <li class="text-text-secondary text-xs flex gap-2">
                  <span class="text-text-muted">↳</span><span>{note}</span>
                </li>
              {/each}
            </ul>
          {/if}
          <textarea
            bind:value={feedback}
            rows="2"
            disabled={reExtracting}
            placeholder="e.g. the emergencies for race 1 bled into race 2 — keep them in race 1"
            class="mt-2 w-full bg-bg-surface border border-border rounded px-2 py-1.5 text-text-primary text-sm"
          ></textarea>
          <div class="mt-2 flex items-center justify-end">
            <button
              type="button"
              disabled={reExtracting || !feedback.trim()}
              class="rounded-md border border-border bg-bg-card hover:bg-bg-card-hover disabled:opacity-40 mono text-[11px] uppercase tracking-wider px-3 py-1.5 text-text-primary"
              onclick={reExtract}
            >
              {reExtracting ? 're-reading…' : 'Re-extract with this note'}
            </button>
          </div>

          <!-- Teach: distill the corrections into a reusable rule (Pete reviews) -->
          {#if feedbackHistory.length > 0}
            <div class="mt-3 border-t border-border/60 pt-3">
              {#if !proposedHint}
                <button
                  type="button"
                  disabled={teaching}
                  class="mono text-[11px] uppercase tracking-wider text-accent hover:underline disabled:opacity-40"
                  onclick={suggestRule}
                >
                  {teaching ? 'thinking…' : '✦ teach this for future cards'}
                </button>
              {:else}
                <p class="mono text-[10px] uppercase tracking-wider text-text-muted">review the rule, then save</p>
                <textarea
                  bind:value={proposedHint}
                  rows="2"
                  class="mt-1.5 w-full bg-bg-surface border border-accent/40 rounded px-2 py-1.5 text-text-primary text-sm"
                ></textarea>
                <div class="mt-2 flex items-center justify-between gap-3">
                  <label class="flex items-center gap-2 text-text-secondary text-xs">
                    apply to
                    <select bind:value={hintScope} class="bg-bg-surface border border-border rounded px-1.5 py-0.5 text-text-primary">
                      <option value="venue">{meetingVenue} only</option>
                      <option value="category">all {meetingCategory} cards</option>
                      <option value="global">all cards</option>
                    </select>
                  </label>
                  <div class="flex items-center gap-2">
                    <button type="button" class="mono text-[10px] uppercase tracking-wider text-text-muted hover:text-text-primary" onclick={() => (proposedHint = '')}>cancel</button>
                    <button
                      type="button"
                      disabled={savingHint || !proposedHint.trim()}
                      class="rounded-md border border-accent bg-accent text-bg-primary mono text-[11px] uppercase tracking-wider px-3 py-1.5 hover:bg-accent-bright disabled:opacity-40"
                      onclick={saveProposedHint}
                    >
                      {savingHint ? 'saving…' : 'save rule'}
                    </button>
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <footer class="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            class="mono text-[11px] uppercase tracking-wider text-text-muted hover:text-text-primary px-3 py-2"
            onclick={close}
          >
            cancel
          </button>
          <button
            type="button"
            class="rounded-md border border-accent bg-accent text-bg-primary mono text-[11px] uppercase tracking-wider px-4 py-2 hover:bg-accent-bright"
            onclick={approve}
          >
            approve &amp; lock field →
          </button>
        </footer>
      {:else if stage === 'saving'}
        <div class="rounded-md border border-border bg-bg-surface/40 px-6 py-10 text-center">
          <p class="serif text-xl text-text-primary">Locking field…</p>
        </div>
      {:else if stage === 'done'}
        <div class="rounded-md border border-success/30 bg-success/10 px-6 py-10 text-center">
          <p class="serif text-xl text-text-primary">Field approved.</p>
          <p class="mt-2 text-text-secondary">Tips are now anchored to your authoritative card.</p>
        </div>
      {:else if stage === 'error'}
        <div class="rounded-md border border-error/40 bg-error/10 px-6 py-10 text-center">
          <p class="serif text-xl text-text-primary">Something went wrong.</p>
          <p class="mt-2 text-error mono text-xs">{errorMsg}</p>
          <button
            type="button"
            class="mt-5 mono text-[11px] uppercase tracking-wider text-text-muted hover:text-text-primary px-3 py-2"
            onclick={() => {
              stage = 'pick'
              errorMsg = null
            }}
          >
            try again
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>
