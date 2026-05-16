/**
 * GYM-28: RLS isolation test
 *
 * Proves user B cannot read user A's data across all core tables.
 * Data is created AS user A (authenticated SDK client) — this exercises INSERT
 * RLS policies, not just SELECT. The service role is only used for user
 * administration (create / delete) and cleanup.
 *
 * Tables covered: user_programs, user_program_splits, user_routine_exercises,
 * workouts, sets.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { SupabaseClient } from '@supabase/supabase-js'
import { serviceClient, signInAs } from './helpers'

const suffix = Date.now()
const emailA = `test-rls-a-${suffix}@gym-test.invalid`
const emailB = `test-rls-b-${suffix}@gym-test.invalid`

let userAId: string
let userBId: string
let clientA: SupabaseClient
let clientB: SupabaseClient

let programId: string
let splitId: string
let routineExerciseId: string
let workoutId: string
let setId: string
let exerciseId: string

describe('RLS isolation', () => {
  beforeAll(async () => {
    // Create both test users via service role
    const { data: a, error: errA } = await serviceClient.auth.admin.createUser({
      email: emailA,
      email_confirm: true,
    })
    const { data: b, error: errB } = await serviceClient.auth.admin.createUser({
      email: emailB,
      email_confirm: true,
    })
    if (errA) throw errA
    if (errB) throw errB
    userAId = a.user!.id
    userBId = b.user!.id

    // Mint authenticated sessions for both users
    clientA = await signInAs(emailA)
    clientB = await signInAs(emailB)

    // Fetch any canonical exercise to use for sets (realistic: user picks from library)
    const { data: exercises, error: exErr } = await clientA
      .from('exercises')
      .select('id')
      .eq('is_custom', false)
      .limit(1)
      .single()
    if (exErr) throw exErr
    exerciseId = exercises.id
  })

  describe('User A write path (INSERT RLS)', () => {
    it('user A can INSERT a user_program', async () => {
      const { data, error } = await clientA
        .from('user_programs')
        .insert({ user_id: userAId, name: 'RLS Test Program' })
        .select('id')
        .single()
      expect(error).toBeNull()
      expect(data).toBeTruthy()
      programId = data!.id
    })

    it('user A can INSERT a user_program_split', async () => {
      const { data, error } = await clientA
        .from('user_program_splits')
        .insert({ user_program_id: programId, name: 'Push', sort_order: 0 })
        .select('id')
        .single()
      expect(error).toBeNull()
      expect(data).toBeTruthy()
      splitId = data!.id
    })

    it('user A can INSERT a user_routine_exercise', async () => {
      const { data, error } = await clientA
        .from('user_routine_exercises')
        .insert({
          user_id: userAId,
          user_program_split_id: splitId,
          exercise_name: 'Barbell Bench Press',
          canonical_name: 'Barbell Bench Press',
          sets: 3,
          rep_range_min: 8,
          rep_range_max: 12,
          weight_unit: 'lbs',
          sort_order: 0,
        })
        .select('id')
        .single()
      expect(error).toBeNull()
      expect(data).toBeTruthy()
      routineExerciseId = data!.id
    })

    it('user A can INSERT a workout', async () => {
      const { data, error } = await clientA
        .from('workouts')
        .insert({
          user_id: userAId,
          user_program_split_id: splitId,
          date: new Date().toISOString().split('T')[0],
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single()
      expect(error).toBeNull()
      expect(data).toBeTruthy()
      workoutId = data!.id
    })

    it('user A can INSERT a set', async () => {
      const { data, error } = await clientA
        .from('sets')
        .insert({
          workout_id: workoutId,
          exercise_id: exerciseId,
          set_number: 1,
          weight: 135,
          reps: 10,
          unit: 'Lbs',
        })
        .select('id')
        .single()
      expect(error).toBeNull()
      expect(data).toBeTruthy()
      setId = data!.id
    })
  })

  describe('User A positive read (SELECT RLS)', () => {
    it('user A can SELECT their own user_programs', async () => {
      const { data, error } = await clientA
        .from('user_programs')
        .select('id')
        .eq('id', programId)
      expect(error).toBeNull()
      expect(data).toHaveLength(1)
    })

    it('user A can SELECT their own sets', async () => {
      const { data, error } = await clientA
        .from('sets')
        .select('id')
        .eq('id', setId)
      expect(error).toBeNull()
      expect(data).toHaveLength(1)
    })
  })

  describe('User B isolation (SELECT RLS)', () => {
    it('user B cannot read user A\'s user_programs', async () => {
      const { data, error } = await clientB
        .from('user_programs')
        .select('id')
        .eq('id', programId)
      expect(error).toBeNull()
      expect(data).toHaveLength(0)
    })

    it('user B cannot read user A\'s user_program_splits', async () => {
      const { data, error } = await clientB
        .from('user_program_splits')
        .select('id')
        .eq('id', splitId)
      expect(error).toBeNull()
      expect(data).toHaveLength(0)
    })

    it('user B cannot read user A\'s user_routine_exercises', async () => {
      const { data, error } = await clientB
        .from('user_routine_exercises')
        .select('id')
        .eq('id', routineExerciseId)
      expect(error).toBeNull()
      expect(data).toHaveLength(0)
    })

    it('user B cannot read user A\'s workout', async () => {
      const { data, error } = await clientB
        .from('workouts')
        .select('id')
        .eq('id', workoutId)
      expect(error).toBeNull()
      expect(data).toHaveLength(0)
    })

    it('user B cannot read user A\'s sets', async () => {
      const { data, error } = await clientB
        .from('sets')
        .select('id')
        .eq('id', setId)
      expect(error).toBeNull()
      expect(data).toHaveLength(0)
    })
  })

  afterAll(async () => {
    // Explicit teardown respecting RESTRICT constraint on workouts → splits.
    // Sets and workouts must be removed before splits can be deleted.
    if (setId) await serviceClient.from('sets').delete().eq('id', setId)
    if (workoutId) await serviceClient.from('workouts').delete().eq('id', workoutId)
    if (routineExerciseId) await serviceClient.from('user_routine_exercises').delete().eq('id', routineExerciseId)
    if (splitId) await serviceClient.from('user_program_splits').delete().eq('id', splitId)
    if (programId) await serviceClient.from('user_programs').delete().eq('id', programId)
    if (userAId) await serviceClient.auth.admin.deleteUser(userAId)
    if (userBId) await serviceClient.auth.admin.deleteUser(userBId)
  })
})
