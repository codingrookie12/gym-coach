/**
 * e2e/fixtures/navigation.ts — shared click-paths through the app's screen
 * state machine (app/page.tsx's `Screen` union). Kept in one place so a
 * future screen-flow change (e.g. an extra confirmation step) only needs
 * updating here, not in every spec that walks through it.
 */
import type { Page } from '@playwright/test'

/** Loads the app fresh and waits past the initial 'detecting' screen. */
export async function loadApp(page: Page): Promise<void> {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  // The initial client-side detect() (localStorage + Supabase checks) runs
  // after hydration — give it a beat before asserting on the landed screen,
  // same allowance the redesign branch's own click-through spec uses.
  await page.waitForTimeout(1500)
}

/** PreSessionScreen "START {split}" -> CoachingContextScreen. */
export async function startSession(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^start /i }).click()
}

/** CoachingContextScreen "VIEW SESSION PLAN ->" -> WorkoutOverviewScreen. */
export async function viewSessionPlan(page: Page): Promise<void> {
  await page.getByRole('button', { name: /view session plan/i }).click()
}

/** WorkoutOverviewScreen "BEGIN WORKOUT ->" -> ActiveSessionScreen. */
export async function beginWorkout(page: Page): Promise<void> {
  await page.getByRole('button', { name: /begin workout/i }).click()
}

/** Fresh load all the way to WorkoutOverviewScreen (pre-session plan review). */
export async function goToWorkoutOverview(page: Page): Promise<void> {
  await loadApp(page)
  await startSession(page)
  await viewSessionPlan(page)
}

/** Fresh load all the way into an active session, on the first exercise. */
export async function goToActiveSession(page: Page): Promise<void> {
  await goToWorkoutOverview(page)
  await beginWorkout(page)
}

/**
 * WorkoutOverviewScreen renders one card per plan exercise, each containing
 * both the exercise-name button and that row's own SWAP badge /
 * BROWSE-ALL-EXERCISES entry point. There's no test id to key off (see
 * e2e/README.md), so this walks up from the name button to the nearest
 * ancestor that also contains the swap controls: button -> name-row div ->
 * left-column div -> content-row div -> CARD div (4 parent hops). Scoping
 * this way (instead of a global page-level query) is what makes it safe to
 * have three same-shaped exercise cards on screen at once.
 */
export function workoutOverviewRow(page: Page, exerciseName: string) {
  return page.getByRole('button', { name: exerciseName, exact: true }).locator('xpath=../../../..')
}

/**
 * Scopes to the ExercisePickerSheet's own root element (components/
 * ExercisePickerSheet.tsx). Sheets/pads render as fixed-position overlays
 * *alongside* the screen underneath, not in place of it — that screen's own
 * DOM (e.g. WorkoutOverviewScreen's plain exercise-name buttons) stays
 * mounted and queryable the whole time. An unscoped `getByText`/`getByRole`
 * search for an exercise name can therefore match either the picker's row
 * or the exact same name still sitting in the screen behind it. Walks up
 * from the sheet's search input (input -> relative-wrapper div ->
 * padding-wrapper div -> sheet root div, 3 parent hops) since the sheet has
 * no dialog role or test id to key off directly.
 */
export function pickerSheet(page: Page) {
  return page.getByPlaceholder('Search exercises...').locator('xpath=../../..')
}
