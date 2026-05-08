<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import {
    calculateQuaddie,
    calculateTrifecta,
    calculateFirstFour,
    type AggregatedRace
  } from '@tta/shared'

  interface SharedPayload {
    meeting: string
    category: string
    date: string
    tipstersDetected: ReadonlyArray<string>
    races: ReadonlyArray<AggregatedRace>
    notes?: string
  }
  interface SnapshotResponse {
    meetingKey: string
    payload: SharedPayload
    createdAt: number
  }

  let snapshot = $state<SnapshotResponse | null>(null)
  let errorMessage = $state<string | null>(null)
  let loading = $state(true)

  async function load(): Promise<void> {
    const token = $page.params.token
    try {
      const res = await fetch(`/api/snapshot/${token}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      snapshot = (await res.json()) as SnapshotResponse
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'load failed'
    } finally {
      loading = false
    }
  }

  onMount(() => {
    void load()
  })
</script>

<svelte:head>
  <title>Shared analysis · The TipAnalyser</title>
</svelte:head>

<main class="min-h-screen px-6 py-10 md:px-12 md:py-14">
  {#if loading}
    <div class="text-text-muted">loading…</div>
  {:else if errorMessage || !snapshot}
    <div class="rounded-md border border-error/40 bg-error/10 px-4 py-3 text-error max-w-xl">
      <span class="mono text-xs uppercase tracking-wider">error</span>
      <p class="mt-1">{errorMessage ?? 'snapshot not found'}</p>
    </div>
  {:else}
    {@const p = snapshot.payload}
    {@const quaddie = calculateQuaddie(p.races)}
    <header class="mx-auto max-w-5xl mb-8">
      <div class="mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
        Shared analysis · {p.date} · published {new Date(snapshot.createdAt).toLocaleString()}
      </div>
      <h1 class="serif mt-3 text-4xl md:text-5xl text-text-primary leading-[1.05]">
        {p.meeting}
      </h1>
      <div class="mt-2 text-text-secondary">
        {p.category} · {p.tipstersDetected.length} tipsters · {p.races.length} races
      </div>
      {#if p.notes}
        <p class="mt-4 italic text-text-secondary">{p.notes}</p>
      {/if}
    </header>

    <section class="mx-auto max-w-5xl space-y-6">
      {#each p.races as race}
        <div class="rounded-md border border-border bg-bg-card overflow-hidden">
          <div class="px-4 py-3 border-b border-border flex items-baseline gap-3">
            <span class="mono text-[11px] uppercase tracking-wider text-accent">Race {race.raceNumber}</span>
            <span class="text-text-muted text-sm">
              {race.totalTipstersInRace} tipsters · {race.totalSelectionsInRace} selections
            </span>
          </div>
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left mono text-[10px] uppercase tracking-wider text-text-muted">
                <th class="px-4 py-2 w-12">#</th>
                <th class="px-4 py-2">Horse</th>
                <th class="px-4 py-2 text-right w-16">Tips</th>
                <th class="px-4 py-2 text-right w-16">Tipsters</th>
                <th class="px-4 py-2 text-right w-12">1st</th>
                <th class="px-4 py-2 text-right w-12">2nd</th>
                <th class="px-4 py-2 text-right w-12">3rd</th>
                <th class="px-4 py-2 text-right w-12">4th</th>
              </tr>
            </thead>
            <tbody>
              {#each race.tips as tip}
                <tr class="border-t border-border">
                  <td class="px-4 py-1.5 text-text-secondary">{tip.horseNumber ?? '—'}</td>
                  <td class="px-4 py-1.5 text-text-primary">{tip.horseName}</td>
                  <td class="px-4 py-1.5 text-right text-text-primary font-medium">{tip.totalTips}</td>
                  <td class="px-4 py-1.5 text-right text-text-secondary">{tip.tipsterCount}</td>
                  <td class="px-4 py-1.5 text-right text-text-secondary">{tip.winTips}</td>
                  <td class="px-4 py-1.5 text-right text-text-secondary">{tip.place2Tips}</td>
                  <td class="px-4 py-1.5 text-right text-text-secondary">{tip.place3Tips}</td>
                  <td class="px-4 py-1.5 text-right text-text-secondary">{tip.place4Tips}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/each}

      {#if quaddie}
        <div class="rounded-md border border-border bg-bg-card px-4 py-3">
          <div class="mono text-[11px] uppercase tracking-wider text-accent mb-2">
            Quaddie · last 4 races
          </div>
          {#each quaddie as leg, i}
            <div class="mb-1.5">
              <span class="mono text-[10px] uppercase tracking-wider text-text-muted mr-2">Leg {i + 1} · R{leg.raceNumber}</span>
              <span class="text-sm text-text-primary">
                {leg.horses.map((h) => `${h.horseNumber ?? '·'} ${h.horseName}`).join(' · ')}
              </span>
            </div>
          {/each}
        </div>
      {/if}
    </section>

    <footer class="mx-auto max-w-5xl mt-12 pt-6 border-t border-border mono text-[10px] uppercase tracking-[0.18em] text-text-muted text-center">
      Generated by The TipAnalyser
    </footer>
  {/if}
</main>
