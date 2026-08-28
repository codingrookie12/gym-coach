import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    // Mirrors tsconfig.json's "@/*": ["./*"] — Phase 4 needed this the first
    // time a lib module under test (lib/progressAggregation.ts) imported
    // another lib module via the '@/' alias instead of a relative path;
    // Next.js/webpack already resolve it, but vitest doesn't without this.
    alias: { '@': path.resolve(__dirname, '.') },
  },
  test: {
    environment: 'node',
    testTimeout: 30000,
    // .worktrees/ holds other branches' checkouts (e.g. redesign/phase1-foundation)
    // with their own Playwright e2e specs — vitest was picking those up too and
    // failing them (wrong test runner), unrelated to this repo's own test run.
    exclude: ['**/node_modules/**', '**/.worktrees/**'],
  },
})
