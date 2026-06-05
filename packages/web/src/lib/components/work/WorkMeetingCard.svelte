<script lang="ts">
  // One self-contained meeting wizard (hard-wall model):
  //   ① FIELD  → upload race card, review, approve → LOCKED
  //   ② TIPS   → drop ALL tip sheets for this meeting (bound, no routing)
  //   ③ REVIEW → aggregate / quaddie / export (when tips exist)
  // Lock is sealed: editing/replacing the card needs an explicit unlock.
  import type { CustomerMeeting } from '$lib/customerMeetings'
  import type { UserField } from '$lib/userFields'
  import type { MeetingGroup, HorsePatch } from '$lib/workspace'
  import { categoryConfig } from '$lib/classic/categoryConfig'
  import type { RaceCategory } from '$lib/classic/types'
  import MeetingTipDrop from './MeetingTipDrop.svelte'
  import ClassicMeetingCard from '$lib/components/classic/ClassicMeetingCard.svelte'

  interface Props {
    meeting: CustomerMeeting
    userField: UserField | null
    group: MeetingGroup | undefined
    clientId: string
    onUploadCard: () => void
    onEditField: () => void
    onUnlock: () => Promise<void>
    onDelete: () => Promise<void>
    onTipsChange: () => void | Promise<void>
    onPatchesChange: (patches: HorsePatch[], label?: string, notes?: string) => void
    onClearMeeting: () => Promise<void>
    onResolveField: () => Promise<void>
  }
  let {
    meeting,
    userField,
    group,
    clientId,
    onUploadCard,
    onEditField,
    onUnlock,
    onDelete,
    onTipsChange,
    onPatchesChange,
    onClearMeeting,
    onResolveField
  }: Props = $props()

  const catCfg = $derived(categoryConfig[meeting.category as RaceCategory] ?? categoryConfig.OR)
  const isLocked = $derived(meeting.state === 'locked')
  const runnerCount = $derived(
    userField ? userField.races.reduce((n, r) => n + r.runners.length, 0) : 0
  )
  const hasTips = $derived(!!group && group.aggregated.some((r) => r.tips.length > 0))

  function confirmDelete(): void {
    if (typeof window === 'undefined') return
    if (window.confirm(`Delete "${meeting.name}" (${meeting.date})? This removes the locked field and any tips.`)) {
      void onDelete()
    }
  }
  function confirmUnlock(): void {
    if (typeof window === 'undefined') return
    if (window.confirm(`Unlock "${meeting.name}"? Re-approve after editing the card. Existing tips stay attached.`)) {
      void onUnlock()
    }
  }
</script>

<article class="overflow-hidden rounded-xl border border-soft bg-white shadow-sm">
  <!-- Control strip: identity + lifecycle actions -->
  <header class="flex flex-wrap items-start justify-between gap-3 border-b border-soft px-5 py-4" style="background:linear-gradient(to right, rgba(30,58,95,0.04), rgba(66,133,244,0.04));">
    <div class="min-w-0 flex-1">
      <div class="mb-1 flex flex-wrap items-center gap-2">
        <span class="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-white" style="background:{catCfg.color}">
          {catCfg.name}
        </span>
        <span class="text-[10px] font-bold uppercase tracking-wider c-muted">{meeting.date}</span>
        {#if isLocked}
          <span class="rounded-full bg-green-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-800">✓ field locked</span>
        {:else}
          <span class="rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-600">field not locked</span>
        {/if}
      </div>
      <h2 class="c-primary truncate text-2xl font-bold">{group?.label ?? meeting.name}</h2>
      {#if isLocked && userField}
        <p class="c-muted mt-1 text-sm">
          {userField.races.length} race{userField.races.length === 1 ? '' : 's'} ·
          {runnerCount} runners ·
          source{userField.sourceFilenames.length === 1 ? '' : 's'}: {userField.sourceFilenames.join(' + ') || '—'}
        </p>
      {/if}
    </div>

    <div class="flex shrink-0 flex-wrap items-baseline gap-2">
      {#if isLocked}
        <button type="button" class="rounded-md border border-soft bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider c-fg hover:bg-soft" onclick={onEditField}>edit field</button>
        <button type="button" class="rounded-md border border-soft bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider c-muted hover:bg-soft" onclick={confirmUnlock}>unlock</button>
      {:else}
        <button type="button" class="rounded-md bg-blue-600 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-blue-700" onclick={onUploadCard}>upload race card →</button>
      {/if}
      <button type="button" class="px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider c-muted hover:text-red-600" onclick={confirmDelete}>delete</button>
    </div>
  </header>

  <div class="px-5 py-5">
    {#if !isLocked}
      <!-- ① FIELD stage -->
      <div class="rounded-xl border-2 border-dashed border-soft bg-soft-50/50 px-6 py-8 text-center">
        <div class="mb-1 text-3xl">🏇</div>
        <p class="c-fg text-base font-bold">Upload the official race card to lock this field.</p>
        <p class="c-muted mt-1 text-sm">Claude reads every race + runner. You review, then approve. Tip sheets unlock after that.</p>
        <button type="button" class="mt-4 rounded-md bg-blue-600 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-blue-700" onclick={onUploadCard}>
          upload race card →
        </button>
      </div>
    {:else}
      <!-- ② TIPS stage -->
      <MeetingTipDrop {clientId} meetingKey={meeting.meetingKey} meetingName={meeting.name} onChange={onTipsChange} />

      <!-- ③ REVIEW stage -->
      {#if hasTips && group}
        <div class="mt-6 border-t border-soft pt-2">
          <ClassicMeetingCard
            {group}
            {clientId}
            embedded
            {onPatchesChange}
            {onClearMeeting}
            {onResolveField}
          />
        </div>
      {:else}
        <p class="c-muted mt-4 text-center text-sm">No tips yet — drop this meeting's sheets above to build the review.</p>
      {/if}
    {/if}
  </div>
</article>
