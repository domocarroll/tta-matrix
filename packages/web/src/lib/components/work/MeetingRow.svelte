<script lang="ts">
  // One row per customer meeting in Gate 1. Shows state chip + Pete's
  // actions: upload/edit field, unlock, delete.
  import type { CustomerMeeting } from '$lib/customerMeetings'
  import type { UserField } from '$lib/userFields'
  import { categoryConfig } from '$lib/classic/categoryConfig'
  import type { RaceCategory } from '$lib/classic/types'

  interface Props {
    meeting: CustomerMeeting
    userField: UserField | null
    onUploadCard: () => void
    onEditField: () => void
    onUnlock: () => Promise<void>
    onDelete: () => Promise<void>
  }
  let { meeting, userField, onUploadCard, onEditField, onUnlock, onDelete }: Props =
    $props()

  const catCfg = $derived(categoryConfig[meeting.category as RaceCategory] ?? categoryConfig.OR)
  const runnerCount = $derived(
    userField ? userField.races.reduce((n, r) => n + r.runners.length, 0) : 0
  )

  function confirmDelete(): void {
    if (typeof window === 'undefined') return
    const ok = window.confirm(
      `Delete "${meeting.name}" (${meeting.date})? This removes the locked field too.`
    )
    if (ok) void onDelete()
  }

  function confirmUnlock(): void {
    if (typeof window === 'undefined') return
    const ok = window.confirm(
      `Unlock "${meeting.name}"? You can re-approve after editing. Existing tip rows stay routed.`
    )
    if (ok) void onUnlock()
  }
</script>

<article class="rounded-xl border border-soft bg-white shadow-sm">
  <div class="flex items-start justify-between gap-3 p-4">
    <div class="flex-1 min-w-0">
      <div class="flex items-baseline gap-2 mb-1">
        <span
          class="rounded-full text-[9px] font-bold uppercase tracking-[0.18em] px-2 py-0.5 text-white"
          style="background:{catCfg.color}"
        >
          {catCfg.name}
        </span>
        <span class="text-[10px] uppercase tracking-wider c-muted font-bold">{meeting.date}</span>
      </div>
      <h3 class="text-lg font-bold c-fg truncate">{meeting.name}</h3>
      {#if userField}
        <p class="text-xs c-muted mt-1">
          {userField.races.length} race{userField.races.length === 1 ? '' : 's'} ·
          {runnerCount} runners ·
          source{userField.sourceFilenames.length === 1 ? '' : 's'}:
          {userField.sourceFilenames.join(' + ') || '—'}
        </p>
      {/if}
    </div>

    <div class="flex items-baseline gap-3 whitespace-nowrap">
      {#if meeting.state === 'locked'}
        <span class="rounded-full bg-green-100 text-green-800 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1">
          ✓ locked
        </span>
      {:else if meeting.state === 'cards-pending'}
        <span class="rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1">
          cards pending
        </span>
      {:else}
        <span class="rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1">
          draft
        </span>
      {/if}
    </div>
  </div>

  <div class="flex flex-wrap items-baseline gap-2 border-t border-soft px-4 py-3 bg-soft-50/40">
    {#if meeting.state === 'locked'}
      <button
        type="button"
        class="text-[11px] uppercase tracking-wider font-bold rounded-md border border-soft bg-white px-3 py-1.5 c-fg hover:bg-soft"
        onclick={onEditField}
      >
        edit field
      </button>
      <button
        type="button"
        class="text-[11px] uppercase tracking-wider font-bold rounded-md border border-soft bg-white px-3 py-1.5 c-muted hover:bg-soft"
        onclick={confirmUnlock}
      >
        unlock
      </button>
    {:else}
      <button
        type="button"
        class="text-[11px] uppercase tracking-wider font-bold rounded-md bg-blue-600 text-white px-3 py-1.5 hover:bg-blue-700"
        onclick={onUploadCard}
      >
        upload cards →
      </button>
    {/if}

    <span class="flex-1"></span>

    <button
      type="button"
      class="text-[11px] uppercase tracking-wider font-bold c-muted hover:text-red-600 px-2 py-1.5"
      onclick={confirmDelete}
    >
      delete
    </button>
  </div>
</article>
