import { defineConfig } from 'vitest/config'

// Minimal config for pure-function unit tests (no jsdom — these test plain
// TS utilities in src/lib, not Svelte components).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts']
  }
})
