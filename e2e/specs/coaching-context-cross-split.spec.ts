/**
 * e2e/specs/coaching-context-cross-split.spec.ts
 *
 * Regression coverage for a real production bug (found live 2026-09-11):
 * CoachingContextScreen showed "no info about you" / a `no-history` state
 * for an exercise that had real, recent logged history — one screen later,
 * WorkoutOverviewScreen correctly showed that exact history for the same
 * exercise in the same session.
 *
 * Root cause: `lib/coaching/data.ts`'s `fetchCoachingSessions` (feeding
 * `analyzeCoaching`'s per-exercise progression/stall/weight-too-heavy/
 * no-history logic) scoped session history strictly to the CURRENT split's
 * `user_program_split_id`. `lib/routines.ts`'s bundled templates routinely
 * repeat the same exercise across multiple splits (Face Pull on both Push
 * and OHP Day, Seated Leg Curl on both Legs and Deadlift Day, etc.) — any
 * user whose currently-selected split hadn't itself accumulated sessions
 * yet saw every such shared exercise wrongly flagged brand-new, even though
 * WorkoutOverviewScreen's own history fetch (`/api/history/exercise-strip`,
 * name-based, not split-scoped) found and displayed the real numbers.
 *
 * Fix: lib/coaching/engine.ts now merges `programSessions` (already fetched
 * cross-split for volume tallying) into the per-exercise history lookup,
 * deduped by workoutId — `lastSessionDate`/`recoveryGapDays` (the "LAST
 * SESSION" card) deliberately stay single-split-scoped; only per-exercise
 * flags/target-weight widen scope. See lib/coaching/__tests__/engine.test.ts
 * for the unit-level version of this same regression (faster, no live DB).
 * This spec is the end-to-end version: it exercises the whole
 * loadCoachingPlan -> analyzeCoaching -> CoachingContextScreen pipeline
 * against a real gym-coach-dev database, the same way the bug was actually
 * found and confirmed.
 */
import { test, expect, SEED_EXERCISES, serviceClient, mintSession, applyAuthCookies } from '../fixtures/auth'
import { createBlankProgram } from '../../lib/userProgram'
import { loadApp, startSession, viewSessionPlan } from '../fixtures/navigation'

test.describe('CoachingContextScreen — exercise shared across splits', () => {
  test('shows real history for an exercise logged only under a sibling split', async ({ page }) => {
    const mintedSession = await mintSession('t-crosssplit')
    await applyAuthCookies(page.context(), mintedSession.cookies)

    try {
      const programId = await createBlankProgram(mintedSession.client, mintedSession.userId, {
        name: 'E2E Cross-Split Program',
        splits: [
          { name: 'Split A', exercises: [{ name: SEED_EXERCISES.a, sets: 1, repRange: [8, 10] }] },
          { name: 'Split B', exercises: [{ name: SEED_EXERCISES.a, sets: 1, repRange: [8, 10] }] },
        ],
      })
      await serviceClient
        .from('users')
        .update({ onboarding_completed: true, active_user_program_id: programId })
        .eq('id', mintedSession.userId)

      const { data: splitRows, error: splitErr } = await serviceClient
        .from('user_program_splits')
        .select('id, name')
        .eq('user_program_id', programId)
      if (splitErr) throw splitErr
      const splitAId = (splitRows ?? []).find((s: any) => s.name === 'Split A')!.id as string

      // Real logged history for the shared exercise, but only under Split
      // A's id — Split B (about to be started) has never had a session of
      // its own, which is exactly the state that used to produce a false
      // `no-history` flag for an exercise the user had actually trained
      // days ago.
      const { data: exRow, error: exErr } = await serviceClient
        .from('exercises')
        .select('id')
        .eq('name', SEED_EXERCISES.a)
        .single()
      if (exErr) throw exErr

      const { data: workout, error: wErr } = await serviceClient
        .from('workouts')
        .insert({
          user_id: mintedSession.userId,
          date: '2026-09-01',
          user_program_split_id: splitAId,
          started_at: '2026-09-01T12:00:00Z',
          finished_at: '2026-09-01T13:00:00Z',
        })
        .select('id')
        .single()
      if (wErr) throw wErr

      const { error: sErr } = await serviceClient.from('sets').insert([
        { workout_id: workout!.id, exercise_id: exRow!.id, set_number: 1, weight: 150, reps: 8, rir: 2, unit: 'Lbs', completed: true, skipped: false },
        { workout_id: workout!.id, exercise_id: exRow!.id, set_number: 2, weight: 150, reps: 8, rir: 2, unit: 'Lbs', completed: true, skipped: false },
        { workout_id: workout!.id, exercise_id: exRow!.id, set_number: 3, weight: 150, reps: 8, rir: 2, unit: 'Lbs', completed: true, skipped: false },
      ])
      if (sErr) throw sErr

      await loadApp(page)
      await page.getByRole('button', { name: '02 Split B' }).click()
      await startSession(page)

      // Wait past the LoadingScreen (message is `${preSessionIntel}...`,
      // same label as the loaded header minus the ellipsis).
      await page.waitForFunction(() => document.body.innerText.includes('PRE-SESSION INTEL'), null, { timeout: 15000 })
      await page.waitForFunction(() => !document.body.innerText.includes('PRE-SESSION INTEL...'), null, { timeout: 15000 })

      // The bug: this exercise would appear under "NEW EXERCISES" (the
      // no-history section) instead of being recognized as already-trained.
      await expect(page.getByText('NEW EXERCISES')).not.toBeVisible()

      await viewSessionPlan(page)
      // WorkoutOverviewScreen's own history (name-based) always showed this
      // correctly — assert it's still there, and that the target weight
      // now carries forward from the cross-split history too (previously
      // "no weight logged").
      await expect(page.getByText('150×8').first()).toBeVisible()
      await expect(page.getByText('150 lbs', { exact: true })).toBeVisible()
    } finally {
      await serviceClient.auth.admin.deleteUser(mintedSession.userId)
    }
  })
})
