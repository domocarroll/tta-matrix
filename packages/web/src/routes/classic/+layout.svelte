<script lang="ts">
  // Classic (v0) UI shell. Wraps children in `.tta-classic` so the bright
  // Google-style theme is fully scoped and never leaks into the dark
  // editorial pages (/workspace, /history). The theme itself lives in a
  // shared stylesheet so the /work 3-gate page can wear the same skin.
  import '$lib/styles/classic-theme.css'
  let { children } = $props()
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<div class="tta-classic">
  {@render children()}
</div>
