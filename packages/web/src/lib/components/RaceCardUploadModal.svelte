<script lang="ts">
  import { saveUserField, type UserFieldRace, type UserFieldRunner } from '$lib/userFields'

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

  async function extractFile(file: File): Promise<{ races: UserFieldRace[]; filename: string } | null> {
    const fd = new FormData()
    fd.append('image', file)
    const r = await fetch('/api/extract-card', { method: 'POST', body: fd })
    const j = (await r.json()) as
      | { ok: true; races: UserFieldRace[]; filename: string }
      | { ok: false; error: string }
    if (!r.ok || !('ok' in j) || j.ok !== true) {
      errorMsg = 'ok' in j && !j.ok ? j.error : `HTTP ${r.status}`
      return null
    }
    return { races: j.races, filename: j.filename }
  }

  async function handleFiles(list: FileList | null): Promise<void> {
    if (!list || list.length === 0) return
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

    <div class="px-6 py-5">
      {#if stage === 'pick'}
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
