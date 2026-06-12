<script lang="ts">
  // v0-skinned meeting card over the workspace engine. Same data + persistence
  // plumbing as the dark MeetingCard — only the presentation differs.
  import RaceCard from './RaceCard.svelte'
  import SpecialBetsDisplay from './SpecialBetsDisplay.svelte'
  import ClassicAggTable from './ClassicAggTable.svelte'
  import { categoryConfig } from '$lib/classic/categoryConfig'
  import {
    buildMeetingCsv,
    buildCsvFilename,
    calculateQuaddie
  } from '@tta/shared'
  import type { MeetingGroup, HorsePatch } from '$lib/workspace'

  interface Props {
    group: MeetingGroup
    clientId: string
    onPatchesChange: (patches: HorsePatch[], label?: string, notes?: string) => void
    onClearMeeting: () => Promise<void>
    onResolveField: () => Promise<void>
    onUploadCard?: () => void
    /**
     * Embedded mode: the parent (WorkMeetingCard) already renders the
     * meeting header + lifecycle actions, so suppress this card's own
     * header and outer chrome to avoid a doubled title.
     */
    embedded?: boolean
  }
  let { group, clientId, onPatchesChange, onClearMeeting, onResolveField, onUploadCard, embedded = false }: Props = $props()

  let showCorrections = $state(false)
  let showReasoning = $state(false)
  let includeFieldData = $state(false)
  let resolvingField = $state(false)
  let busy = $state(false)
  let shareUrl = $state<string | null>(null)
  let savedAt = $state<number | null>(null)
  let openRowId = $state<string | null>(null)
  let publishing = $state(false)
  let publishMsg = $state<string | null>(null)
  let publishErr = $state<string | null>(null)

  // svelte-ignore state_referenced_locally
  let labelDraft = $state(group.label ?? '')
  // svelte-ignore state_referenced_locally
  let notesDraft = $state(group.notes ?? '')
  let metaDirty = $state(false)

  $effect(() => {
    labelDraft = group.label ?? ''
    notesDraft = group.notes ?? ''
    metaDirty = false
  })

  const FIELD_REASON: Record<string, string> = {
    no_api_key: 'field key not configured',
    field_unavailable: 'field not published yet',
    resolver_unreachable: 'resolver offline',
    request_failed: 'request failed'
  }
  const fieldReason = (r: string) => FIELD_REASON[r] ?? r.replace(/^http_/, 'resolver error ')

  function applyPatch(patch: HorsePatch): void {
    const filtered = group.patches.filter(
      (p) => !(p.raceNumber === patch.raceNumber && p.originalName === patch.originalName)
    )
    onPatchesChange([...filtered, patch] as HorsePatch[], labelDraft || undefined, notesDraft || undefined)
    savedAt = Date.now()
  }
  function clearRow(raceNumber: number, originalName: string): void {
    const next = group.patches.filter(
      (p) => !(p.raceNumber === raceNumber && p.originalName === originalName)
    )
    onPatchesChange(next as HorsePatch[], labelDraft || undefined, notesDraft || undefined)
    savedAt = Date.now()
  }
  function saveMeta(): void {
    onPatchesChange(group.patches as HorsePatch[], labelDraft || undefined, notesDraft || undefined)
    metaDirty = false
    savedAt = Date.now()
  }

  function downloadBlob(filename: string, mime: string, content: string): void {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function exportCsv(): void {
    const csv = buildMeetingCsv(
      group.aggregated,
      { meeting: group.label ?? group.meeting, date: group.date },
      { includeFieldData }
    )
    downloadBlob(buildCsvFilename(group.label ?? group.meeting, group.date), 'text/csv;charset=utf-8', csv)
  }

  function exportJson(): void {
    const payload = {
      meeting: group.label ?? group.meeting,
      category: group.category,
      date: group.date,
      tipstersDetected: group.totalTipsters,
      races: group.aggregated,
      quaddie: calculateQuaddie(group.aggregated),
      notes: group.notes ?? ''
    }
    downloadBlob(
      buildCsvFilename(group.label ?? group.meeting, group.date).replace(/\.csv$/, '.json'),
      'application/json',
      JSON.stringify(payload, null, 2)
    )
  }

  async function publishToSite(): Promise<void> {
    publishing = true
    publishMsg = null
    publishErr = null
    try {
      const csv = buildMeetingCsv(
        group.aggregated,
        { meeting: group.label ?? group.meeting, date: group.date },
        { includeFieldData }
      )
      const res = await fetch('/api/publish-wp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          csv,
          title: `${group.label ?? group.meeting} — ${group.date}`,
          raceDate: group.date
        })
      })
      const j = (await res.json().catch(() => null)) as
        | { ok?: boolean; shortcodeId?: string; stats?: { races: number; tipsters: number } }
        | { message?: string }
        | null
      if (!res.ok || !(j && 'ok' in j && j.ok)) {
        const msg = j && 'message' in j && j.message ? j.message : `HTTP ${res.status}`
        throw new Error(msg)
      }
      const ok = j as { shortcodeId?: string; stats?: { races: number; tipsters: number } }
      publishMsg = `Published to site · ${ok.stats?.races ?? '?'} races, ${ok.stats?.tipsters ?? '?'} tipsters · id ${ok.shortcodeId ?? ''}`
    } catch (e) {
      publishErr = e instanceof Error ? e.message : 'Publish failed'
    } finally {
      publishing = false
    }
  }

  async function makeShareLink(): Promise<void> {
    busy = true
    try {
      const payload = {
        meeting: group.label ?? group.meeting,
        category: group.category,
        date: group.date,
        tipstersDetected: group.totalTipsters,
        races: group.aggregated,
        notes: group.notes ?? ''
      }
      const res = await fetch('/api/snapshot', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clientId, meetingKey: group.meetingKey, payload })
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const j = (await res.json()) as { token: string }
      shareUrl = `${window.location.origin}/share/${j.token}`
      try {
        await navigator.clipboard.writeText(shareUrl)
      } catch {
        /* clipboard blocked */
      }
    } catch (e) {
      console.error('share failed', e)
      shareUrl = null
    } finally {
      busy = false
    }
  }

  async function refetchField(): Promise<void> {
    resolvingField = true
    try {
      await onResolveField()
    } finally {
      resolvingField = false
    }
  }

  const config = $derived(categoryConfig[group.category as keyof typeof categoryConfig] ?? categoryConfig.OR)
</script>

<article class="card animate-slide-up overflow-hidden" style="padding:0;{embedded ? 'border:none;box-shadow:none;border-radius:0;' : ''}">
  <!-- Header -->
  {#if !embedded}
  <header class="border-b border-soft px-6 py-5" style="background:linear-gradient(to right, rgba(30,58,95,0.04), rgba(66,133,244,0.04));">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0 flex-1">
        <div class="mb-1 flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span class="rounded-full px-2 py-0.5" style="color:{config.color};background:{config.bgColor}">{group.category} · {config.name}</span>
          <span class="c-muted uppercase tracking-wider">{group.date}</span>
          {#if group.flagCount > 0}
            <span class="c-destructive uppercase tracking-wider">{group.flagCount} flag{group.flagCount === 1 ? '' : 's'}</span>
          {/if}
          {#if group.field.state === 'resolved'}
            <span class="c-success uppercase tracking-wider" title="{group.field.source} · {group.field.citations.length} source(s)">field ✓</span>
          {:else if group.field.state === 'pending'}
            <span class="c-muted uppercase tracking-wider">field · resolving…</span>
          {:else}
            <span class="c-muted uppercase tracking-wider">field n/a · {fieldReason(group.field.reason)}</span>
          {/if}
          {#if group.fieldFlags.length > 0}
            <span class="c-destructive uppercase tracking-wider">{group.fieldFlags.length} field flag{group.fieldFlags.length === 1 ? '' : 's'}</span>
          {/if}
        </div>
        <h2 class="c-primary truncate text-2xl font-bold md:text-3xl">{group.label ?? group.meeting}</h2>
        <div class="c-muted mt-1 text-sm">
          {group.rows.length} image{group.rows.length === 1 ? '' : 's'} ·
          {group.totalTipsters.length} tipster{group.totalTipsters.length === 1 ? '' : 's'} ·
          {group.raceNumbers.length} race{group.raceNumbers.length === 1 ? '' : 's'}
        </div>
      </div>
      <div class="flex shrink-0 items-baseline gap-3 text-xs font-bold uppercase tracking-wider">
        {#if onUploadCard}
          <button
            class="c-accent hover:underline"
            onclick={onUploadCard}
            title="Upload the official race card(s) — extract, review, approve"
          >
            upload race cards →
          </button>
        {/if}
        <button class="c-accent disabled:opacity-50 hover:underline" disabled={resolvingField || group.field.state === 'pending'} onclick={refetchField}>
          {resolvingField ? 'resolving…' : group.field.state === 'resolved' ? 'refresh field' : 'resolve field'}
        </button>
      </div>
    </div>
  </header>
  {/if}

  <!-- Field flags + sources -->
  {#if group.fieldFlags.length > 0 || (group.field.state === 'resolved' && group.field.citations.length > 0)}
    <section class="border-b border-soft px-6 py-3">
      {#if group.fieldFlags.length > 0}
        <ul class="mb-2 space-y-1">
          {#each group.fieldFlags as f (f.description)}
            <li class="flex items-baseline gap-2 text-sm">
              <span class="shrink-0 text-xs font-bold uppercase tracking-wider {f.type === 'tip_on_scratched' ? 'c-destructive' : 'c-accent'}">
                {f.type === 'tip_on_scratched' ? 'scratched' : 'unmatched'}
              </span>
              <span class="c-muted">{f.description}</span>
            </li>
          {/each}
        </ul>
      {/if}
      {#if group.field.state === 'resolved' && group.field.citations.length > 0}
        <div class="c-muted text-xs">
          sources:
          {#each group.field.citations.slice(0, 4) as c, i (c)}
            <a href={c} target="_blank" rel="noreferrer" class="c-accent ml-1 underline">[{i + 1}]</a>
          {/each}
        </div>
      {/if}
    </section>
  {/if}

  <!-- Aggregated results (v0 RaceCards) -->
  <section class="space-y-6 px-6 py-6">
    {#each group.aggregated as race (race.raceNumber)}
      <RaceCard {race} />
    {/each}
  </section>

  <!-- Special bets -->
  <section class="border-t border-soft px-6 py-6">
    <SpecialBetsDisplay races={group.aggregated} />
  </section>

  <!-- Corrections (collapsible editor) -->
  <section class="border-t border-soft px-6 py-4">
    <button class="c-primary text-sm font-bold uppercase tracking-wider hover:underline" onclick={() => (showCorrections = !showCorrections)}>
      {showCorrections ? '▾' : '▸'} Corrections {group.patches.length > 0 ? `(${group.patches.length})` : ''}
    </button>
    {#if showCorrections}
      <div class="mt-4 space-y-4">
        <div class="grid gap-3 md:grid-cols-2">
          <label class="block">
            <span class="c-muted text-xs font-semibold uppercase tracking-wider">Display label</span>
            <input class="form-input mt-1" bind:value={labelDraft} oninput={() => (metaDirty = true)} placeholder={group.meeting} />
          </label>
          <label class="block">
            <span class="c-muted text-xs font-semibold uppercase tracking-wider">Notes for customers</span>
            <input class="form-input mt-1" bind:value={notesDraft} oninput={() => (metaDirty = true)} placeholder="optional — appears in JSON export" />
          </label>
          {#if metaDirty}
            <div class="md:col-span-2">
              <button class="c-accent text-xs font-bold uppercase tracking-wider hover:underline" onclick={saveMeta}>save</button>
            </div>
          {/if}
        </div>
        <ClassicAggTable races={group.aggregated} patches={group.patches} onPatch={applyPatch} onClearRow={clearRow} />
      </div>
    {/if}
  </section>

  <!-- Reasoning inspector -->
  <section class="border-t border-soft px-6 py-4">
    <button class="c-primary text-sm font-bold uppercase tracking-wider hover:underline" onclick={() => (showReasoning = !showReasoning)}>
      {showReasoning ? '▾' : '▸'} Source images · agent reasoning
    </button>
    {#if showReasoning}
      <div class="mt-3 space-y-2">
        {#each group.rows as row (row._id)}
          {@const open = openRowId === row._id}
          <div class="rounded-lg border border-soft bg-soft-50">
            <button class="flex w-full items-baseline gap-3 px-4 py-2.5 text-left" onclick={() => (openRowId = open ? null : row._id)}>
              <span class="c-muted shrink-0 text-xs">{open ? '▾' : '▸'}</span>
              <span class="c-fg flex-1 truncate font-medium">{row.filename}</span>
              <span class="c-muted shrink-0 text-xs">
                {row.reasoning.length} steps · {row.flags.length} flag{row.flags.length === 1 ? '' : 's'} · {(row.durationMs / 1000).toFixed(1)}s
              </span>
            </button>
            {#if open}
              <div class="space-y-3 border-t border-soft px-4 pb-4 pt-3">
                {#if row.flags.length > 0}
                  <ul class="space-y-1">
                    {#each row.flags as flag, i (i)}
                      <li class="flex items-baseline gap-2 text-sm">
                        <span class="c-destructive shrink-0 text-xs font-bold uppercase tracking-wider">{flag.type.replace(/_/g, ' ')}</span>
                        <span class="c-muted">{flag.description}{flag.race ? ` (R${flag.race})` : ''}</span>
                      </li>
                    {/each}
                  </ul>
                {/if}
                <ol class="space-y-1">
                  {#each row.reasoning as step, i (i)}
                    <li class="c-muted flex gap-2 text-sm">
                      <span class="c-accent shrink-0">{i + 1}.</span>
                      <span>{step}</span>
                    </li>
                  {/each}
                </ol>
                <div class="c-muted text-xs">{row.tokensIn} in / {row.tokensOut} out · {row.model}</div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </section>

  <!-- Export bar -->
  <footer class="flex flex-wrap items-center justify-between gap-4 border-t border-soft px-6 py-4 bg-soft-50">
    <div class="flex flex-wrap items-center gap-3">
      <button class="btn btn-outline" onclick={exportCsv}>⬇ Download CSV</button>
      <label class="c-muted flex select-none items-center gap-1.5 text-xs font-semibold uppercase tracking-wider" title="Append Jockey / Trainer / Barrier columns">
        <input type="checkbox" bind:checked={includeFieldData} /> + field cols
      </label>
      <button class="btn btn-outline" onclick={exportJson}>⬇ JSON</button>
      <button class="btn btn-outline" disabled={busy} onclick={makeShareLink}>{busy ? 'creating…' : '🔗 Share link'}</button>
      {#if shareUrl}
        <a class="c-accent text-xs underline" href={shareUrl} target="_blank" rel="noreferrer">{shareUrl.replace(/^https?:\/\//, '')}</a>
      {/if}
      <button class="btn btn-primary" disabled={publishing} onclick={publishToSite}>{publishing ? 'publishing…' : '🚀 Publish to site'}</button>
      {#if publishMsg}
        <span class="c-accent text-xs font-semibold">{publishMsg}</span>
      {/if}
      {#if publishErr}
        <span class="text-xs font-semibold" style="color:#e94e37">{publishErr}</span>
      {/if}
    </div>
    <div class="flex items-baseline gap-3">
      {#if savedAt}<span class="c-muted text-xs uppercase tracking-wider">saved · {new Date(savedAt).toLocaleTimeString()}</span>{/if}
      <button
        class="c-muted text-xs font-bold uppercase tracking-wider hover:underline"
        style="color:#e94e37"
        onclick={async () => {
          if (!confirm(`Clear ${group.rows.length} extraction(s) for ${group.label ?? group.meeting}? Cannot be undone.`)) return
          busy = true
          try {
            await onClearMeeting()
          } finally {
            busy = false
          }
        }}
      >
        clear meeting
      </button>
    </div>
  </footer>
</article>
