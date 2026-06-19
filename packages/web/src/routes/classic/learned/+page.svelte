<script lang="ts">
  // Global "everything it's learned" management page.
  //
  // Lists ALL of this client's extraction-correction hints — active AND
  // inactive, across every scope (global / category / venue) — so hints saved
  // for a venue the reviewer never revisits stay visible and cleanable. Each
  // hint can be toggled active/inactive or deleted. Hints are normally created
  // and reviewed inside the race-card upload modal, filtered to the current
  // meeting; this page is the unfiltered home for them.
  import { onMount } from 'svelte'
  import { getClientId } from '$lib/clientId'
  import ClassicHeader from '$lib/components/classic/ClassicHeader.svelte'
  import {
    loadAllHints,
    setHintActive,
    deleteHint,
    type ExtractionHint,
    type HintScope
  } from '$lib/extractionHints'

  let clientId = $state<string | null>(null)
  let hints = $state<ExtractionHint[]>([])
  let loading = $state(true)
  let lastError = $state<string | null>(null)
  let busyId = $state<string | null>(null)

  const SCOPE_ORDER: HintScope[] = ['global', 'category', 'venue']
  const SCOPE_LABEL: Record<HintScope, string> = {
    global: 'Everywhere',
    category: 'By category',
    venue: 'By venue'
  }

  // Group hints by scope, preserving newest-first order from the server.
  const groups = $derived(
    SCOPE_ORDER.map((scope) => ({
      scope,
      label: SCOPE_LABEL[scope],
      items: hints.filter((h) => h.scope === scope)
    })).filter((g) => g.items.length > 0)
  )

  function fmtDate(ms: number): string {
    try {
      return new Date(ms).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return ''
    }
  }

  function scopeDetail(h: ExtractionHint): string {
    if (h.scope === 'category') return h.category?.trim() || 'unspecified category'
    if (h.scope === 'venue') return h.venue?.trim() || 'unspecified venue'
    return 'applies to all meetings'
  }

  async function reload(id: string): Promise<void> {
    try {
      hints = await loadAllHints(id)
    } catch (err) {
      console.error('Failed to load learned hints:', err)
      lastError = 'Could not load what it has learned. Please try again.'
    }
  }

  async function onToggle(h: ExtractionHint): Promise<void> {
    if (!clientId || busyId) return
    busyId = h.id
    lastError = null
    try {
      const ok = await setHintActive(clientId, h.id, !h.active)
      if (!ok) throw new Error('toggle failed')
      await reload(clientId)
    } catch (err) {
      console.error('Failed to toggle hint:', err)
      lastError = 'Could not update that hint. Please try again.'
    } finally {
      busyId = null
    }
  }

  async function onDelete(h: ExtractionHint): Promise<void> {
    if (!clientId || busyId) return
    busyId = h.id
    lastError = null
    try {
      const ok = await deleteHint(clientId, h.id)
      if (!ok) throw new Error('delete failed')
      await reload(clientId)
    } catch (err) {
      console.error('Failed to delete hint:', err)
      lastError = 'Could not delete that hint. Please try again.'
    } finally {
      busyId = null
    }
  }

  onMount(async () => {
    const id = getClientId()
    clientId = id
    if (!id) {
      loading = false
      return
    }
    await reload(id)
    loading = false
  })
</script>

<svelte:head>
  <title>What it&rsquo;s learned · The TipAnalyser</title>
</svelte:head>

<ClassicHeader />

<main class="container mx-auto max-w-3xl px-4 py-10">
  <div class="mb-8">
    <h2 class="c-primary text-2xl font-bold tracking-tight md:text-3xl">
      What it&rsquo;s learned
    </h2>
    <p class="c-muted mt-2 text-sm">
      Every correction you&rsquo;ve saved while reviewing race cards lives here.
      Toggle a hint off to stop it being applied, or delete it for good.
    </p>
  </div>

  {#if lastError}
    <div
      class="border-soft mb-6 rounded-lg border bg-soft-50 px-4 py-3 text-sm"
      role="alert"
    >
      <span class="c-destructive font-semibold">{lastError}</span>
    </div>
  {/if}

  {#if loading}
    <p class="c-muted text-sm">Loading…</p>
  {:else if hints.length === 0}
    <div class="card text-center">
      <p class="c-primary font-semibold">Nothing learned yet</p>
      <p class="c-muted mt-2 text-sm">
        Corrections you save while reviewing race cards show up here.
      </p>
    </div>
  {:else}
    {#each groups as group (group.scope)}
      <section class="mb-8">
        <h3 class="c-muted mb-3 text-xs font-bold tracking-wide uppercase">
          {group.label}
        </h3>
        <ul class="space-y-3">
          {#each group.items as h (h.id)}
            <li class="card card-hover" class:opacity-60={!h.active}>
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0 flex-1">
                  <p class="c-fg text-sm leading-relaxed">{h.hint}</p>
                  <div class="c-muted mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span>{scopeDetail(h)}</span>
                    <span class="badge badge-accent">{h.source}</span>
                    <span>{fmtDate(h.createdAt)}</span>
                    {#if !h.active}
                      <span class="c-destructive font-semibold">inactive</span>
                    {/if}
                  </div>
                </div>
                <div class="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    class="btn btn-outline"
                    style="padding: 0.4rem 0.85rem; font-size: 0.75rem;"
                    disabled={busyId === h.id}
                    onclick={() => onToggle(h)}
                  >
                    {h.active ? 'Turn off' : 'Turn on'}
                  </button>
                  <button
                    type="button"
                    class="c-muted hover:c-destructive"
                    style="font-size: 1.1rem; line-height: 1; padding: 0.25rem;"
                    aria-label="Delete hint"
                    title="Delete hint"
                    disabled={busyId === h.id}
                    onclick={() => onDelete(h)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  {/if}
</main>
