import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 30000,
    // .worktrees/ holds other branches' checkouts (e.g. redesign/phase1-foundation)
    // with their own Playwright e2e specs — vitest was picking those up too and
    // failing them (wrong test runner), unrelated to this repo's own test run.
    exclude: ['**/node_modules/**', '**/.worktrees/**'],
  },
})
