/**
 * e2e/specs/unit-toggle.spec.ts
 *
 * Regression coverage for the kg/lbs display-unit toggle added by the
 * equipment-instance feature (6150ba7 onward) — only ever verified live,
 * ad hoc, against gym-coach-dev this session (see lib/weightConversion.ts's
 * header, which documents a real ~2.2x data-corruption bug the redesign
 * branch found and fixed: tapping a preset weight while toggled to kg wrote
 * the raw lbs number back labeled 'kg'). This locks in that toggling
 * actually converts the displayed number, not just the unit label.
 */
import { test, expect, SEED_EXERCISES } from '../fixtures/auth'
import { goToActiveSession } from '../fixtures/navigation'

test.describe('mass-unit (kg/lbs) toggle', () => {
  test.beforeEach(async ({ page, seededUser }) => {
    void seededUser
    await goToActiveSession(page)
    await expect(page.getByRole('heading', { name: SEED_EXERCISES.a })).toBeVisible()
  })

  test('toggling the unit converts an already-entered weight, not just its label', async ({ page }) => {
    // Enter 135 via the deterministic NumberPad path — Barbell's preset
    // chip ladder (lib/routines.ts's BARBELL const) doesn't include 135, so
    // this always lands on "CUSTOM VALUE" -> NumberPad regardless of ladder
    // contents.
    await page.locator('.weight-btn').first().click()
    const customValue = page.getByRole('button', { name: /custom value/i })
    if (await customValue.isVisible().catch(() => false)) await customValue.click()
    // Scoped to `.numpad-btn` (components/ui/NumberPad.tsx) — the RIR row
    // underneath this full-screen overlay uses the same plain '0'-'5' digit
    // text, so an unscoped lookup for e.g. "1" is ambiguous.
    for (const ch of '135') await page.locator('.numpad-btn', { hasText: ch }).click()
    await page.locator('.numpad-btn.accent').click()

    await expect(page.locator('.weight-btn').first()).toContainText('135')
    const toggle = page.getByRole('button', { name: /^(Lbs|Kg)$/ })
    await expect(toggle).toHaveText('Lbs')

    await toggle.click()

    // lib/weightConversion.ts's own worked example: 135 lbs / 2.20462 =
    // 61.23..., snapped to the nearest 2.5-unit loadable increment = 60 kg.
    await expect(toggle).toHaveText('Kg')
    await expect(page.locator('.weight-btn').first()).toContainText('60')

    await toggle.click()

    // Converting back re-snaps from the already-rounded 60kg value, not the
    // original 135 — 60 * 2.20462 = 132.2772, snapped to 132.5. This is the
    // correct, intentional lossy round-trip (a real loadable weight only
    // ever exists at 2.5-unit steps), not a bug — asserting the exact
    // value here is what would catch a regression to the "relabel without
    // reconverting" bug the branch's history warns about (that bug would
    // leave this showing 60, not 132.5).
    await expect(toggle).toHaveText('Lbs')
    await expect(page.locator('.weight-btn').first()).toContainText('132.5')
  })
})
