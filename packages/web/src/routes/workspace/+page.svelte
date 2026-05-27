<script lang="ts">
  import { onMount } from 'svelte'
  import { getClientId } from '$lib/clientId'
  import MultiImageDropzone from '$lib/components/MultiImageDropzone.svelte'
  import QueueRow from '$lib/components/QueueRow.svelte'
  import MeetingCard from '$lib/components/MeetingCard.svelte'
  import { runExtractionWithRetry, persistExtraction } from '$lib/extractionRunner'
  import {
    buildMeetingGroups,
    type MeetingGroup,
    type WorkspaceRow,
    type MeetingCorrection,
    type HorsePatch
  } from '$lib/workspace'
  import { resolveField, type ResolvedField } from '$lib/fieldResolution'

  type QueueStatus = 'pending' | 'streaming' | 'done' | 'error' | 'cancelled'
  interface QueueItem {
    id: string
    file: File
    status: QueueStatus
    durationMs: number
    error: string | null
    reasoningCount: number
    abortCtl: AbortController | null
  }

  type CategoryCode = 'ALL' | 'SR' | 'MR' | 'BR' | 'PR' | 'AR' | 'OR'
  const CATEGORY_TABS: ReadonlyArray<{ code: CategoryCode; label: string }> = [
    { code: 'ALL', label: 'All' },
    { code: 'SR', label: 'Sydney' },
    { code: 'MR', label: 'Melbourne' },
    { code: 'BR', label: 'Brisbane' },
    { code: 'PR', label: 'Perth' },
    { code: 'AR', label: 'Adelaide' },
    { code: 'OR', label: 'Other' }
  ]

  let clientId = $state<string | null>(null)
  let rows = $state<WorkspaceRow[]>([])
  let corrections = $state<MeetingCorrection[]>([])
  // Resolved authoritative fields, keyed by meetingKey. Reassigned (not
  // mutated) so the $derived groups recompute.
  let fieldsByKey = $state(new Map<string, ResolvedField>())
  // Non-reactive guard: one auto-resolve attempt per meetingKey.
  const fieldRequested = new Set<string>()
  let queue = $state<QueueItem[]>([])
  let processing = $state(false)
  let loading = $state(true)
  let lastError = $state<string | null>(null)
  let activeCategory = $state<CategoryCode>('ALL')

  // Range filter — default "today" (UTC). Clear to show everything.
  let onlyToday = $state(true)

  const MODEL = 'claude-sonnet-4-6'

  function todayStartUtcMs(): number {
    const d = new Date()
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0)
  }

  async function refresh(): Promise<void> {
    if (!clientId) return
    loading = true
    try {
      const params = new URLSearchParams({ clientId })
      if (onlyToday) params.set('sinceMs', String(todayStartUtcMs()))
      const res = await fetch(`/api/workspace?${params.toString()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const j = (await res.json()) as { rows: WorkspaceRow[]; corrections: MeetingCorrection[] }
      rows = j.rows
      corrections = j.corrections
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'load failed'
    } finally {
      loading = false
    }
  }

  const allGroups = $derived<MeetingGroup[]>(
    buildMeetingGroups(rows, corrections, fieldsByKey)
  )

  function storeField(key: string, result: ResolvedField): void {
    const next = new Map(fieldsByKey)
    next.set(key, result)
    fieldsByKey = next
  }

  // Auto-resolve the field for each visible meeting exactly once. A miss
  // (no API key, field not published) is cached as a negative so we
  // don't hammer the resolver on every recompute.
  $effect(() => {
    for (const g of allGroups) {
      if (fieldRequested.has(g.meetingKey)) continue
      fieldRequested.add(g.meetingKey)
      const key = g.meetingKey
      void resolveField({
        date: g.date,
        meetingName: g.meeting,
        category: g.category
      }).then((r) => storeField(key, r))
    }
  })

  async function resolveMeetingField(group: MeetingGroup): Promise<void> {
    // Manual refetch — force a fresh pull (picks up late scratchings).
    fieldRequested.add(group.meetingKey)
    const next = new Map(fieldsByKey)
    next.delete(group.meetingKey)
    fieldsByKey = next
    const r = await resolveField({
      date: group.date,
      meetingName: group.meeting,
      category: group.category,
      force: true
    })
    storeField(group.meetingKey, r)
  }
  const groups = $derived<MeetingGroup[]>(
    activeCategory === 'ALL'
      ? allGroups
      : allGroups.filter((g) => g.category === activeCategory)
  )

  async function clearMeeting(group: MeetingGroup): Promise<void> {
    if (!clientId) return
    try {
      const res = await fetch(
        `/api/workspace?clientId=${encodeURIComponent(clientId)}&meetingKey=${encodeURIComponent(group.meetingKey)}`,
        { method: 'DELETE' }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await refresh()
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'clear failed'
    }
  }

  async function persistCorrections(group: MeetingGroup, patches: HorsePatch[], label?: string, notes?: string): Promise<void> {
    if (!clientId) return
    try {
      const res = await fetch('/api/corrections', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clientId,
          meetingKey: group.meetingKey,
          label,
          notes,
          horsePatches: patches
        })
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await refresh()
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'save failed'
    }
  }

  function addFiles(files: File[]): void {
    const next = files.map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      status: 'pending' as QueueStatus,
      durationMs: 0,
      error: null,
      reasoningCount: 0,
      abortCtl: null
    }))
    queue = [...queue, ...next]
    if (!processing) void drainQueue()
  }

  async function drainQueue(): Promise<void> {
    processing = true
    while (true) {
      const idx = queue.findIndex((q) => q.status === 'pending')
      if (idx === -1) break
      await processItem(idx)
    }
    processing = false
  }

  async function processItem(idx: number): Promise<void> {
    if (!clientId) return
    queue[idx] = { ...queue[idx], status: 'streaming', error: null, reasoningCount: 0, abortCtl: new AbortController() }
    queue = [...queue]
    const item = queue[idx]

    const outcome = await runExtractionWithRetry(
      item.file,
      {
        onReasoning: () => {
          queue[idx] = { ...queue[idx], reasoningCount: queue[idx].reasoningCount + 1 }
          queue = [...queue]
        },
        onAttempt: (attempt, max) => {
          if (attempt > 1) {
            queue[idx] = { ...queue[idx], error: `retry ${attempt}/${max}` }
            queue = [...queue]
          }
        }
      },
      item.abortCtl?.signal
    )

    if (outcome.errorMessage === 'cancelled') {
      queue[idx] = { ...queue[idx], status: 'cancelled', durationMs: outcome.durationMs }
      queue = [...queue]
      return
    }
    if (outcome.errorMessage || !outcome.result) {
      queue[idx] = {
        ...queue[idx],
        status: 'error',
        durationMs: outcome.durationMs,
        error: outcome.errorMessage ?? 'unknown'
      }
      queue = [...queue]
      return
    }

    const persistedId = await persistExtraction({
      clientId,
      filename: item.file.name,
      durationMs: outcome.durationMs,
      tokensIn: outcome.tokensIn,
      tokensOut: outcome.tokensOut,
      model: MODEL,
      payload: outcome.result,
      overrideCategory: activeCategory === 'ALL' ? undefined : activeCategory
    })

    if (!persistedId) {
      queue[idx] = {
        ...queue[idx],
        status: 'error',
        durationMs: outcome.durationMs,
        error: 'extracted but failed to save'
      }
      queue = [...queue]
      return
    }

    queue[idx] = { ...queue[idx], status: 'done', durationMs: outcome.durationMs }
    queue = [...queue]
    await refresh()
  }

  function cancelItem(id: string): void {
    const idx = queue.findIndex((q) => q.id === id)
    if (idx === -1) return
    queue[idx].abortCtl?.abort()
  }

  function retryItem(id: string): void {
    const idx = queue.findIndex((q) => q.id === id)
    if (idx === -1) return
    queue[idx] = { ...queue[idx], status: 'pending', error: null, reasoningCount: 0 }
    queue = [...queue]
    if (!processing) void drainQueue()
  }

  function clearDoneCancelled(): void {
    queue = queue.filter((q) => q.status !== 'done' && q.status !== 'cancelled')
  }

  onMount(() => {
    clientId = getClientId()
    void refresh()
  })

  $effect(() => {
    // Reload when toggling onlyToday
    void onlyToday
    if (clientId) void refresh()
  })

  const summary = $derived({
    extractions: rows.length,
    meetings: groups.length,
    flags: rows.reduce((n, r) => n + r.flags.length, 0),
    inFlight: queue.filter((q) => q.status === 'streaming' || q.status === 'pending').length
  })
</script>

<svelte:head>
  <title>Workspace · The TipAnalyser</title>
</svelte:head>

<main class="min-h-screen px-6 py-10 md:px-12 md:py-14">
  <header class="mx-auto max-w-7xl mb-10">
    <div class="flex items-baseline gap-3">
      <span class="mono text-[11px] uppercase tracking-[0.2em] text-text-muted">workspace</span>
      <span class="h-px flex-1 bg-border"></span>
      <a href="/history" class="mono text-[11px] uppercase tracking-[0.18em] text-text-muted hover:text-accent">history →</a>
      <a href="/" class="mono text-[11px] uppercase tracking-[0.18em] text-text-muted hover:text-accent">single shot →</a>
    </div>
    <h1 class="serif mt-6 text-5xl md:text-6xl text-text-primary leading-[1.05]">
      Friday workspace
    </h1>
    <p class="serif mt-2 text-xl md:text-2xl italic text-text-secondary">
      drop today's tip sheets — they auto-group by meeting.
    </p>
  </header>

  <!-- Summary strip -->
  <section class="mx-auto max-w-7xl mb-8 grid grid-cols-2 md:grid-cols-4 gap-4">
    <div class="rounded-md border border-border bg-bg-card px-5 py-4">
      <div class="mono text-[10px] uppercase tracking-wider text-text-muted">extractions</div>
      <div class="serif text-3xl text-accent mt-1">{summary.extractions}</div>
    </div>
    <div class="rounded-md border border-border bg-bg-card px-5 py-4">
      <div class="mono text-[10px] uppercase tracking-wider text-text-muted">meetings</div>
      <div class="serif text-3xl text-accent mt-1">{summary.meetings}</div>
    </div>
    <div class="rounded-md border border-border bg-bg-card px-5 py-4">
      <div class="mono text-[10px] uppercase tracking-wider text-text-muted">flags</div>
      <div class="serif text-3xl text-accent mt-1">{summary.flags}</div>
    </div>
    <div class="rounded-md border border-border bg-bg-card px-5 py-4">
      <div class="mono text-[10px] uppercase tracking-wider text-text-muted">in flight</div>
      <div class="serif text-3xl text-accent mt-1">{summary.inFlight}</div>
    </div>
  </section>

  <!-- Dropzone -->
  <section class="mx-auto max-w-7xl mb-8">
    <MultiImageDropzone onFiles={addFiles} disabled={!clientId} />

    {#if queue.length > 0}
      <div class="mt-4 grid gap-2">
        {#each queue as item (item.id)}
          <QueueRow
            filename={item.file.name}
            status={item.status}
            durationMs={item.durationMs}
            error={item.error}
            reasoningCount={item.reasoningCount}
            onCancel={() => cancelItem(item.id)}
            onRetry={() => retryItem(item.id)}
          />
        {/each}
        {#if queue.some((q) => q.status === 'done' || q.status === 'cancelled')}
          <button
            type="button"
            class="mono text-[10px] uppercase tracking-wider text-text-muted hover:text-text-primary self-end mt-1"
            onclick={clearDoneCancelled}
          >
            clear finished
          </button>
        {/if}
      </div>
    {/if}
  </section>

  <!-- Category strip (v0 parity) — filters visible meetings + overrides
       category for new uploads in the queue. -->
  <section class="mx-auto max-w-7xl mb-5">
    <div class="flex items-baseline gap-1 flex-wrap">
      {#each CATEGORY_TABS as tab}
        {@const count =
          tab.code === 'ALL'
            ? allGroups.length
            : allGroups.filter((g) => g.category === tab.code).length}
        {@const active = activeCategory === tab.code}
        <button
          type="button"
          class="px-4 py-2 mono text-[11px] uppercase tracking-wider rounded-md border transition-colors {active
            ? 'border-accent bg-accent/10 text-accent'
            : 'border-border bg-bg-card hover:bg-bg-card-hover text-text-muted'}"
          onclick={() => (activeCategory = tab.code)}
        >
          {tab.label}
          {#if count > 0}
            <span class="ml-1 text-[10px] {active ? 'text-accent-bright' : 'text-text-secondary'}">{count}</span>
          {/if}
        </button>
      {/each}
    </div>
    {#if activeCategory !== 'ALL'}
      <p class="mt-2 mono text-[10px] uppercase tracking-wider text-text-muted">
        new uploads will be tagged {activeCategory} · {CATEGORY_TABS.find((t) => t.code === activeCategory)?.label}
      </p>
    {/if}
  </section>

  <!-- Filters + meeting cards -->
  <section class="mx-auto max-w-7xl">
    <div class="flex items-center justify-between mb-4 gap-3 flex-wrap">
      <label class="mono text-[11px] uppercase tracking-wider text-text-muted flex items-center gap-2">
        <input type="checkbox" bind:checked={onlyToday} />
        today only
      </label>
      <div class="mono text-[11px] uppercase tracking-wider text-text-muted">
        {#if loading}loading…{:else if clientId}client · {clientId.slice(0, 8)}…{/if}
      </div>
    </div>

    {#if lastError}
      <div class="mb-4 rounded-md border border-error/40 bg-error/10 px-4 py-3 text-error">
        <span class="mono text-xs uppercase tracking-wider">error</span>
        <p class="mt-1">{lastError}</p>
      </div>
    {/if}

    {#if !clientId}
      <p class="text-text-secondary">Browser identity unavailable. Re-open this page.</p>
    {:else if groups.length === 0}
      <div class="rounded-md border border-dashed border-border bg-bg-surface px-8 py-16 text-center">
        <p class="serif text-2xl text-text-primary">No extractions yet.</p>
        <p class="mt-2 text-text-secondary">
          Drop one or many tip sheets above. Each meeting auto-groups; correct any errors before exporting.
        </p>
      </div>
    {:else}
      <div class="space-y-6">
        {#each groups as group (group.meetingKey)}
          <MeetingCard
            {group}
            clientId={clientId!}
            onPatchesChange={(patches, label, notes) =>
              persistCorrections(group, patches, label, notes)}
            onClearMeeting={() => clearMeeting(group)}
            onResolveField={() => resolveMeetingField(group)}
          />
        {/each}
      </div>
    {/if}
  </section>

  <footer class="mx-auto max-w-7xl mt-16 pt-8 border-t border-border flex justify-between items-baseline">
    <div class="mono text-[11px] uppercase tracking-[0.18em] text-text-muted">
      The TipAnalyser · Friday workspace
    </div>
    <a
      href="/history"
      class="mono text-[11px] uppercase tracking-[0.18em] text-text-muted hover:text-accent underline"
    >
      view all history →
    </a>
  </footer>
</main>
