import { defineConfig, devices } from '@playwright/test'

// Real Playwright e2e infra (previously zero — every live-browser
// verification this app got was an ad-hoc, uncommitted `npx -p playwright
// node <throwaway>.mjs` script, reinvented per agent session). Reuses the
// config/harness *pattern* already proven in
// .worktrees/redesign-phase1-foundation/playwright.config.ts (see
// docs/redesign-branch-reconciliation.md, "Bucket 3") — written fresh here
// against current main, not copied, since that branch's specs assert
// against a dead UI-primitive-library.
//
// Target environment: gym-coach-dev (see .env.dev.local.example) — NEVER
// production. Credentials come from process.env, populated either by
// .env.dev.local locally (loaded in e2e/fixtures/auth.ts) or by CI secrets
// (see .github/workflows/test.yml's `e2e` job). No secret is ever
// hardcoded here or in any spec.
export default defineConfig({
  testDir: './e2e/specs',
  fullyParallel: false,
  // One worker: specs mint/delete real disposable users against a shared
  // free-tier dev project — running them concurrently risks rate limits and
  // makes failures harder to reason about. These are regression specs, not
  // a perf suite; serial + deterministic beats fast + flaky here.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e/report' }]],
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 3,
      },
    },
  ],
  // Manages the dev server itself instead of requiring a human/agent to
  // start `npm run dev` in a separate terminal first (the manual step every
  // ad-hoc live-test session needed) — reuseExistingServer means it won't
  // fight an already-running local dev session, but CI always starts fresh.
  // Next.js's own env loader picks up .env.development.local (gitignored;
  // copy from .env.dev.local.example) for gym-coach-dev credentials; in CI
  // the same vars are injected directly via the workflow's `env:` block.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
