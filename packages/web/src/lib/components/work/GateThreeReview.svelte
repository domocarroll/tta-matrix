<script lang="ts">
  // Gate 3 — review + export. Renders one ClassicMeetingCard per locked
  // meeting that has tip data. Empty meetings show as a small "waiting"
  // chip. All aggregation/special-bets/edit/export/share lives inside
  // ClassicMeetingCard — we just stack them.
  import ClassicMeetingCard from '$lib/components/classic/ClassicMeetingCard.svelte'
  import type { MeetingGroup, HorsePatch } from '$lib/workspace'

  interface Props {
    groups: MeetingGroup[]
    clientId: string
    onPatchesChange: (group: MeetingGroup, patches: HorsePatch[], label?: string, notes?: string) => void | Promise<void>
    onClearMeeting: (group: MeetingGroup) => Promise<void>
    onResolveField: (group: MeetingGroup) => Promise<void>
    onUploadCard: (group: MeetingGroup) => void
  }
  let {
    groups,
    clientId,
    onPatchesChange,
    onClearMeeting,
    onResolveField,
    onUploadCard
  }: Props = $props()

  const populated = $derived(groups.filter((g) => g.aggregated.some((r) => r.tips.length > 0)))
</script>

<section id="gate-3" class="scroll-mt-24">
  <header class="mb-4">
    <div class="text-[10px] uppercase tracking-[0.2em] c-muted font-bold">Gate 3 · review</div>
    <h2 class="text-2xl font-bold c-fg mt-1">
      Review &amp; export
      <span class="c-muted text-sm font-bold ml-2">
        {populated.length} ready
      </span>
    </h2>
  </header>

  {#if populated.length === 0}
    <div class="rounded-xl border-2 border-dashed border-soft bg-soft-50/50 px-6 py-12 text-center">
      <div class="text-4xl mb-2">📊</div>
      <p class="text-lg font-bold c-fg">No meetings ready yet.</p>
      <p class="c-muted mt-1 text-sm">
        Lock meetings in Gate 1 and drop tip sheets in Gate 2 to populate review.
      </p>
    </div>
  {:else}
    <div class="space-y-8">
      {#each populated as group (group.meetingKey)}
        <ClassicMeetingCard
          {group}
          {clientId}
          onPatchesChange={(patches, label, notes) =>
            onPatchesChange(group, patches, label, notes)}
          onClearMeeting={() => onClearMeeting(group)}
          onResolveField={() => onResolveField(group)}
          onUploadCard={() => onUploadCard(group)}
        />
      {/each}
    </div>
  {/if}
</section>
