<script lang="ts">
  // v0-skinned editable aggregation table. Same HorsePatch semantics as the
  // workspace AggregationTable — corrections persist identically.
  import type { AggregatedRace, AggregatedTip } from '@tta/shared'
  import type { HorsePatch } from '$lib/workspace'

  interface Props {
    races: ReadonlyArray<AggregatedRace>
    patches: ReadonlyArray<HorsePatch>
    onPatch: (patch: HorsePatch) => void
    onClearRow: (raceNumber: number, originalName: string) => void
  }
  let { races, patches, onPatch, onClearRow }: Props = $props()

  let editingKey = $state<string | null>(null)
  let nameDraft = $state('')
  let numDraft = $state('')
  let totalDraft = $state('')
  let tipstersDraft = $state('')
  let winDraft = $state('')
  let p2Draft = $state('')
  let p3Draft = $state('')
  let p4Draft = $state('')

  const rowKey = (raceNumber: number, name: string) => `R${raceNumber}|${name}`

  function startEdit(raceNumber: number, tip: AggregatedTip): void {
    editingKey = rowKey(raceNumber, tip.horseName)
    nameDraft = tip.horseName
    numDraft = tip.horseNumber !== undefined ? String(tip.horseNumber) : ''
    totalDraft = String(tip.totalTips)
    tipstersDraft = String(tip.tipsterCount)
    winDraft = String(tip.winTips)
    p2Draft = String(tip.place2Tips)
    p3Draft = String(tip.place3Tips)
    p4Draft = String(tip.place4Tips)
  }

  function parseInteger(raw: string): number | undefined {
    const t = raw.trim()
    if (t === '') return undefined
    const n = parseInt(t, 10)
    return Number.isFinite(n) ? n : undefined
  }

  function commit(raceNumber: number, originalName: string, original: AggregatedTip): void {
    const trimmedName = nameDraft.trim()
    const newName = trimmedName.length > 0 ? trimmedName : originalName
    const patch: HorsePatch = { raceNumber, originalName }
    if (newName !== originalName) patch.newHorseName = newName
    const newNum = parseInteger(numDraft)
    if (newNum !== original.horseNumber) patch.newHorseNumber = newNum
    const newTotal = parseInteger(totalDraft)
    if (newTotal !== undefined && newTotal !== original.totalTips) patch.newTotalTips = newTotal
    const newTipsters = parseInteger(tipstersDraft)
    if (newTipsters !== undefined && newTipsters !== original.tipsterCount) patch.newTipsterCount = newTipsters
    const newWin = parseInteger(winDraft)
    if (newWin !== undefined && newWin !== original.winTips) patch.newWinTips = newWin
    const newP2 = parseInteger(p2Draft)
    if (newP2 !== undefined && newP2 !== original.place2Tips) patch.newPlace2Tips = newP2
    const newP3 = parseInteger(p3Draft)
    if (newP3 !== undefined && newP3 !== original.place3Tips) patch.newPlace3Tips = newP3
    const newP4 = parseInteger(p4Draft)
    if (newP4 !== undefined && newP4 !== original.place4Tips) patch.newPlace4Tips = newP4

    const fields: (keyof HorsePatch)[] = [
      'newHorseName', 'newHorseNumber', 'newTotalTips', 'newTipsterCount',
      'newWinTips', 'newPlace2Tips', 'newPlace3Tips', 'newPlace4Tips'
    ]
    if (fields.some((f) => patch[f] !== undefined)) onPatch(patch)
    editingKey = null
  }

  const isPatched = (raceNumber: number, name: string) =>
    patches.some((p) => p.raceNumber === raceNumber && p.originalName === name)

  // Pete's formula: tips on this horse ÷ total tips in the race × 100
  function tipPct(tip: AggregatedTip, totalSelections: number): string {
    return totalSelections <= 0 ? '0.00' : ((tip.totalTips / totalSelections) * 100).toFixed(2)
  }
</script>

{#each races as race (race.raceNumber)}
  <div class="mb-6">
    <div class="mb-2 flex items-baseline gap-3">
      <span class="c-accent text-sm font-bold uppercase tracking-wider">Race {race.raceNumber}</span>
      <span class="c-muted text-sm">
        {race.totalTipstersInRace} tipster{race.totalTipstersInRace === 1 ? '' : 's'} ·
        {race.totalSelectionsInRace} selection{race.totalSelectionsInRace === 1 ? '' : 's'}
      </span>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="c-muted text-left text-xs font-semibold uppercase tracking-wider">
            <th class="w-12 py-2">#</th>
            <th class="py-2">Horse</th>
            <th class="w-16 py-2 text-right">Tips</th>
            <th class="w-16 py-2 text-right">Tipsters</th>
            <th class="w-14 py-2 text-right">%</th>
            <th class="w-12 py-2 text-right">1st</th>
            <th class="w-12 py-2 text-right">2nd</th>
            <th class="w-12 py-2 text-right">3rd</th>
            <th class="w-12 py-2 text-right">4th</th>
            <th class="w-24 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {#each race.tips as tip (tip.horseName)}
            {@const isEditing = editingKey === rowKey(race.raceNumber, tip.horseName)}
            {@const patched = isPatched(race.raceNumber, tip.horseName)}
            <tr class="border-t border-soft" style={patched ? 'background:rgba(66,133,244,0.06);' : ''}>
              {#if isEditing}
                <td class="py-1.5 pr-1"><input class="form-input" style="width:3rem;padding:0.25rem" type="number" bind:value={numDraft} aria-label="Horse number" /></td>
                <td class="py-1.5 pr-2"><input class="form-input" style="padding:0.25rem 0.5rem" bind:value={nameDraft} aria-label="Horse name" /></td>
                <td class="py-1.5 text-right"><input class="form-input" style="width:3rem;padding:0.25rem;text-align:right" type="number" min="0" bind:value={totalDraft} aria-label="Total tips" /></td>
                <td class="py-1.5 text-right"><input class="form-input" style="width:3rem;padding:0.25rem;text-align:right" type="number" min="0" bind:value={tipstersDraft} aria-label="Tipster count" /></td>
                <td class="c-muted py-1.5 text-right">—</td>
                <td class="py-1.5 text-right"><input class="form-input" style="width:2.5rem;padding:0.25rem;text-align:right" type="number" min="0" bind:value={winDraft} aria-label="Win tips" /></td>
                <td class="py-1.5 text-right"><input class="form-input" style="width:2.5rem;padding:0.25rem;text-align:right" type="number" min="0" bind:value={p2Draft} aria-label="2nd" /></td>
                <td class="py-1.5 text-right"><input class="form-input" style="width:2.5rem;padding:0.25rem;text-align:right" type="number" min="0" bind:value={p3Draft} aria-label="3rd" /></td>
                <td class="py-1.5 text-right"><input class="form-input" style="width:2.5rem;padding:0.25rem;text-align:right" type="number" min="0" bind:value={p4Draft} aria-label="4th" /></td>
                <td class="whitespace-nowrap py-1.5 text-right">
                  <button class="c-accent text-xs font-bold uppercase tracking-wider" onclick={() => commit(race.raceNumber, tip.horseName, tip)}>save</button>
                  <button class="c-muted ml-2 text-xs font-bold uppercase tracking-wider" onclick={() => (editingKey = null)}>cancel</button>
                </td>
              {:else}
                <td class="c-muted py-1.5">{tip.horseNumber ?? '—'}</td>
                <td class="c-fg py-1.5 font-medium">
                  {tip.horseName}
                  {#if patched}<span class="c-accent ml-2 text-[10px] font-bold uppercase tracking-wider">edited</span>{/if}
                  {#if tip.fieldMatched}<span class="c-success ml-1 text-[10px]" title="field-anchored">✓</span>{/if}
                </td>
                <td class="c-fg py-1.5 text-right font-semibold">{tip.totalTips}</td>
                <td class="c-muted py-1.5 text-right">{tip.tipsterCount}</td>
                <td class="c-muted py-1.5 text-right">{tipPct(tip, race.totalSelectionsInRace)}%</td>
                <td class="c-muted py-1.5 text-right">{tip.winTips}</td>
                <td class="c-muted py-1.5 text-right">{tip.place2Tips}</td>
                <td class="c-muted py-1.5 text-right">{tip.place3Tips}</td>
                <td class="c-muted py-1.5 text-right">{tip.place4Tips}</td>
                <td class="whitespace-nowrap py-1.5 text-right">
                  <button class="c-muted text-xs font-bold uppercase tracking-wider hover:underline" onclick={() => startEdit(race.raceNumber, tip)} aria-label="Edit row">edit</button>
                  {#if patched}
                    <button class="c-muted ml-2 text-xs font-bold uppercase tracking-wider hover:underline" onclick={() => onClearRow(race.raceNumber, tip.horseName)}>revert</button>
                  {:else}
                    <button class="c-destructive ml-2 text-xs font-bold uppercase tracking-wider hover:underline" onclick={() => onPatch({ raceNumber: race.raceNumber, originalName: tip.horseName, removed: true })}>remove</button>
                  {/if}
                </td>
              {/if}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
{/each}
