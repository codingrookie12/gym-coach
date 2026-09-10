/**
 * e2e/specs/exercise-swap.spec.ts
 *
 * Regression coverage for the "BROWSE ALL EXERCISES" escape hatch (commit
 * 8b17947) in both places it exists — WorkoutOverviewScreen (pre-session,
 * "swap for today") and ActiveSessionScreen (mid-workout, "swap now"). Both
 * screens share the same underlying pieces (ExercisePickerSheet,
 * getAlternatives, excludeOtherSessionNames) but this was only ever
 * verified live, ad hoc, this session — no automated coverage existed
 * before this file.
 *
 * Each test gets its own disposable user + a fresh 3-exercise routine
 * (SEED_EXERCISES a/b/c, see e2e/fixtures/auth.ts) so one test's swap can
 * never leak into another's assumptions about what's currently planned.
 */
import { test, expect, SEED_EXERCISES } from '../fixtures/auth'
import { goToWorkoutOverview, goToActiveSession, workoutOverviewRow, pickerSheet } from '../fixtures/navigation'

test.describe('pre-session swap (WorkoutOverviewScreen)', () => {
  // Requesting `seededUser` here (even though unused directly) is what
  // triggers the fixture — it mints the disposable user, seeds the routine,
  // and injects the auth cookies into this test's browser context before
  // `page.goto()` runs below. Fixtures resolve once per test and are shared
  // across beforeEach/test/afterEach, so requesting it in beforeEach is
  // enough to cover every test in this describe block.
  test.beforeEach(async ({ page, seededUser }) => {
    void seededUser
    await goToWorkoutOverview(page)
  })

  test('fast-path suggestion swap replaces the exercise for today', async ({ page }) => {
    const row = workoutOverviewRow(page, SEED_EXERCISES.b)
    await row.getByRole('button', { name: 'SWAP', exact: true }).click()

    const useToday = row.getByRole('button', { name: /use today/i }).first()
    await expect(useToday, 'expected at least one fast-path suggestion for a plain Barbell exercise').toBeVisible()
    // The suggestion name sits in the row immediately preceding its "USE
    // TODAY" button (see WorkoutOverviewScreen.tsx's options.map row).
    const newName = await useToday.locator('xpath=../button[1]').textContent()
    expect(newName).toBeTruthy()

    await useToday.click()
    await row.getByRole('button', { name: /confirm swap/i }).click()

    await expect(page.getByRole('button', { name: SEED_EXERCISES.b, exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: newName!.trim(), exact: true })).toBeVisible()
    // Untouched exercises stay untouched.
    await expect(page.getByRole('button', { name: SEED_EXERCISES.a, exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: SEED_EXERCISES.c, exact: true })).toBeVisible()
  })

  test('full-browser search-and-swap replaces the exercise', async ({ page }) => {
    const row = workoutOverviewRow(page, SEED_EXERCISES.c)
    await row.getByRole('button', { name: 'SWAP', exact: true }).click()
    await row.getByRole('button', { name: /browse all exercises/i }).click()

    const sheet = pickerSheet(page)
    await expect(sheet.getByText(`SWAP ${SEED_EXERCISES.c.toUpperCase()}`)).toBeVisible()
    await sheet.getByPlaceholder('Search exercises...').fill('Incline Dumbbell Press')
    await sheet.getByText('Incline Dumbbell Press', { exact: true }).click()
    await sheet.getByRole('button', { name: 'CONFIRM', exact: true }).click()

    await expect(page.getByRole('button', { name: SEED_EXERCISES.c, exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Incline Dumbbell Press', exact: true })).toBeVisible()
  })

  test('an already-planned exercise is excluded from the swap picker', async ({ page }) => {
    const row = workoutOverviewRow(page, SEED_EXERCISES.a)
    await row.getByRole('button', { name: 'SWAP', exact: true }).click()
    await row.getByRole('button', { name: /browse all exercises/i }).click()

    const sheet = pickerSheet(page)
    await sheet.getByPlaceholder('Search exercises...').fill(SEED_EXERCISES.b)
    const resultRow = sheet.getByText(SEED_EXERCISES.b, { exact: true }).locator('xpath=ancestor::button[1]')
    await expect(resultRow).toBeDisabled()

    // Tapping a disabled/excluded row must never open the confirm panel.
    await resultRow.click({ force: true })
    await expect(sheet.getByRole('button', { name: 'CONFIRM', exact: true })).toHaveCount(0)
  })
})

test.describe('mid-workout swap (ActiveSessionScreen)', () => {
  test.beforeEach(async ({ page, seededUser }) => {
    void seededUser
    await goToActiveSession(page)
    // Lands on the first plan exercise (SEED_EXERCISES.a).
    await expect(page.getByRole('heading', { name: SEED_EXERCISES.a })).toBeVisible()
  })

  test('fast-path suggestion swap replaces the current exercise', async ({ page }) => {
    await page.locator('.swap-badge', { hasText: 'SWAP' }).click()

    const useNow = page.getByRole('button', { name: /use now/i }).first()
    await expect(useNow, 'expected at least one fast-path suggestion for a plain Barbell exercise').toBeVisible()
    const newName = (await useNow.locator('xpath=../span').textContent())?.trim()
    expect(newName).toBeTruthy()

    await useNow.click()
    await page.getByRole('button', { name: /confirm swap/i }).click()

    await expect(page.getByRole('heading', { name: newName! })).toBeVisible()
  })

  test('full-browser search-and-swap replaces the current exercise', async ({ page }) => {
    await page.locator('.swap-badge', { hasText: 'SWAP' }).click()
    await page.getByRole('button', { name: /browse all exercises/i }).click()

    const sheet = pickerSheet(page)
    await expect(sheet.getByText(`SWAP ${SEED_EXERCISES.a.toUpperCase()}`)).toBeVisible()
    await sheet.getByPlaceholder('Search exercises...').fill('Seated Cable Rows')
    await sheet.getByText('Seated Cable Rows', { exact: true }).click()
    await sheet.getByRole('button', { name: 'CONFIRM', exact: true }).click()

    await expect(page.getByRole('heading', { name: 'Seated Cable Rows' })).toBeVisible()
  })

  test('an already-planned exercise is excluded from the swap picker', async ({ page }) => {
    await page.locator('.swap-badge', { hasText: 'SWAP' }).click()
    await page.getByRole('button', { name: /browse all exercises/i }).click()

    // SEED_EXERCISES.b/.c are still queued later in this session's plan —
    // excludeOtherSessionNames() must keep them out of reach as a swap target.
    const sheet = pickerSheet(page)
    await sheet.getByPlaceholder('Search exercises...').fill(SEED_EXERCISES.b)
    const resultRow = sheet.getByText(SEED_EXERCISES.b, { exact: true }).locator('xpath=ancestor::button[1]')
    await expect(resultRow).toBeDisabled()

    await resultRow.click({ force: true })
    await expect(sheet.getByRole('button', { name: 'CONFIRM', exact: true })).toHaveCount(0)
  })
})
