<script lang="ts">
  import { onMount } from 'svelte'
  import { uploadImage } from '$lib/uploadImage'
  import { loadImageUrl } from '$lib/imageUrl'
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
    /** Re-extract an already-approved card from its stored images (no fresh upload). */
    existingImageStorageIds?: string[]
    /**
     * Seed the review with the already-approved field. This is the EDIT/ADD
     * path: Pete's prior corrections are the starting point, so editing never
     * wipes the rest, and a freshly-dropped card MERGES into them.
     */
    existingRaces?: UserFieldRace[]
    /**
     * Where to land when seeded. 'review' → edit in place (default).
     * 'pick'   → show the dropzone so Pete can ADD another card; the drop
     *            merges into the seeded field rather than replacing it.
     */
    seedStage?: 'review' | 'pick'
  }

  let {
    clientId,
    meetingKey,
    meetingLabel,
    meetingDate,
    onClose,
    onApproved,
    existingImageStorageIds,
    existingRaces,
    seedStage = 'review'
  }: Props = $props()

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
  // Source-card thumbnails (object URLs for fresh uploads, signed URLs from storage).
  let previewUrls = $state<string[]>([])

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
    // Edit mode: seed straight from the already-approved field. No extraction —
    // Pete's existing runners (with all prior corrections) ARE the starting
    // point, so editing one cell can never reset the rest of the field.
    if (existingRaces && existingRaces.length > 0) {
      void seedFromApprovedField(existingRaces)
      return
    }
    // Re-extract mode: no fresh upload — pull the saved card from storage and
    // go straight to review (Pete can then correct + re-approve).
    if (existingImageStorageIds && existingImageStorageIds.length > 0) {
      void extractFromStorage(existingImageStorageIds)
    }
  })

  async function seedFromApprovedField(seed: UserFieldRace[]): Promise<void> {
    races = seed
      .slice()
      .sort((a, b) => a.raceNumber - b.raceNumber)
      .map((race) => ({ ...race, runners: race.runners.slice() }))
    sourceFilenames = ['approved field']
    const ids = existingImageStorageIds ?? []
    if (ids.length > 0) {
      previewUrls = (await Promise.all(ids.map((id) => loadImageUrl(id)))).filter(
        (u): u is string => !!u
      )
    }
    // 'pick' for ADD mode: keep the seeded races as the merge base but show the
    // dropzone so the next card extends the field. handleFiles merges into it.
    stage = seedStage
  }

  async function extractFromStorage(storageIds: string[]): Promise<void> {
    stage = 'extracting'
    errorMsg = null
    progressMsg = 'Re-reading the saved card…'
    try {
      const fd = new FormData()
      fd.append('imageStorageIds', JSON.stringify(storageIds))
      fd.append('clientId', clientId)
      fd.append('meetingKey', meetingKey)
      const r = await fetch('/api/extract-card', { method: 'POST', body: fd })
      const j = (await r.json()) as
        | { ok: true; races: UserFieldRace[]; hintsApplied?: number }
        | { ok: false; error: string }
      if (!r.ok || !('ok' in j) || j.ok !== true) {
        errorMsg = 'ok' in j && !j.ok ? j.error : `HTTP ${r.status}`
        stage = 'error'
        return
      }
      races = j.races
        .slice()
        .sort((a, b) => a.raceNumber - b.raceNumber)
        .map((race) => ({ ...race, runners: race.runners.slice().sort((a, b) => a.number - b.number) }))
      hintsApplied = j.hintsApplied ?? 0
      sourceFilenames = ['saved card']
      previewUrls = (await Promise.all(storageIds.map((id) => loadImageUrl(id)))).filter(
        (u): u is string => !!u
      )
      stage = races.length > 0 ? 'review' : 'error'
      if (races.length === 0) errorMsg = 'No races extracted from the saved card.'
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : 'Re-extract failed'
      stage = 'error'
    }
  }

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
    const incoming = Array.from(list)
    // Append, don't replace — retain prior files (re-extract source) and any
    // seeded field so dropping another card ADDS to it.
    files = [...files, ...incoming]
    previewUrls = [...previewUrls, ...incoming.map((f) => URL.createObjectURL(f))]
    stage = 'extracting'
    errorMsg = null
    // Seed the merge from whatever's already in the table (the approved field
    // on ADD, or earlier drops). New races extend it; same race numbers gain
    // any runners not already present; existing distance is kept.
    const mergedByRace = new Map<number, UserFieldRace>()
    for (const r of races) mergedByRace.set(r.raceNumber, { ...r, runners: r.runners.slice() })
    const filenames = [...sourceFilenames]
    let i = 0
    for (const file of incoming) {
      i += 1
      progressMsg = `Extracting ${i}/${incoming.length} — ${file.name}`
      const out = await extractFile(file)
      if (!out) {
        stage = 'error'
        return
      }
      filenames.push(out.filename)
      for (const race of out.races) {
        const existingRace = mergedByRace.get(race.raceNumber)
        if (!existingRace) {
          mergedByRace.set(race.raceNumber, { ...race, runners: race.runners.slice() })
          continue
        }
        const seenNumbers = new Set(existingRace.runners.map((r) => r.number))
        for (const rn of race.runners) {
          if (!seenNumbers.has(rn.number)) {
            existingRace.runners.push(rn)
            seenNumbers.add(rn.number)
          }
        }
        if (existingRace.distance == null && race.distance != null) {
          existingRace.distance = race.distance
        }
      }
    }
    races = Array.from(mergedByRace.values())
      .sort((a, b) => a.raceNumber - b.raceNumber)
      .map((r) => ({ ...r, runners: r.runners.slice().sort((a, b) => a.number - b.number) }))
    sourceFilenames = Array.from(new Set(filenames))
    stage = races.length > 0 ? 'review' : 'error'
    if (races.length === 0) errorMsg = 'No races extracted from the upload.'
  }

  // Whether a re-extract has an image to read: a retained upload, or a saved card.
  const hasReExtractSource = $derived(files.length > 0 || (existingImageStorageIds?.length ?? 0) > 0)

  // Chat re-extract: re-run the whole card with the reviewer's correction
  // (and the current table state as the prior answer), then replace the table.
  async function reExtract(): Promise<void> {
    const note = feedback.trim()
    const storageIds = existingImageStorageIds ?? []
    if (!note || reExtracting) return
    // Need the image source: retained upload files, or the saved card. When a
    // field was approved without a stored image (or the original was edited
    // away), there's nothing to re-read — say so instead of silently no-opping.
    if (files.length === 0 && storageIds.length === 0) {
      errorMsg =
        'Re-extract needs the source card image, but none is saved for this field. Attach the card below, then re-extract.'
      return
    }
    reExtracting = true
    errorMsg = null
    try {
      const fd = new FormData()
      if (files.length > 0) for (const f of files) fd.append('image', f)
      else fd.append('imageStorageIds', JSON.stringify(storageIds))
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

  // Attach a card image purely as the re-extract source (no merge/replace) —
  // lets Pete re-read a field whose original image was never stored.
  function attachReExtractSource(list: FileList | null): void {
    if (!list || list.length === 0) return
    const incoming = Array.from(list)
    files = [...files, ...incoming]
    previewUrls = [...previewUrls, ...incoming.map((f) => URL.createObjectURL(f))]
    errorMsg = null
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

  // Drop a whole race — for when the extractor pulled in a race that isn't the
  // focus of this card (an adjacent/background race that bled in).
  function removeRace(rIdx: number): void {
    races = races.filter((_, i) => i !== rIdx)
  }

  async function approve(): Promise<void> {
    stage = 'saving'
    // Persist the card image(s) so the field can be re-extracted in a later
    // session (best-effort — keep whatever uploads succeed).
    const seeded = (existingRaces?.length ?? 0) > 0
    // Fresh upload (no seed): the uploaded images ARE the card set.
    // Seeded (edit / add): OMIT imageStorageIds — "leave the stored images
    // alone". This keeps the originals and is safe against the current backend,
    // whose replace-on-supply would otherwise delete them. (Persisting the
    // newly-added card's image for re-extract waits on the diff-based image
    // logic in userFields.setForMeeting being deployed.)
    let imageStorageIds: string[] | undefined
    if (!seeded) {
      const uploaded = (await Promise.all(files.map((f) => uploadImage(f)))).filter(
        (id): id is string => !!id
      )
      imageStorageIds = uploaded.length > 0 ? uploaded : undefined
    }
    const ok = await saveUserField({ clientId, meetingKey, races, sourceFilenames, imageStorageIds })
    if (!ok) {
      stage = 'error'
      errorMsg = 'Failed to save approved field.'
      return
    }
    stage = 'done'
    await onApproved()
  }

  function close(): void {
    for (const u of previewUrls) if (u.startsWith('blob:')) URL.revokeObjectURL(u)
    onClose()
  }
</script>

<div
  class="fixed inset-0 z-50 flex items-start justify-center bg-[#1e3a5f]/40 backdrop-blur-sm p-4 overflow-y-auto"
  role="dialog"
  aria-modal="true"
>
  <div class="w-full max-w-5xl my-8 rounded-2xl border border-[#1e3a5f]/10 bg-white shadow-2xl overflow-hidden">
    <header class="flex items-baseline justify-between px-6 py-4 border-b border-[#1e3a5f]/10 bg-[#f8f9fa]">
      <div>
        <div class="text-[10px] uppercase tracking-[0.2em] text-[#e94e37] font-bold">
          official race card · {meetingDate}
        </div>
        <h2 class="text-2xl font-bold text-[#1e3a5f] mt-1">{meetingLabel}</h2>
      </div>
      <button
        type="button"
        onclick={close}
        class="text-[11px] uppercase tracking-wider text-[#5f6368] hover:text-[#1e3a5f] font-bold"
      >
        close ✕
      </button>
    </header>

    {#snippet learnedHints(heading: string)}
      {#if relevantHints.length > 0}
        <div class="mb-4 rounded-lg border border-[#4285f4]/25 bg-[#4285f4]/5 px-4 py-2.5">
          <button type="button" class="flex w-full items-center justify-between" onclick={() => (showHints = !showHints)}>
            <span class="text-[11px] uppercase tracking-wider text-[#4285f4] font-bold">
              {showHints ? '▾' : '▸'} {heading} ({relevantHints.length})
            </span>
            <span class="text-[10px] uppercase tracking-wider text-[#5f6368] font-bold">applied automatically</span>
          </button>
          {#if showHints}
            <ul class="mt-2 space-y-1.5">
              {#each relevantHints as h (h.id)}
                <li class="flex items-start gap-2 text-sm">
                  <span class="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-white border border-[#1e3a5f]/10 text-[#5f6368] shrink-0" title="{h.scope} scope">{h.scope}</span>
                  <span class="flex-1 text-[#1e3a5f]/90">{h.hint}</span>
                  <button type="button" class="text-[10px] uppercase tracking-wider font-bold text-[#5f6368] hover:text-[#e94e37] shrink-0" title="Stop applying & remove this hint" onclick={() => removeHint(h)}>✕</button>
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
        <div class="rounded-xl border-2 border-dashed border-[#1e3a5f]/15 bg-[#f8f9fa] px-6 py-10 text-center">
          <p class="text-xl font-bold text-[#1e3a5f]">Drop the official card image(s)</p>
          <p class="mt-2 text-[#4a4a4a]">
            One image for the full meeting, or several — they merge by race number.
            We'll extract <span class="font-semibold text-[#1e3a5f]">number · horse · jockey · trainer · barrier · scratched · emergency</span>,
            then you review and approve.
          </p>
          <label class="inline-block mt-6 cursor-pointer rounded-lg bg-[#1e3a5f] hover:bg-[#18304d] px-5 py-2.5 text-white text-sm font-bold shadow-sm transition-colors">
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
        <div class="rounded-xl border border-[#1e3a5f]/10 bg-[#f8f9fa] px-6 py-10 text-center">
          <p class="text-xl font-bold text-[#1e3a5f]">Reading the card…</p>
          <p class="mt-2 text-xs uppercase tracking-wider text-[#5f6368] font-bold">
            {progressMsg}
          </p>
        </div>
      {:else if stage === 'review'}
        <div class="mb-4 flex items-baseline justify-between">
          <p class="text-[11px] uppercase tracking-wider text-[#5f6368] font-bold">
            review {races.length} race{races.length === 1 ? '' : 's'} ·
            {races.reduce((n, r) => n + r.runners.length, 0)} runners ·
            source{sourceFilenames.length === 1 ? '' : 's'} · {sourceFilenames.join(' + ')}
          </p>
          <p class="text-[10px] uppercase tracking-wider text-[#5f6368] font-bold">
            edit any field — then approve to lock in
          </p>
        </div>
        {@render learnedHints('learned & applied to this card')}
        {#if previewUrls.length > 0}
          <div class="mb-4 flex gap-2 overflow-x-auto pb-1">
            {#each previewUrls as src, i (i)}
              <a href={src} target="_blank" rel="noreferrer" title="Open full card image" class="shrink-0">
                <img src={src} alt="source card {i + 1}" class="h-24 rounded-lg border border-[#1e3a5f]/15" />
              </a>
            {/each}
          </div>
        {/if}
        <div class="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
          {#each races as race, rIdx (race.raceNumber)}
            <section class="rounded-xl border border-[#1e3a5f]/10 bg-white overflow-hidden shadow-sm">
              <header class="px-3 py-2 border-b border-[#1e3a5f]/10 bg-[#f8f9fa] flex items-baseline gap-3">
                <span class="text-[10px] uppercase tracking-wider text-[#5f6368] font-bold">race</span>
                <span class="text-xl font-bold text-[#4285f4]">{race.raceNumber}</span>
                <span class="text-[#4a4a4a] text-sm">
                  {race.runners.length} runner{race.runners.length === 1 ? '' : 's'}
                </span>
                <button
                  type="button"
                  class="ml-auto text-[10px] font-bold uppercase tracking-wider text-[#5f6368] hover:text-red-600"
                  title="Remove this race — it isn't the focus of this card"
                  onclick={() => removeRace(rIdx)}
                >
                  remove race
                </button>
              </header>
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="text-left text-[#5f6368] text-[10px] uppercase tracking-wider font-bold bg-[#f8f9fa]/60">
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
                      <tr class="border-t border-[#1e3a5f]/8 {runner.scratched ? 'opacity-50 line-through' : ''} {runner.emergency ? 'bg-[#e94e37]/5' : ''}">
                        <td class="px-2 py-1">
                          <div class="flex items-center gap-1">
                            <input
                              type="number"
                              value={runner.number}
                              class="w-14 bg-[#f8f9fa] border border-[#1e3a5f]/15 rounded px-1.5 py-1 text-[#1e3a5f] focus:border-[#4285f4] focus:ring-2 focus:ring-[#4285f4]/30 focus:outline-none"
                              onchange={(e) => updateRunner(rIdx, runnerIdx, 'number', (e.currentTarget as HTMLInputElement).value)}
                            />
                            {#if runner.emergency}
                              <span class="text-[9px] uppercase tracking-wider font-bold text-[#e94e37]" title="Emergency runner">e</span>
                            {/if}
                          </div>
                        </td>
                        <td class="px-2 py-1">
                          <input
                            type="text"
                            value={runner.name}
                            class="w-full bg-[#f8f9fa] border border-[#1e3a5f]/15 rounded px-1.5 py-1 text-[#1e3a5f] focus:border-[#4285f4] focus:ring-2 focus:ring-[#4285f4]/30 focus:outline-none"
                            onchange={(e) => updateRunner(rIdx, runnerIdx, 'name', (e.currentTarget as HTMLInputElement).value)}
                          />
                        </td>
                        <td class="px-2 py-1">
                          <input
                            type="text"
                            value={runner.jockey ?? ''}
                            class="w-full bg-[#f8f9fa] border border-[#1e3a5f]/15 rounded px-1.5 py-1 text-[#1e3a5f] focus:border-[#4285f4] focus:ring-2 focus:ring-[#4285f4]/30 focus:outline-none"
                            onchange={(e) => updateRunner(rIdx, runnerIdx, 'jockey', (e.currentTarget as HTMLInputElement).value)}
                          />
                        </td>
                        <td class="px-2 py-1">
                          <input
                            type="text"
                            value={runner.trainer ?? ''}
                            class="w-full bg-[#f8f9fa] border border-[#1e3a5f]/15 rounded px-1.5 py-1 text-[#1e3a5f] focus:border-[#4285f4] focus:ring-2 focus:ring-[#4285f4]/30 focus:outline-none"
                            onchange={(e) => updateRunner(rIdx, runnerIdx, 'trainer', (e.currentTarget as HTMLInputElement).value)}
                          />
                        </td>
                        <td class="px-2 py-1">
                          <input
                            type="number"
                            value={runner.barrier ?? ''}
                            class="w-14 bg-[#f8f9fa] border border-[#1e3a5f]/15 rounded px-1.5 py-1 text-[#1e3a5f] focus:border-[#4285f4] focus:ring-2 focus:ring-[#4285f4]/30 focus:outline-none"
                            onchange={(e) => updateRunner(rIdx, runnerIdx, 'barrier', (e.currentTarget as HTMLInputElement).value)}
                          />
                        </td>
                        <td class="px-2 py-1 text-center">
                          <input
                            type="checkbox"
                            class="accent-[#4285f4]"
                            checked={runner.scratched ?? false}
                            onchange={() => toggleScratched(rIdx, runnerIdx)}
                          />
                        </td>
                        <td class="px-2 py-1 text-center">
                          <input
                            type="checkbox"
                            class="accent-[#e94e37]"
                            checked={runner.emergency ?? false}
                            onchange={() => toggleEmergency(rIdx, runnerIdx)}
                          />
                        </td>
                        <td class="px-2 py-1 text-right">
                          <button
                            type="button"
                            class="text-[10px] uppercase tracking-wider font-bold text-[#5f6368] hover:text-[#e94e37]"
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
        <div class="mt-5 rounded-xl border border-[#1e3a5f]/10 bg-[#f8f9fa] px-4 py-3">
          <div class="flex items-baseline justify-between">
            <p class="text-[11px] uppercase tracking-wider text-[#5f6368] font-bold">
              not right? tell it what to fix
            </p>
            {#if hintsApplied > 0}
              <span class="text-[10px] uppercase tracking-wider text-[#4285f4] font-bold" title="Learned corrections applied to this extraction">
                {hintsApplied} learned hint{hintsApplied === 1 ? '' : 's'} applied
              </span>
            {/if}
          </div>
          {#if feedbackHistory.length > 0}
            <ul class="mt-2 space-y-1">
              {#each feedbackHistory as note, i (i)}
                <li class="text-[#4a4a4a] text-xs flex gap-2">
                  <span class="text-[#5f6368]">↳</span><span>{note}</span>
                </li>
              {/each}
            </ul>
          {/if}
          <textarea
            bind:value={feedback}
            rows="2"
            disabled={reExtracting}
            placeholder="e.g. the emergencies for race 1 bled into race 2 — keep them in race 1"
            class="mt-2 w-full bg-white border border-[#1e3a5f]/15 rounded-lg px-2.5 py-1.5 text-[#1e3a5f] text-sm focus:border-[#4285f4] focus:ring-2 focus:ring-[#4285f4]/30 focus:outline-none"
          ></textarea>
          {#if !hasReExtractSource}
            <label class="mt-2 flex cursor-pointer items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#4285f4]">
              <input
                type="file"
                accept="image/*"
                multiple
                class="hidden"
                onchange={(e) => attachReExtractSource((e.currentTarget as HTMLInputElement).files)}
              />
              <span class="rounded-lg border border-dashed border-[#4285f4]/40 px-3 py-1.5 hover:bg-[#4285f4]/5">+ attach card image to re-read</span>
            </label>
            <p class="mt-1 text-[10px] text-[#5f6368]">No source image is saved for this field — attach the card to enable re-extract.</p>
          {/if}
          <div class="mt-2 flex items-center justify-end">
            <button
              type="button"
              disabled={reExtracting || !feedback.trim()}
              class="rounded-lg border border-[#1e3a5f]/20 bg-white hover:bg-[#f1f3f4] disabled:opacity-40 text-[11px] uppercase tracking-wider font-bold px-3 py-1.5 text-[#1e3a5f] transition-colors"
              onclick={reExtract}
            >
              {reExtracting ? 're-reading…' : 'Re-extract with this note'}
            </button>
          </div>

          <!-- Teach: distill the corrections into a reusable rule (Pete reviews) -->
          {#if feedbackHistory.length > 0}
            <div class="mt-3 border-t border-[#1e3a5f]/10 pt-3">
              {#if !proposedHint}
                <button
                  type="button"
                  disabled={teaching}
                  class="text-[11px] uppercase tracking-wider font-bold text-[#4285f4] hover:underline disabled:opacity-40"
                  onclick={suggestRule}
                >
                  {teaching ? 'thinking…' : '✦ teach this for future cards'}
                </button>
              {:else}
                <p class="text-[10px] uppercase tracking-wider text-[#5f6368] font-bold">review the rule, then save</p>
                <textarea
                  bind:value={proposedHint}
                  rows="2"
                  class="mt-1.5 w-full bg-white border border-[#4285f4]/40 rounded-lg px-2.5 py-1.5 text-[#1e3a5f] text-sm focus:border-[#4285f4] focus:ring-2 focus:ring-[#4285f4]/30 focus:outline-none"
                ></textarea>
                <div class="mt-2 flex items-center justify-between gap-3">
                  <label class="flex items-center gap-2 text-[#4a4a4a] text-xs">
                    apply to
                    <select bind:value={hintScope} class="bg-white border border-[#1e3a5f]/15 rounded px-1.5 py-1 text-[#1e3a5f] focus:border-[#4285f4] focus:outline-none">
                      <option value="venue">{meetingVenue} only</option>
                      <option value="category">all {meetingCategory} cards</option>
                      <option value="global">all cards</option>
                    </select>
                  </label>
                  <div class="flex items-center gap-2">
                    <button type="button" class="text-[10px] uppercase tracking-wider font-bold text-[#5f6368] hover:text-[#1e3a5f]" onclick={() => (proposedHint = '')}>cancel</button>
                    <button
                      type="button"
                      disabled={savingHint || !proposedHint.trim()}
                      class="rounded-lg bg-[#4285f4] text-white text-[11px] uppercase tracking-wider font-bold px-3 py-1.5 hover:bg-[#3573d6] disabled:opacity-40 transition-colors"
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
            class="text-[11px] uppercase tracking-wider font-bold text-[#5f6368] hover:text-[#1e3a5f] px-3 py-2"
            onclick={close}
          >
            cancel
          </button>
          <button
            type="button"
            class="rounded-lg bg-[#1e3a5f] text-white text-[11px] uppercase tracking-wider font-bold px-5 py-2.5 hover:bg-[#18304d] shadow-sm transition-colors"
            onclick={approve}
          >
            approve &amp; lock field →
          </button>
        </footer>
      {:else if stage === 'saving'}
        <div class="rounded-xl border border-[#1e3a5f]/10 bg-[#f8f9fa] px-6 py-10 text-center">
          <p class="text-xl font-bold text-[#1e3a5f]">Locking field…</p>
        </div>
      {:else if stage === 'done'}
        <div class="rounded-xl border border-[#16a34a]/30 bg-[#16a34a]/10 px-6 py-10 text-center">
          <p class="text-xl font-bold text-[#1e3a5f]">Field approved.</p>
          <p class="mt-2 text-[#4a4a4a]">Tips are now anchored to your authoritative card.</p>
        </div>
      {:else if stage === 'error'}
        <div class="rounded-xl border border-[#e94e37]/40 bg-[#e94e37]/8 px-6 py-10 text-center">
          <p class="text-xl font-bold text-[#1e3a5f]">Couldn't read that one.</p>
          <p class="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#4a4a4a]">{errorMsg}</p>
          <button
            type="button"
            class="mt-5 text-[11px] uppercase tracking-wider font-bold text-[#5f6368] hover:text-[#1e3a5f] px-3 py-2"
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
