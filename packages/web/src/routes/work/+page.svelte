<script lang="ts">
  // /work — 3-Gate workspace (Pete's mental model: set the rules, then play).
  //
  // GATE 1  field    GATE 2  tips         GATE 3  review
  //   ↓                 ↓                    ↓
  // create meeting  drop tip sheets       aggregated card
  // upload cards    routed → Gate 3       quaddie / trif / F4
  // approve         pending → fix in G1   edit + export + share
  // LOCKED FIELD    routed tips           customer payload
  //
  // Load-bearing rule: tips can't land in an unlocked meeting. Enforced
  // server-side in extractions.create.
  import { onMount } from 'svelte'
  import { getClientId } from '$lib/clientId'
  import ClassicHeader from '$lib/components/classic/ClassicHeader.svelte'
  import GateHeader from '$lib/components/work/GateHeader.svelte'
  import GateOneMeetings from '$lib/components/work/GateOneMeetings.svelte'
  import GateTwoTipIntake from '$lib/components/work/GateTwoTipIntake.svelte'
  import GateThreeReview from '$lib/components/work/GateThreeReview.svelte'
  import NewMeetingModal from '$lib/components/work/NewMeetingModal.svelte'
  import RaceCardUploadModal from '$lib/components/RaceCardUploadModal.svelte'
  import {
    buildMeetingGroups,
    type MeetingGroup,
    type WorkspaceRow,
    type MeetingCorrection,
    type HorsePatch
  } from '$lib/workspace'
  import { loadUserFields, userFieldsToResolvedMap, deleteUserField, type UserField } from '$lib/userFields'
  import {
    listCustomerMeetings,
    deleteCustomerMeeting,
    setCustomerMeetingState,
    runBackfill,
    type CustomerMeeting
  } from '$lib/customerMeetings'
  import { todayUtc } from '@tta/shared'
  import '$lib/styles/classic-theme.css'

  let clientId = $state<string | null>(null)
  let meetings = $state<CustomerMeeting[]>([])
  let rows = $state<WorkspaceRow[]>([])
  let corrections = $state<MeetingCorrection[]>([])
  let userFields = $state<UserField[]>([])
  let loading = $state(true)
  let lastError = $state<string | null>(null)

  let showNewMeeting = $state(false)
  let uploadModalKey = $state<string | null>(null)
  let uploadModalMeeting = $state<{ date: string; meeting: string } | null>(null)

  const today = $state(todayUtc())

  function todayStartUtcMs(): number {
    const d = new Date()
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0)
  }

  async function refresh(): Promise<void> {
    if (!clientId) return
    loading = true
    try {
      const params = new URLSearchParams({ clientId })
      params.set('sinceMs', String(todayStartUtcMs()))
      const [wsRes, ufs, ms] = await Promise.all([
        fetch(`/api/workspace?${params.toString()}`),
        loadUserFields(clientId),
        listCustomerMeetings(clientId, todayStartUtcMs())
      ])
      if (!wsRes.ok) throw new Error(`HTTP ${wsRes.status}`)
      const j = (await wsRes.json()) as { rows: WorkspaceRow[]; corrections: MeetingCorrection[] }
      rows = j.rows
      corrections = j.corrections
      userFields = ufs
      meetings = ms
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'load failed'
    } finally {
      loading = false
    }
  }

  const mergedFieldsByKey = $derived(() => userFieldsToResolvedMap(userFields))
  const allGroups = $derived<MeetingGroup[]>(
    buildMeetingGroups(rows, corrections, mergedFieldsByKey())
  )
  const userFieldsByKey = $derived(new Map(userFields.map((u) => [u.meetingKey, u])))

  const lockedCount = $derived(meetings.filter((m) => m.state === 'locked').length)
  const routedTipCount = $derived(rows.filter((r) => (r.state ?? 'routed') === 'routed').length)
  const pendingTipCount = $derived(rows.filter((r) => r.state === 'pending-meeting').length)
  const readyMeetingCount = $derived(allGroups.filter((g) => g.aggregated.some((r) => r.tips.length > 0)).length)

  function openUploadForMeeting(m: CustomerMeeting): void {
    uploadModalKey = m.meetingKey
    uploadModalMeeting = { date: m.date, meeting: m.name }
  }
  function openUploadForGroup(group: MeetingGroup): void {
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

  async function handleUnlock(m: CustomerMeeting): Promise<void> {
    if (!clientId) return
    // Unapprove the userFields row — its mutation cascades the meeting
    // back to 'draft' AND keeps existing routed tips routed.
    const ok = await deleteUserField(clientId, m.meetingKey)
    if (!ok) {
      lastError = 'unlock failed'
      return
    }
    await refresh()
  }

  async function handleDelete(m: CustomerMeeting): Promise<void> {
    if (!clientId) return
    const ok = await deleteCustomerMeeting(clientId, m.meetingKey)
    if (!ok) {
      lastError = 'delete failed'
      return
    }
    await refresh()
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

  // No-op: Perplexity refresh is unwired in the 3-gate steady state
  // (user fields are the only path). Kept so ClassicMeetingCard wiring
  // stays unchanged.
  async function resolveMeetingField(_group: MeetingGroup): Promise<void> {
    // intentionally empty
  }

  // Gate 2 → Gate 1 jump (Pete clicks "lock now" on a pending tip).
  let jumpPrefill = $state<{ date: string; category: string; name: string } | null>(null)
  function jumpToGateOne(prefill: { date: string; category: string; name: string }): void {
    jumpPrefill = prefill
    showNewMeeting = true
    if (typeof document !== 'undefined') {
      document.getElementById('gate-1')?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  async function onNewMeetingCreated(meetingKey: string): Promise<void> {
    showNewMeeting = false
    jumpPrefill = null
    await refresh()
    // Open card upload immediately so Pete can finish the lock.
    const m = meetings.find((x) => x.meetingKey === meetingKey)
    if (m) openUploadForMeeting(m)
  }

  onMount(() => {
    clientId = getClientId()
    if (clientId) {
      // Idempotent — derives any pre-3-gate meetings from existing data.
      void runBackfill(clientId).then(() => void refresh())
    }
  })
</script>

<svelte:head>
  <title>The TipAnalyser — 3-Gate Workspace</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<div class="tta-classic">
<ClassicHeader />

<main class="container mx-auto max-w-7xl px-4 py-10 md:px-8">
  <GateHeader
    {today}
    {lockedCount}
    totalMeetings={meetings.length}
    {routedTipCount}
    {pendingTipCount}
    {readyMeetingCount}
  />

  {#if lastError}
    <div class="mb-6 rounded-lg border px-4 py-3" style="border-color:#e94e37;background:rgba(233,78,55,0.08)">
      <strong class="c-destructive block text-sm font-bold">Something went wrong</strong>
      <span class="c-destructive text-sm">{lastError}</span>
      <button
        type="button"
        class="ml-3 text-[10px] uppercase tracking-wider c-muted hover:c-fg font-bold"
        onclick={() => (lastError = null)}
      >
        dismiss
      </button>
    </div>
  {/if}

  {#if !clientId}
    <p class="c-muted">Browser identity unavailable. Re-open this page.</p>
  {:else}
    <div class="space-y-12">
      <GateOneMeetings
        {meetings}
        userFieldsByKey={userFieldsByKey}
        onNewMeeting={() => (showNewMeeting = true)}
        onUploadCard={(m) => openUploadForMeeting(m)}
        onEditField={(m) => openUploadForMeeting(m)}
        onUnlock={handleUnlock}
        onDelete={handleDelete}
      />

      <GateTwoTipIntake
        clientId={clientId!}
        {meetings}
        onChange={refresh}
        onJumpToGateOne={jumpToGateOne}
      />

      <GateThreeReview
        groups={allGroups}
        clientId={clientId!}
        onPatchesChange={persistCorrections}
        onClearMeeting={clearMeeting}
        onResolveField={resolveMeetingField}
        onUploadCard={openUploadForGroup}
      />
    </div>
  {/if}
</main>

{#if showNewMeeting && clientId}
  <NewMeetingModal
    clientId={clientId!}
    prefill={jumpPrefill}
    onClose={() => {
      showNewMeeting = false
      jumpPrefill = null
    }}
    onCreated={onNewMeetingCreated}
  />
{/if}

{#if uploadModalKey && uploadModalMeeting && clientId}
  <RaceCardUploadModal
    clientId={clientId!}
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
</div>
