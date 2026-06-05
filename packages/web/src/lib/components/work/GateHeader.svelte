<script lang="ts">
  // Sticky strip at the top of /work. Shows the day's date and a 3-stop
  // status summary across all meetings (field → tips → review).
  interface Props {
    today: string
    lockedCount: number
    totalMeetings: number
    routedTipCount: number
    pendingTipCount: number
    readyMeetingCount: number
  }
  let {
    today,
    lockedCount,
    totalMeetings,
    routedTipCount,
    pendingTipCount,
    readyMeetingCount
  }: Props = $props()

  function formatDate(iso: string): string {
    try {
      const d = new Date(iso + 'T00:00:00Z')
      return d.toLocaleDateString('en-AU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC'
      })
    } catch {
      return iso
    }
  }
</script>

<div class="sticky top-0 z-30 -mx-4 mb-6 border-b border-soft bg-white/95 backdrop-blur px-4 py-3 md:-mx-8 md:px-8">
  <div class="flex flex-wrap items-baseline justify-between gap-3">
    <p class="text-[10px] uppercase tracking-[0.2em] c-muted font-bold">
      {formatDate(today)}
    </p>
    <div class="flex flex-wrap items-baseline gap-2 text-[11px] uppercase tracking-wider font-bold">
      <span class="rounded-md border border-soft bg-soft-50 px-3 py-1.5">
        ① field <span class="c-muted">{lockedCount}/{totalMeetings} locked</span>
      </span>
      <span class="rounded-md border border-soft bg-soft-50 px-3 py-1.5">
        ② tips <span class="c-muted">{routedTipCount} in{pendingTipCount > 0 ? ` · ${pendingTipCount} pending` : ''}</span>
      </span>
      <span class="rounded-md border border-soft bg-soft-50 px-3 py-1.5">
        ③ review <span class="c-muted">{readyMeetingCount} ready</span>
      </span>
    </div>
  </div>
</div>
