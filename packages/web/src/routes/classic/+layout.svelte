<script lang="ts">
  // Classic (v0) UI shell. Wraps children in `.tta-classic` so the bright
  // Google-style theme below is fully scoped and never leaks into the dark
  // editorial pages (/, /workspace, /history).
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

<style>
  /* ── Scoped theme — ported from v0-thetipanalyser/app/globals.css ── */
  :global(.tta-classic) {
    --primary: #1e3a5f;
    --accent: #4285f4;
    --foreground: #1e3a5f;
    --muted-fg: #4a4a4a;
    --muted: #f1f3f4;
    --border: rgba(30, 58, 95, 0.15);
    --destructive: #e94e37;
    --success: #16a34a;

    min-height: 100vh;
    background: #ffffff;
    color: var(--foreground);
    font-family: 'Montserrat', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  /* Colour helpers (Tailwind semantic-color utilities aren't registered for
     this palette, so we define the small set the components use). */
  :global(.tta-classic .c-primary) { color: var(--primary); }
  :global(.tta-classic .c-accent) { color: var(--accent); }
  :global(.tta-classic .c-fg) { color: var(--foreground); }
  :global(.tta-classic .c-muted) { color: var(--muted-fg); }
  :global(.tta-classic .c-destructive) { color: var(--destructive); }
  :global(.tta-classic .c-success) { color: var(--success); }
  :global(.tta-classic .c-white) { color: #fff; }

  :global(.tta-classic .bg-soft) { background: var(--muted); }
  :global(.tta-classic .bg-soft-50) { background: #f8f9fa; }
  :global(.tta-classic .bg-accent-soft) { background: rgba(66, 133, 244, 0.1); }
  :global(.tta-classic .bg-primary-soft) { background: rgba(30, 58, 95, 0.05); }
  :global(.tta-classic .border-soft) { border-color: var(--border); }

  /* Card */
  :global(.tta-classic .card) {
    background: #fff;
    color: var(--foreground);
    border-radius: 1rem;
    border: 1px solid var(--border);
    padding: 1.5rem;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
    transition: all 0.15s ease;
  }
  @media (min-width: 768px) {
    :global(.tta-classic .card) { padding: 2rem; }
  }
  :global(.tta-classic .card-hover:hover) {
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
  }

  /* Buttons */
  :global(.tta-classic .btn) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.15s ease;
    border: none;
  }
  :global(.tta-classic .btn:disabled) { opacity: 0.5; cursor: not-allowed; }
  :global(.tta-classic .btn-primary) { background: var(--primary); color: #fff; }
  :global(.tta-classic .btn-primary:hover:not(:disabled)) { background: #18304d; box-shadow: 0 6px 16px rgba(30, 58, 95, 0.25); }
  :global(.tta-classic .btn-secondary) { background: var(--accent); color: #fff; }
  :global(.tta-classic .btn-secondary:hover:not(:disabled)) { background: #3573d6; box-shadow: 0 6px 16px rgba(66, 133, 244, 0.25); }
  :global(.tta-classic .btn-outline) { background: transparent; border: 2px solid var(--primary); color: var(--primary); }
  :global(.tta-classic .btn-outline:hover:not(:disabled)) { background: rgba(30, 58, 95, 0.05); }
  :global(.tta-classic .btn-lg) { padding: 1rem 2rem; font-size: 1rem; font-weight: 700; }

  /* Badges */
  :global(.tta-classic .badge) {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    border-radius: 9999px;
    padding: 0.25rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: #fff;
  }
  :global(.tta-classic .badge-accent) { background: rgba(66, 133, 244, 0.12); color: var(--accent); }

  /* Inputs */
  :global(.tta-classic .form-input) {
    width: 100%;
    background: #f8f9fa;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    padding: 0.625rem 1rem;
    color: var(--foreground);
    transition: all 0.15s ease;
  }
  :global(.tta-classic .form-input::placeholder) { color: var(--muted-fg); }
  :global(.tta-classic .form-input:focus) {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.35);
  }

  /* Cell highlight (refine diff flash) */
  :global(.tta-classic .cell-highlight) {
    background: rgba(66, 133, 244, 0.18);
    transition: background 0.6s ease;
  }

  /* Animations (v0 names) */
  @keyframes ttac-fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes ttac-slide-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes ttac-slide-down { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes ttac-spin { to { transform: rotate(360deg); } }
  :global(.tta-classic .animate-fade-in) { animation: ttac-fade-in 0.3s ease-in-out; }
  :global(.tta-classic .animate-slide-up) { animation: ttac-slide-up 0.4s ease-out; }
  :global(.tta-classic .animate-slide-down) { animation: ttac-slide-down 0.4s ease-out; }
  :global(.tta-classic .animate-spin) { animation: ttac-spin 0.8s linear infinite; }

  @media (prefers-reduced-motion: reduce) {
    :global(.tta-classic .animate-fade-in),
    :global(.tta-classic .animate-slide-up),
    :global(.tta-classic .animate-slide-down),
    :global(.tta-classic .animate-spin) { animation: none !important; }
  }
</style>
