<script lang="ts">
  let open = $state(false)
</script>

<section>
  <header class="flex items-baseline gap-3 mb-4">
    <span class="mono text-[11px] uppercase tracking-[0.2em] text-error"
      >04 · v0 reference</span
    >
    <span class="h-px flex-1 bg-border"></span>
    <button
      class="mono text-[11px] uppercase tracking-[0.18em] text-accent hover:text-accent-bright underline"
      onclick={() => (open = !open)}>{open ? 'hide' : 'show what v0 did'}</button
    >
  </header>

  {#if open}
    <div class="grid gap-4 md:grid-cols-2 fade-up">
      <article
        class="rounded-md border border-error/40 bg-error/5 p-5"
      >
        <span class="mono text-[10px] uppercase tracking-wider text-error"
          >your 24 apr report</span
        >
        <blockquote
          class="mt-3 border-l-2 border-error/60 pl-4 italic text-text-primary leading-snug"
        >
          "If you look at race 4 it is a prime example. The horse name is
          <span class="text-accent not-italic">Call Me Geregeous</span> also
          shows as
          <span class="text-error not-italic">xxxxCall Me Gergegeous</span>."
        </blockquote>
        <p class="mt-3 mono text-[11px] tracking-wider text-text-muted">
          peter@blacmacproductions.com · 24 apr 2026 · 12:53 pm
        </p>
      </article>

      <article
        class="rounded-md border border-error/40 bg-error/5 p-2 overflow-hidden"
      >
        <img
          src="/fixtures/pete-14mar-duplicates.png"
          alt="v0 production output showing cross-race duplicates"
          class="block w-full h-auto rounded"
        />
        <p
          class="mt-2 px-3 pb-2 mono text-[10px] uppercase tracking-wider text-error"
        >
          14 mar · v0 production output · "wootton verni" appears in both r5 & r6
        </p>
      </article>

      <div
        class="md:col-span-2 rounded-md border border-success/40 bg-success/5 px-4 py-3"
      >
        <span class="mono text-[10px] uppercase tracking-wider text-success"
          >same image class · v2</span
        >
        <p class="mt-2 text-text-primary leading-relaxed">
          v2 stripped 15 publication artefacts in this run, named your
          <span class="mono accent">"xxx Call Me Gorgeous"</span> bug verbatim
          in flag 06, and produced
          <span class="text-success">zero phantom horses</span>. Same input
          shape, different architecture, different result.
        </p>
      </div>
    </div>
  {/if}
</section>

<style>
  .text-accent {
    color: var(--color-accent, #c8a87c);
  }
</style>
