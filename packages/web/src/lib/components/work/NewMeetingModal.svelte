<script lang="ts">
  // Gate 1 step-1: name the meeting (date + category + venue). The card
  // upload step lives in RaceCardUploadModal — this modal hands off as
  // soon as the meeting row exists, so Pete can either upload now or
  // park the meeting as draft and come back.
  import { createCustomerMeeting } from '$lib/customerMeetings'
  import { todayUtc } from '@tta/shared'
  import { categoryConfig, CATEGORY_ORDER } from '$lib/classic/categoryConfig'
  import type { RaceCategory } from '$lib/classic/types'

  interface Props {
    clientId: string
    /** Optional prefill from a "lock now" jump out of Gate 2. */
    prefill?: { date?: string; category?: string; name?: string } | null
    onClose: () => void
    onCreated: (meetingKey: string) => void | Promise<void>
  }
  let { clientId, prefill, onClose, onCreated }: Props = $props()

  const VALID_CATS: RaceCategory[] = ['SR', 'MR', 'BR', 'PR', 'AR', 'OR']
  function pickCat(raw: string | undefined): RaceCategory {
    const up = (raw ?? '').toUpperCase()
    return (VALID_CATS as string[]).includes(up) ? (up as RaceCategory) : 'SR'
  }

  // svelte-ignore state_referenced_locally
  let date = $state(prefill?.date && /^\d{4}-\d{2}-\d{2}$/.test(prefill.date) ? prefill.date : todayUtc())
  // svelte-ignore state_referenced_locally
  let category = $state<RaceCategory>(pickCat(prefill?.category))
  // svelte-ignore state_referenced_locally
  let name = $state(prefill?.name?.trim() ?? '')
  let saving = $state(false)
  let errorMsg = $state<string | null>(null)

  async function submit(): Promise<void> {
    if (saving) return
    if (!name.trim()) {
      errorMsg = 'Enter a meeting/venue name.'
      return
    }
    saving = true
    errorMsg = null
    const out = await createCustomerMeeting({ clientId, date, category, name: name.trim() })
    saving = false
    if (!out) {
      errorMsg = 'Failed to create meeting. Try again.'
      return
    }
    await onCreated(out.meetingKey)
  }
</script>

<div
  class="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto"
  role="dialog"
  aria-modal="true"
>
  <div class="w-full max-w-lg my-10 rounded-xl border border-soft bg-white shadow-2xl">
    <header class="flex items-baseline justify-between px-6 py-4 border-b border-soft">
      <div>
        <div class="text-[10px] uppercase tracking-[0.2em] c-muted font-bold">Gate 1 · new meeting</div>
        <h2 class="text-2xl font-bold c-fg mt-1">Lock a meeting to start</h2>
      </div>
      <button
        type="button"
        onclick={onClose}
        class="text-[11px] uppercase tracking-wider c-muted hover:c-fg font-bold"
      >
        cancel ✕
      </button>
    </header>

    <div class="px-6 py-5 space-y-4">
      <div>
        <label for="meeting-date" class="block text-[10px] uppercase tracking-wider c-muted font-bold mb-1">
          Race date
        </label>
        <input
          id="meeting-date"
          type="date"
          bind:value={date}
          class="w-full rounded-md border border-soft bg-white px-3 py-2 text-sm c-fg"
        />
      </div>

      <div>
        <label for="meeting-cat" class="block text-[10px] uppercase tracking-wider c-muted font-bold mb-1">
          Category
        </label>
        <div class="flex flex-wrap gap-2">
          {#each CATEGORY_ORDER as code (code)}
            {@const active = category === code}
            <button
              type="button"
              class="rounded-md border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors {active ? 'border-soft c-white' : 'border-soft bg-soft c-muted hover:opacity-80'}"
              style={active ? `background:${categoryConfig[code].color}` : ''}
              onclick={() => (category = code)}
            >
              {categoryConfig[code].name}
            </button>
          {/each}
        </div>
      </div>

      <div>
        <label for="meeting-name" class="block text-[10px] uppercase tracking-wider c-muted font-bold mb-1">
          Meeting / venue
        </label>
        <input
          id="meeting-name"
          type="text"
          bind:value={name}
          placeholder="Royal Randwick"
          class="w-full rounded-md border border-soft bg-white px-3 py-2 text-sm c-fg"
          onkeydown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void submit()
            }
          }}
        />
      </div>

      {#if errorMsg}
        <p class="text-xs text-red-600 font-bold">{errorMsg}</p>
      {/if}
    </div>

    <footer class="flex items-center justify-end gap-3 border-t border-soft px-6 py-4">
      <button
        type="button"
        onclick={onClose}
        class="text-[11px] uppercase tracking-wider c-muted hover:c-fg font-bold px-3 py-2"
      >
        cancel
      </button>
      <button
        type="button"
        onclick={() => void submit()}
        disabled={saving}
        class="rounded-md bg-blue-600 text-white text-[11px] uppercase tracking-wider font-bold px-4 py-2 hover:bg-blue-700 disabled:opacity-60"
      >
        {saving ? 'creating…' : 'create meeting →'}
      </button>
    </footer>
  </div>
</div>
