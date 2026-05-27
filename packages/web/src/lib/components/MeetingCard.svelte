<script lang="ts">
  import AggregationTable from './AggregationTable.svelte'
  import SpecialBets from './SpecialBets.svelte'
  import ReasoningStream from './ReasoningStream.svelte'
  import FlagPanel from './FlagPanel.svelte'
  import {
    buildMeetingCsv,
    buildCsvFilename,
    calculateQuaddie,
    type AggregatedRace
  } from '@tta/shared'
  import type { MeetingGroup, HorsePatch } from '$lib/workspace'

  interface Props {
    group: MeetingGroup
    clientId: string
    onPatchesChange: (patches: HorsePatch[], label?: string, notes?: string) => void
    onClearMeeting: () => Promise<void>
    onResolveField: () => Promise<void>
  }

  let { group, clientId, onPatchesChange, onClearMeeting, onResolveField }: Props = $props()

  let includeFieldData = $state(false)
  let resolvingField = $state(false)

  const FIELD_REASON_LABEL: Record<string, string> = {
    no_api_key: 'Perplexity key not configured',
    field_unavailable: 'field not published yet',
    resolver_unreachable: 'resolver offline',
    request_failed: 'request failed'
  }

  function fieldReasonText(reason: string): string {
    return FIELD_REASON_LABEL[reason] ?? reason.replace(/^http_/, 'resolver error ')
  }

  async function refetchField(): Promise<void> {
    resolvingField = true
    try {
      await onResolveField()
    } finally {
      resolvingField = false
    }
  }

  let expanded = $state(true)
  let openReasoningRowId = $state<string | null>(null)
  // svelte-ignore state_referenced_locally
  let labelDraft = $state(group.label ?? '')
  // svelte-ignore state_referenced_locally
  let notesDraft = $state(group.notes ?? '')
  let busy = $state(false)
  let shareUrl = $state<string | null>(null)
  let savedAt = $state<number | null>(null)
  let metaDirty = $state(false)

  $effect(() => {
    // Sync drafts when group identity changes (different meeting selected)
    labelDraft = group.label ?? ''
    notesDraft = group.notes ?? ''
    metaDirty = false
  })

  function applyPatch(patch: HorsePatch): void {
    // One patch per (raceNumber, originalName) — replace any prior patch
    // for the same row, then append. The new patch carries every override
    // the row still wants (rename, renumber, count overrides, removed).
    const filtered = group.patches.filter(
      (p) => !(p.raceNumber === patch.raceNumber && p.originalName === patch.originalName)
    )
    const next = [...filtered, patch]
    onPatchesChange(next as HorsePatch[], labelDraft || undefined, notesDraft || undefined)
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
      {
        meeting: group.label ?? group.meeting,
        date: group.date
      },
      { includeFieldData }
    )
    downloadBlob(
      buildCsvFilename(group.label ?? group.meeting, group.date),
      'text/csv;charset=utf-8',
      csv
    )
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
      `${buildCsvFilename(group.label ?? group.meeting, group.date).replace(/\.csv$/, '.json')}`,
      'application/json',
      JSON.stringify(payload, null, 2)
    )
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
        body: JSON.stringify({
          clientId,
          meetingKey: group.meetingKey,
          payload
        })
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const j = (await res.json()) as { token: string }
      shareUrl = `${window.location.origin}/share/${j.token}`
      try {
        await navigator.clipboard.writeText(shareUrl)
      } catch {
        /* clipboard may be blocked; user can copy manually */
      }
    } catch (err) {
      console.error('share failed', err)
      shareUrl = null
    } finally {
      busy = false
    }
  }

  function categoryLabel(cat: string): string {
    const labels: Record<string, string> = {
      SR: 'Sydney',
      MR: 'Melbourne',
      BR: 'Brisbane',
      PR: 'Perth',
      AR: 'Adelaide',
      OR: 'Other'
    }
    return labels[cat] ?? cat
  }
</script>

<article class="rounded-lg border border-border bg-bg-card overflow-hidden">
  <header class="px-5 py-4 border-b border-border flex items-baseline justify-between gap-4">
    <div class="min-w-0 flex-1">
      <div class="flex items-baseline gap-3">
        <span class="mono text-[10px] uppercase tracking-[0.18em] text-accent">
          {group.category} · {categoryLabel(group.category)}
        </span>
        <span class="mono text-[10px] uppercase tracking-wider text-text-muted">
          {group.date}
        </span>
        {#if group.flagCount > 0}
          <span class="mono text-[10px] uppercase tracking-wider text-warning">
            {group.flagCount} flag{group.flagCount === 1 ? '' : 's'}
          </span>
        {/if}
        {#if group.field.state === 'resolved'}
          <span
            class="mono text-[10px] uppercase tracking-wider text-success"
            title="{group.field.source} · {group.field.citations.length} source{group.field.citations.length === 1 ? '' : 's'}"
          >
            field ✓ {new Date(group.field.fetchedAt).toLocaleTimeString()}
          </span>
        {:else if group.field.state === 'pending'}
          <span class="mono text-[10px] uppercase tracking-wider text-text-muted">
            field · resolving…
          </span>
        {:else}
          <span class="mono text-[10px] uppercase tracking-wider text-text-muted">
            field unavailable · {fieldReasonText(group.field.reason)}
          </span>
        {/if}
        {#if group.fieldFlags.length > 0}
          <span class="mono text-[10px] uppercase tracking-wider text-warning">
            {group.fieldFlags.length} field flag{group.fieldFlags.length === 1 ? '' : 's'}
          </span>
        {/if}
      </div>
      <h2 class="serif text-2xl text-text-primary mt-1 truncate">
        {group.label ?? group.meeting}
      </h2>
      <div class="mt-1 text-sm text-text-secondary">
        {group.rows.length} image{group.rows.length === 1 ? '' : 's'} ·
        {group.totalTipsters.length} tipster{group.totalTipsters.length === 1 ? '' : 's'} ·
        {group.raceNumbers.length} race{group.raceNumbers.length === 1 ? '' : 's'}
      </div>
      <div class="mt-1 mono text-[10px] uppercase tracking-wider text-text-muted truncate">
        {group.rows.map((r) => r.filename).join(' · ')}
      </div>
    </div>
    <div class="flex items-baseline gap-3 shrink-0">
      <button
        type="button"
        disabled={resolvingField || group.field.state === 'pending'}
        class="mono text-[11px] uppercase tracking-wider text-text-muted hover:text-accent disabled:opacity-50"
        onclick={refetchField}
        title="Re-pull the official field from Perplexity (picks up late scratchings)"
      >
        {resolvingField ? 'resolving…' : group.field.state === 'resolved' ? 'refresh field' : 'resolve field'}
      </button>
      <button
        type="button"
        class="mono text-[11px] uppercase tracking-wider text-text-muted hover:text-text-primary"
        onclick={() => (expanded = !expanded)}
      >
        {expanded ? 'collapse' : 'expand'}
      </button>
    </div>
  </header>

  {#if expanded}
    <!-- Meta editor: label + notes -->
    <section class="px-5 py-3 border-b border-border grid gap-3 md:grid-cols-2">
      <label class="block">
        <span class="mono text-[10px] uppercase tracking-wider text-text-muted">Display label</span>
        <input
          type="text"
          bind:value={labelDraft}
          oninput={() => (metaDirty = true)}
          placeholder={group.meeting}
          class="mt-1 w-full bg-bg-surface border border-border rounded px-2 py-1.5 text-sm text-text-primary"
        />
      </label>
      <label class="block">
        <span class="mono text-[10px] uppercase tracking-wider text-text-muted">Notes for customers</span>
        <input
          type="text"
          bind:value={notesDraft}
          oninput={() => (metaDirty = true)}
          placeholder="optional — appears in JSON export"
          class="mt-1 w-full bg-bg-surface border border-border rounded px-2 py-1.5 text-sm text-text-primary"
        />
      </label>
      {#if metaDirty}
        <div class="md:col-span-2">
          <button
            type="button"
            class="mono text-[10px] uppercase tracking-wider text-accent hover:text-accent-bright"
            onclick={saveMeta}
          >
            save
          </button>
        </div>
      {/if}
    </section>

    <!-- Field resolution: flags + sources -->
    {#if group.fieldFlags.length > 0 || group.field.state === 'resolved'}
      <section class="px-5 py-3 border-b border-border">
        <div class="mono text-[10px] uppercase tracking-wider text-text-muted mb-2">
          authoritative field
          {#if group.field.state === 'resolved'}
            · {group.field.source} · {new Date(group.field.fetchedAt).toLocaleString()}
          {/if}
        </div>
        {#if group.fieldFlags.length > 0}
          <ul class="space-y-1 mb-2">
            {#each group.fieldFlags as f}
              <li class="text-sm flex items-baseline gap-2">
                <span
                  class="mono text-[10px] uppercase tracking-wider shrink-0 {f.type === 'tip_on_scratched' ? 'text-error' : 'text-warning'}"
                >
                  {f.type === 'tip_on_scratched' ? 'scratched' : 'unmatched'}
                </span>
                <span class="text-text-secondary">{f.description}</span>
              </li>
            {/each}
          </ul>
        {/if}
        {#if group.field.state === 'resolved' && group.field.citations.length > 0}
          <div class="mono text-[10px] text-text-muted">
            sources:
            {#each group.field.citations.slice(0, 4) as c, i}
              <a href={c} target="_blank" rel="noreferrer" class="underline text-accent ml-1"
                >[{i + 1}]</a
              >
            {/each}
          </div>
        {/if}
      </section>
    {/if}

    <!-- Aggregation table -->
    <section class="px-5 py-4">
      <AggregationTable
        races={group.aggregated}
        patches={group.patches}
        onPatch={applyPatch}
        onClearRow={clearRow}
      />
    </section>

    <!-- Special bets -->
    <section class="px-5 py-4 border-t border-border">
      <SpecialBets races={group.aggregated} />
    </section>

    <!-- Per-image reasoning + flags inspector -->
    <section class="px-5 py-4 border-t border-border">
      <div class="mono text-[11px] uppercase tracking-wider text-accent mb-3">
        Source images · agent reasoning
      </div>
      <div class="space-y-2">
        {#each group.rows as row (row._id)}
          {@const open = openReasoningRowId === row._id}
          <div class="rounded-md border border-border bg-bg-card">
            <button
              type="button"
              class="w-full flex items-baseline gap-3 px-4 py-2.5 text-left hover:bg-bg-card-hover transition-colors"
              onclick={() => (openReasoningRowId = open ? null : row._id)}
            >
              <span class="mono text-[10px] uppercase tracking-wider text-text-muted shrink-0">
                {open ? '▾' : '▸'}
              </span>
              <span class="text-text-primary truncate flex-1">{row.filename}</span>
              <span class="mono text-[10px] uppercase tracking-wider text-text-muted shrink-0">
                {row.reasoning.length} steps · {row.flags.length} flag{row.flags.length === 1 ? '' : 's'} ·
                {row.tipstersDetected.length} tipster{row.tipstersDetected.length === 1 ? '' : 's'} ·
                {(row.durationMs / 1000).toFixed(1)}s
              </span>
            </button>
            {#if open}
              <div class="px-4 pt-2 pb-4 border-t border-border space-y-4">
                {#if row.flags.length > 0}
                  <FlagPanel flags={row.flags} />
                {/if}
                <ReasoningStream reasoning={row.reasoning} streaming={false} />
                <div class="mono text-[10px] uppercase tracking-wider text-text-muted">
                  {row.tokensIn} in / {row.tokensOut} out · {row.model} · {new Date(row._creationTime).toLocaleString()}
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </section>

    <!-- Export bar -->
    <footer class="px-5 py-3 border-t border-border flex items-center justify-between gap-4 flex-wrap bg-bg-surface/40">
      <div class="flex items-baseline gap-3 flex-wrap">
        <button
          type="button"
          class="rounded-md border border-border bg-bg-card hover:bg-accent hover:text-bg-base px-4 py-2 text-sm text-text-primary transition-colors"
          onclick={exportCsv}
        >
          Download CSV
        </button>
        <label
          class="mono text-[10px] uppercase tracking-wider text-text-muted flex items-center gap-1.5 select-none"
          title="Append Jockey / Trainer / Barrier columns (v0 columns unchanged)"
        >
          <input type="checkbox" bind:checked={includeFieldData} />
          + field cols
        </label>
        <button
          type="button"
          class="rounded-md border border-border bg-bg-card hover:bg-bg-card-hover px-4 py-2 text-sm text-text-primary transition-colors"
          onclick={exportJson}
        >
          Download JSON
        </button>
        <button
          type="button"
          disabled={busy}
          class="rounded-md border border-border bg-bg-card hover:bg-bg-card-hover px-4 py-2 text-sm text-text-primary transition-colors disabled:opacity-50"
          onclick={makeShareLink}
        >
          {busy ? 'creating link…' : 'Copy share link'}
        </button>
        {#if shareUrl}
          <span class="mono text-[10px] uppercase tracking-wider text-success">
            link copied
          </span>
          <a class="mono text-[11px] underline text-accent" href={shareUrl} target="_blank" rel="noreferrer">{shareUrl.replace(/^https?:\/\//, '')}</a>
        {/if}
      </div>
      <div class="flex items-baseline gap-3">
        {#if savedAt}
          <span class="mono text-[10px] uppercase tracking-wider text-text-muted">
            saved · {new Date(savedAt).toLocaleTimeString()}
          </span>
        {/if}
        <button
          type="button"
          class="mono text-[10px] uppercase tracking-wider text-text-muted hover:text-error"
          onclick={async () => {
            if (!confirm(`Clear ${group.rows.length} extraction${group.rows.length === 1 ? '' : 's'} for ${group.label ?? group.meeting}? This cannot be undone.`)) return
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
  {/if}
</article>
