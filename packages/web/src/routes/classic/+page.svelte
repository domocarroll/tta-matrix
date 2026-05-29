<script lang="ts">
  // Classic (v0) interface backed by the full workspace engine:
  // Claude extraction + retry, Convex persistence, Perplexity field
  // anchoring, persisted corrections, meeting auto-grouping.
  import { onMount } from 'svelte'
  import { getClientId } from '$lib/clientId'
  import ClassicHeader from '$lib/components/classic/ClassicHeader.svelte'
  import MascotUploader from '$lib/components/classic/MascotUploader.svelte'
  import ClassicMeetingCard from '$lib/components/classic/ClassicMeetingCard.svelte'
  import { runExtractionWithRetry, persistExtraction } from '$lib/extractionRunner'
  import {
    buildMeetingGroups,
    type MeetingGroup,
    type WorkspaceRow,
    type MeetingCorrection,
    type HorsePatch
  } from '$lib/workspace'
  import { resolveField, type ResolvedField } from '$lib/fieldResolution'
  import { loadUserFields, userFieldsToResolvedMap, type UserField } from '$lib/userFields'
  import RaceCardUploadModal from '$lib/components/RaceCardUploadModal.svelte'
  import { categoryConfig, CATEGORY_ORDER } from '$lib/classic/categoryConfig'
  import type { ProcessedPhoto, RaceCategory } from '$lib/classic/types'

  const MODEL = 'claude-sonnet-4-6'

  let clientId = $state<string | null>(null)
  let rows = $state<WorkspaceRow[]>([])
  let corrections = $state<MeetingCorrection[]>([])
  let fieldsByKey = $state(new Map<string, ResolvedField>())
  const fieldRequested = new Set<string>()
  let userFields = $state<UserField[]>([])
  let uploadModalKey = $state<string | null>(null)
  let uploadModalMeeting = $state<{ date: string; meeting: string } | null>(null)
  let photos = $state<ProcessedPhoto[]>([])
  let processing = $state(false)
  let loading = $state(true)
  let lastError = $state<string | null>(null)
  let onlyToday = $state(true)
  let activeCategory = $state<'ALL' | RaceCategory>('ALL')

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
      const [res, ufs] = await Promise.all([
        fetch(`/api/workspace?${params.toString()}`),
        loadUserFields(clientId)
      ])
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const j = (await res.json()) as { rows: WorkspaceRow[]; corrections: MeetingCorrection[] }
      rows = j.rows
      corrections = j.corrections
      userFields = ufs
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'load failed'
    } finally {
      loading = false
    }
  }

  const mergedFieldsByKey = $derived(() => {
    const user = userFieldsToResolvedMap(userFields)
    const merged = new Map(fieldsByKey)
    for (const [k, v] of user) merged.set(k, v)
    return merged
  })
  const allGroups = $derived<MeetingGroup[]>(buildMeetingGroups(rows, corrections, mergedFieldsByKey()))

  function openUploadModal(group: MeetingGroup): void {
    uploadModalKey = group.meetingKey
    uploadModalMeeting = { date: group.date, meeting: group.meeting }
  }
  function closeUploadModal(): void {
    uploadModalKey = null
    uploadModalMeeting = null
  }
  async function onFieldApproved(): Promise<void> {
    closeUploadModal()
    await refresh()
  }
  const groups = $derived<MeetingGroup[]>(
    activeCategory === 'ALL' ? allGroups : allGroups.filter((g) => g.category === activeCategory)
  )

  function storeField(key: string, result: ResolvedField): void {
    const next = new Map(fieldsByKey)
    next.set(key, result)
    fieldsByKey = next
  }

  // Auto-resolve the authoritative field for each visible meeting once.
  $effect(() => {
    for (const g of allGroups) {
      if (fieldRequested.has(g.meetingKey)) continue
      fieldRequested.add(g.meetingKey)
      const key = g.meetingKey
      void resolveField({ date: g.date, meetingName: g.meeting, category: g.category }).then((r) =>
        storeField(key, r)
      )
    }
  })

  async function resolveMeetingField(group: MeetingGroup): Promise<void> {
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

  // ── Upload pipeline (page-owned: extract → persist → refresh) ──
  function addFiles(files: File[], category: RaceCategory): void {
    const next: ProcessedPhoto[] = files.map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      preview: URL.createObjectURL(f),
      category,
      status: 'uploading'
    }))
    photos = [...photos, ...next]
    if (!processing) void drainQueue()
  }

  function setPhoto(id: string, updates: Partial<ProcessedPhoto>): void {
    photos = photos.map((p) => (p.id === id ? { ...p, ...updates } : p))
  }

  async function drainQueue(): Promise<void> {
    processing = true
    while (true) {
      const item = photos.find((p) => p.status === 'uploading')
      if (!item) break
      await processOne(item.id)
    }
    processing = false
  }

  async function processOne(id: string): Promise<void> {
    if (!clientId) return
    const photo = photos.find((p) => p.id === id)
    if (!photo) return
    setPhoto(id, { status: 'processing', error: undefined })

    const outcome = await runExtractionWithRetry(photo.file, {})

    if (outcome.errorMessage || !outcome.result) {
      setPhoto(id, { status: 'error', error: outcome.errorMessage ?? 'extraction failed' })
      return
    }

    const persistedId = await persistExtraction({
      clientId,
      filename: photo.file.name,
      durationMs: outcome.durationMs,
      tokensIn: outcome.tokensIn,
      tokensOut: outcome.tokensOut,
      model: MODEL,
      payload: outcome.result,
      overrideCategory: photo.category
    })

    if (!persistedId) {
      setPhoto(id, { status: 'error', error: 'extracted but failed to save' })
      return
    }
    setPhoto(id, { status: 'ready' })
    await refresh()
  }

  function retryPhoto(id: string): void {
    setPhoto(id, { status: 'uploading', error: undefined })
    if (!processing) void drainQueue()
  }

  function removePhoto(id: string): void {
    photos = photos.filter((p) => p.id !== id)
  }

  function clearFinished(): void {
    photos = photos.filter((p) => p.status !== 'ready')
  }

  async function persistCorrections(
    group: MeetingGroup,
    patches: HorsePatch[],
    label?: string,
    notes?: string
  ): Promise<void> {
    if (!clientId) return
    try {
      const res = await fetch('/api/corrections', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clientId, meetingKey: group.meetingKey, label, notes, horsePatches: patches })
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await refresh()
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'save failed'
    }
  }

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

  onMount(() => {
    clientId = getClientId()
    void refresh()
  })

  $effect(() => {
    void onlyToday
    if (clientId) void refresh()
  })

  const finishedCount = $derived(photos.filter((p) => p.status === 'ready').length)
</script>

<svelte:head>
  <title>The TipAnalyser</title>
</svelte:head>

<ClassicHeader />

<main class="container mx-auto max-w-7xl px-4 py-10 md:px-8">
  {#if lastError}
    <div class="mb-6 rounded-lg border px-4 py-3" style="border-color:#e94e37;background:rgba(233,78,55,0.08)">
      <strong class="c-destructive block text-sm font-bold">Something went wrong</strong>
      <span class="c-destructive text-sm">{lastError}</span>
    </div>
  {/if}

  <!-- Upload -->
  <MascotUploader {photos} onAddFiles={addFiles} onRetry={retryPhoto} onRemove={removePhoto} />

  {#if finishedCount > 0}
    <div class="mt-3 text-center">
      <button class="c-muted text-xs font-bold uppercase tracking-wider hover:underline" onclick={clearFinished}>
        clear finished uploads
      </button>
    </div>
  {/if}

  <!-- Results -->
  <section class="mt-12">
    <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h2 class="c-primary text-3xl font-bold tracking-tight">Today's Meetings</h2>
      <label class="c-muted flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
        <input type="checkbox" bind:checked={onlyToday} /> today only
      </label>
    </div>

    <!-- Category filter -->
    <div class="mb-6 flex flex-wrap items-baseline gap-2">
      {#each [{ code: 'ALL' as const, name: 'All' }, ...CATEGORY_ORDER.map((c) => ({ code: c, name: categoryConfig[c].name }))] as tab (tab.code)}
        {@const count = tab.code === 'ALL' ? allGroups.length : allGroups.filter((g) => g.category === tab.code).length}
        {@const active = activeCategory === tab.code}
        <button
          type="button"
          class="rounded-lg border px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors {active ? 'border-soft c-white' : 'border-soft bg-soft c-muted hover:opacity-80'}"
          style={active ? `background:${tab.code === 'ALL' ? '#1e3a5f' : categoryConfig[tab.code as RaceCategory].color}` : ''}
          onclick={() => (activeCategory = tab.code)}
        >
          {tab.name}{#if count > 0}<span class="ml-1 opacity-70">{count}</span>{/if}
        </button>
      {/each}
    </div>

    {#if !clientId}
      <p class="c-muted">Browser identity unavailable. Re-open this page.</p>
    {:else if loading && groups.length === 0}
      <p class="c-muted">Loading…</p>
    {:else if groups.length === 0}
      <div class="rounded-xl border-2 border-dashed border-soft bg-soft-50 px-8 py-16 text-center">
        <div class="mb-3 text-4xl">🏇</div>
        <p class="c-fg text-xl font-bold">No meetings yet.</p>
        <p class="c-muted mt-1">Upload tip sheets above — they group by meeting automatically.</p>
      </div>
    {:else}
      <div class="space-y-8">
        {#each groups as group (group.meetingKey)}
          <ClassicMeetingCard
            {group}
            clientId={clientId!}
            onPatchesChange={(patches, label, notes) => persistCorrections(group, patches, label, notes)}
            onClearMeeting={() => clearMeeting(group)}
            onResolveField={() => resolveMeetingField(group)}
            onUploadCard={() => openUploadModal(group)}
          />
        {/each}
      </div>
    {/if}
  </section>
</main>

{#if uploadModalKey && uploadModalMeeting && clientId}
  <RaceCardUploadModal
    clientId={clientId}
    meetingKey={uploadModalKey}
    meetingLabel={uploadModalMeeting.meeting}
    meetingDate={uploadModalMeeting.date}
    onClose={closeUploadModal}
    onApproved={onFieldApproved}
  />
{/if}

<footer class="c-muted mt-16 border-t border-soft bg-soft-50 py-8 text-center text-sm">
  <p class="font-semibold">&copy; {new Date().getFullYear()} The TipAnalyser</p>
  <p class="mt-2 text-xs">Please gamble responsibly. Only bet what you can afford to lose.</p>
</footer>
