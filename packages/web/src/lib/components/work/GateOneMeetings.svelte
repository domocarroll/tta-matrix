<script lang="ts">
  // Gate 1 — locked field surface. Pete creates meetings here, uploads
  // the official cards, reviews, and approves. Approving IS the lock.
  import MeetingRow from './MeetingRow.svelte'
  import type { CustomerMeeting } from '$lib/customerMeetings'
  import type { UserField } from '$lib/userFields'

  interface Props {
    meetings: CustomerMeeting[]
    userFieldsByKey: Map<string, UserField>
    onNewMeeting: () => void
    onUploadCard: (meeting: CustomerMeeting) => void
    onEditField: (meeting: CustomerMeeting) => void
    onUnlock: (meeting: CustomerMeeting) => Promise<void>
    onDelete: (meeting: CustomerMeeting) => Promise<void>
  }
  let {
    meetings,
    userFieldsByKey,
    onNewMeeting,
    onUploadCard,
    onEditField,
    onUnlock,
    onDelete
  }: Props = $props()

  const sorted = $derived(
    [...meetings].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date)
      return a.name.localeCompare(b.name)
    })
  )
  const lockedCount = $derived(meetings.filter((m) => m.state === 'locked').length)
</script>

<section id="gate-1" class="scroll-mt-24">
  <header class="mb-4 flex flex-wrap items-baseline justify-between gap-3">
    <div>
      <div class="text-[10px] uppercase tracking-[0.2em] c-muted font-bold">Gate 1 · field</div>
      <h2 class="text-2xl font-bold c-fg mt-1">
        Lock meetings
        <span class="c-muted text-sm font-bold ml-2">
          {lockedCount} of {meetings.length} locked
        </span>
      </h2>
    </div>
    <button
      type="button"
      onclick={onNewMeeting}
      class="rounded-md bg-blue-600 text-white text-[11px] uppercase tracking-wider font-bold px-4 py-2 hover:bg-blue-700"
    >
      + new meeting
    </button>
  </header>

  {#if sorted.length === 0}
    <div class="rounded-xl border-2 border-dashed border-soft bg-soft-50/50 px-6 py-12 text-center">
      <div class="text-4xl mb-2">🔒</div>
      <p class="text-lg font-bold c-fg">No meetings yet.</p>
      <p class="c-muted mt-1 text-sm">
        Lock your first meeting to start. Tips can't land in an unlocked meeting.
      </p>
      <button
        type="button"
        onclick={onNewMeeting}
        class="mt-5 rounded-md bg-blue-600 text-white text-[11px] uppercase tracking-wider font-bold px-4 py-2 hover:bg-blue-700"
      >
        + new meeting
      </button>
    </div>
  {:else}
    <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {#each sorted as meeting (meeting.meetingKey)}
        <MeetingRow
          {meeting}
          userField={userFieldsByKey.get(meeting.meetingKey) ?? null}
          onUploadCard={() => onUploadCard(meeting)}
          onEditField={() => onEditField(meeting)}
          onUnlock={() => onUnlock(meeting)}
          onDelete={() => onDelete(meeting)}
        />
      {/each}
    </div>
  {/if}
</section>
