<script lang="ts">
  // Gate 2 — global tip dropzone. Sheets dropped here extract, persist,
  // and post-route. Routed rows are surfaced as a small tick + jump-link
  // to Gate 3. Pending rows show an amber "no locked meeting" affordance
  // that jumps to Gate 1 prefilled from the derived key.
  import { runExtractionWithRetry, persistExtraction } from '$lib/extractionRunner'
  import type { CustomerMeeting } from '$lib/customerMeetings'

  type IntakeStatus = 'queued' | 'extracting' | 'routed' | 'pending' | 'error'

  interface IntakeItem {
    id: string
    filename: string
    status: IntakeStatus
    meetingKey?: string
    pendingReason?: string
    derivedKey?: string
    derivedMeetingName?: string
    derivedDate?: string
    derivedCategory?: string
    errorMessage?: string
  }

  interface Props {
    clientId: string
    meetings: CustomerMeeting[]
    onChange: () => void | Promise<void>
    onJumpToGateOne: (prefill: { date: string; category: string; name: string }) => void
  }
  let { clientId, meetings, onChange, onJumpToGateOne }: Props = $props()

  let items = $state<IntakeItem[]>([])
  let processing = $state(false)

  const hasAnyLocked = $derived(meetings.some((m) => m.state === 'locked'))
  const MODEL = 'claude-sonnet-4-6'

  function update(id: string, patch: Partial<IntakeItem>): void {
    items = items.map((it) => (it.id === id ? { ...it, ...patch } : it))
  }

  async function handleFiles(list: FileList | null): Promise<void> {
    if (!list || list.length === 0) return
    const queued: IntakeItem[] = Array.from(list).map((f) => ({
      id: crypto.randomUUID(),
      filename: f.name,
      status: 'queued'
    }))
    items = [...items, ...queued]
    // Pair the file with its queued id so we can stream updates.
    const pairs = queued.map((it, i) => ({ it, file: list[i] as File }))
    if (!processing) void drainQueue(pairs)
    else for (const p of pairs) pendingQueue.push(p)
  }

  const pendingQueue: Array<{ it: IntakeItem; file: File }> = []

  async function drainQueue(initial: Array<{ it: IntakeItem; file: File }>): Promise<void> {
    processing = true
    const queue = [...initial]
    try {
      while (queue.length > 0 || pendingQueue.length > 0) {
        const next = queue.shift() ?? pendingQueue.shift()
        if (!next) break
        await processOne(next.it.id, next.file)
      }
    } finally {
      processing = false
    }
  }

  async function processOne(id: string, file: File): Promise<void> {
    update(id, { status: 'extracting' })
    const outcome = await runExtractionWithRetry(file, {})
    if (!outcome.result) {
      update(id, { status: 'error', errorMessage: outcome.errorMessage ?? 'extraction failed' })
      return
    }
    const persisted = await persistExtraction({
      clientId,
      filename: file.name,
      durationMs: outcome.durationMs,
      tokensIn: outcome.tokensIn,
      tokensOut: outcome.tokensOut,
      model: MODEL,
      payload: outcome.result
    })
    if (!persisted) {
      update(id, { status: 'error', errorMessage: 'extracted but failed to save' })
      return
    }
    // Trust the server's routing decision — single source of truth.
    if (persisted.state === 'routed') {
      update(id, { status: 'routed', meetingKey: persisted.meetingKey })
    } else {
      update(id, {
        status: 'pending',
        pendingReason: persisted.pendingReason ?? 'no_locked_meeting_for_key',
        derivedKey: persisted.derivedKey,
        derivedDate: persisted.derivedDate,
        derivedCategory: persisted.derivedCategory,
        derivedMeetingName: persisted.derivedMeetingName
      })
    }
    await onChange()
  }

  function dismiss(id: string): void {
    items = items.filter((it) => it.id !== id)
  }

  function clearFinished(): void {
    items = items.filter((it) => it.status === 'queued' || it.status === 'extracting')
  }

  let dragging = $state(false)
</script>

<section id="gate-2" class="scroll-mt-24">
  <header class="mb-4">
    <div class="text-[10px] uppercase tracking-[0.2em] c-muted font-bold">Gate 2 · tips</div>
    <h2 class="text-2xl font-bold c-fg mt-1">
      Drop tip sheets
      <span class="c-muted text-sm font-bold ml-2">
        {items.length} processed
      </span>
    </h2>
  </header>

  <div
    role="region"
    aria-label="Tip sheet dropzone"
    class="rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors {hasAnyLocked
      ? dragging
        ? 'border-blue-500 bg-blue-50'
        : 'border-soft bg-white hover:bg-soft-50/40'
      : 'border-soft bg-soft-50/40 opacity-60'}"
    ondragover={(e) => {
      if (!hasAnyLocked) return
      e.preventDefault()
      dragging = true
    }}
    ondragleave={() => (dragging = false)}
    ondrop={(e) => {
      e.preventDefault()
      dragging = false
      if (!hasAnyLocked) return
      void handleFiles(e.dataTransfer?.files ?? null)
    }}
  >
    {#if !hasAnyLocked}
      <div class="text-4xl mb-2">🔒</div>
      <p class="text-lg font-bold c-fg">Lock at least one meeting in Gate 1 first.</p>
      <p class="c-muted mt-1 text-sm">Tips can't land in an unlocked meeting.</p>
    {:else}
      <div class="text-4xl mb-2">📰</div>
      <p class="text-lg font-bold c-fg">Drop tip sheets here</p>
      <p class="c-muted mt-1 text-sm">
        We extract every tip, then route it to its locked meeting. Unrouted tips
        surface below with a one-click fix.
      </p>
      <label class="inline-block mt-5 cursor-pointer rounded-md bg-blue-600 text-white text-[11px] uppercase tracking-wider font-bold px-4 py-2 hover:bg-blue-700">
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
        choose images
      </label>
    {/if}
  </div>

  {#if items.length > 0}
    <ul class="mt-4 space-y-2">
      {#each items as it (it.id)}
        <li class="rounded-lg border border-soft bg-white px-4 py-3 flex items-baseline gap-3">
          <span class="flex-1 truncate text-sm c-fg font-bold">{it.filename}</span>
          {#if it.status === 'queued'}
            <span class="text-[10px] uppercase tracking-wider c-muted font-bold">queued</span>
          {:else if it.status === 'extracting'}
            <span class="text-[10px] uppercase tracking-wider text-blue-700 font-bold">extracting…</span>
          {:else if it.status === 'routed'}
            <a
              href="#gate-3"
              class="text-[10px] uppercase tracking-wider text-green-700 font-bold hover:underline"
            >
              ✓ routed →
            </a>
          {:else if it.status === 'pending'}
            <div class="flex items-baseline gap-2">
              <span class="text-[10px] uppercase tracking-wider text-amber-800 font-bold">
                no locked meeting for "{it.derivedMeetingName}" · {it.derivedDate}
              </span>
              <button
                type="button"
                class="text-[10px] uppercase tracking-wider font-bold rounded-md bg-amber-600 text-white px-2.5 py-1 hover:bg-amber-700"
                onclick={() =>
                  onJumpToGateOne({
                    date: it.derivedDate ?? '',
                    category: it.derivedCategory ?? 'OR',
                    name: it.derivedMeetingName ?? ''
                  })}
              >
                lock now →
              </button>
            </div>
          {:else if it.status === 'error'}
            <span class="text-[10px] uppercase tracking-wider text-red-600 font-bold">
              {it.errorMessage}
            </span>
          {/if}
          <button
            type="button"
            class="text-[10px] uppercase tracking-wider c-muted hover:c-fg font-bold ml-2"
            onclick={() => dismiss(it.id)}
          >
            ✕
          </button>
        </li>
      {/each}
    </ul>
    {#if items.some((i) => i.status === 'routed' || i.status === 'error')}
      <div class="mt-2 text-right">
        <button
          type="button"
          class="text-[10px] uppercase tracking-wider c-muted hover:c-fg font-bold"
          onclick={clearFinished}
        >
          clear finished
        </button>
      </div>
    {/if}
  {/if}
</section>
