<script lang="ts">
  import AggregationTable from './AggregationTable.svelte'
  import SpecialBets from './SpecialBets.svelte'
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
  }

  let { group, clientId, onPatchesChange }: Props = $props()

  let expanded = $state(true)
  let labelDraft = $state(group.label ?? '')
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
    // Strategy: ALWAYS replace entire patches array to keep things simple.
    // Filter out earlier patches affecting same row+action, then append.
    const filtered = group.patches.filter(
      (p) => !(p.raceNumber === patch.raceNumber && p.originalName === patch.originalName && p.action === patch.action)
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
    const csv = buildMeetingCsv(group.aggregated, {
      meeting: group.label ?? group.meeting,
      date: group.date
    })
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
      </div>
      <h2 class="serif text-2xl text-text-primary mt-1 truncate">
        {group.label ?? group.meeting}
      </h2>
      <div class="mt-1 text-sm text-text-secondary">
        {group.rows.length} image{group.rows.length === 1 ? '' : 's'} ·
        {group.totalTipsters.length} tipster{group.totalTipsters.length === 1 ? '' : 's'} ·
        {group.raceNumbers.length} race{group.raceNumbers.length === 1 ? '' : 's'}
      </div>
    </div>
    <div class="flex items-baseline gap-3 shrink-0">
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
      <div class="mono text-[10px] uppercase tracking-wider text-text-muted">
        {#if savedAt}saved · {new Date(savedAt).toLocaleTimeString()}{/if}
      </div>
    </footer>
  {/if}
</article>
