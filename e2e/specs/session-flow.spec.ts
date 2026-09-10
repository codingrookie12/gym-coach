/**
 * e2e/specs/session-flow.spec.ts
 *
 * Locks in the fc01cbe regression: ProgressHistoryScreen's
 * /api/history/progress fetch used to run only once on mount, so the
 * Reports tab showed "NO SESSIONS YET" forever after finishing a real
 * workout, until a hard page reload. The fix (an `isActive` prop so the
 * fetch re-runs on every transition into the tab) was only ever verified
 * live, ad hoc, against gym-coach-dev this session — this test is the
 * permanent version of that check. `page.reload()` is never called here on
 * purpose: doing so would silently defeat the regression this test exists
 * to catch.
 *
 * Also covers the everyday path this whole app is built around — start a
 * session, log a set with weight/reps/RIR, see the "✓ SAVED" flash, finish
 * — which otherwise has no end-to-end coverage at all (vitest's
 * critical-path test exercises the same DB writes directly via the SDK,
 * never through the real screens/state machine).
 */
import type { Page } from '@playwright/test'
import { test, expect, SEED_EXERCISES } from '../fixtures/auth'
import { goToActiveSession } from '../fixtures/navigation'

async function typeOnNumberPad(page: Page, digits: string): Promise<void> {
  // Scoped to the `.numpad-btn` class (components/ui/NumberPad.tsx) rather
  // than a plain getByRole('button', {name}) lookup — the screen underneath
  // this full-screen overlay stays mounted (RirRow's own '0'-'5' chips use
  // the same plain digit text), so an unscoped query for e.g. "1" matches
  // both the numpad key and a RIR chip at once.
  for (const ch of digits) {
    await page.locator('.numpad-btn', { hasText: ch }).click()
  }
  await page.locator('.numpad-btn.accent').click()
}

/** Logs the current exercise's single seeded set (weight, reps, RIR). */
async function logCurrentSet(page: Page, weight: string, reps: string, rir: string): Promise<void> {
  await page.locator('.weight-btn').first().click()
  // Barbell exercises get a preset chip ladder (lib/routines.ts's BARBELL
  // const) that doesn't necessarily include the test's weight value — the
  // dashed "CUSTOM VALUE" chip forces the deterministic NumberPad path
  // regardless of what's on the ladder.
  const customValue = page.getByRole('button', { name: /custom value/i })
  if (await customValue.isVisible().catch(() => false)) await customValue.click()
  await typeOnNumberPad(page, weight)

  await page.locator('.reps-btn').first().click()
  await typeOnNumberPad(page, reps)

  // One set per exercise in this seeded routine (see e2e/fixtures/auth.ts)
  // — exactly one RIR chip row on screen, no scoping needed.
  await page.getByRole('button', { name: rir, exact: true }).click()
}

test.describe('full session flow', () => {
  test('start -> log a set with RIR -> SAVED flash -> finish -> Reports reflects it without a reload', async ({ page, seededUser }) => {
    void seededUser
    await goToActiveSession(page)
    await expect(page.getByRole('heading', { name: SEED_EXERCISES.a })).toBeVisible()

    await logCurrentSet(page, '135', '10', '2')
    await expect(page.locator('.saved-indicator'), 'expected the "✓ SAVED" flash after logging weight+reps+RIR').toBeVisible({ timeout: 15_000 })

    for (const name of [SEED_EXERCISES.b, SEED_EXERCISES.c]) {
      await page.getByRole('button', { name: /next exercise/i }).click()
      await expect(page.getByRole('heading', { name })).toBeVisible()
      await logCurrentSet(page, '95', '8', '1')
    }

    // All three exercises done — the real FINISH button (previously
    // aria-hidden while any exercise was incomplete) is now reachable.
    await page.getByRole('button', { name: 'FINISH', exact: true }).click()
    await expect(page.getByText('REVIEW SESSION')).toBeVisible()

    await page.getByRole('button', { name: /save session/i }).click()
    await expect(page.getByText('SESSION COMPLETE')).toBeVisible({ timeout: 20_000 })

    await page.getByRole('button', { name: 'DONE', exact: true }).click()
    await expect(page.getByRole('button', { name: /^start /i })).toBeVisible()

    await page.getByRole('button', { name: 'REPORTS', exact: true }).click()
    await expect(page.getByText('NO SESSIONS YET')).toHaveCount(0)
    await expect(page.getByText('MUSCLE BALANCE · THIS WEEK')).toBeVisible({ timeout: 10_000 })
  })
})
