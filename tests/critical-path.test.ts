/**
 * GYM-28: Critical path test
 *
 * Simulates the full user journey through the Supabase SDK:
 *   sign in → pick a program → log a workout → add sets → read them back
 *
 * All data operations are performed as the authenticated user (not service role),
 * matching the real app's write path. Service role is only used for user
 * administration and cleanup.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { SupabaseClient } from '@supabase/supabase-js'
import { serviceClient, signInAs } from './helpers'

const suffix = Date.now()
const email = `test-cp-${suffix}@gym-test.invalid`

let userId: string
let client: SupabaseClient

let exerciseId: string
let programId: string
let splitId: string
let workoutId: string

const TEST_SETS = [
  { set_number: 1, weight: 135, reps: 10 },
  { set_number: 2, weight: 135, reps: 9 },
  { set_number: 3, weight: 135, reps: 8 },
]

describe('Critical path: sign in → log workout → read back', () => {
  beforeAll(async () => {
    const { data, error } = await serviceClient.auth.admin.createUser({
      email,
      email_confirm: true,
    })
    if (error) throw error
    userId = data.user!.id
    client = await signInAs(email)
  })

  it('user can sign in and has an authenticated session', async () => {
    const { data, error } = await client.auth.getUser()
    expect(error).toBeNull()
    expect(data.user).toBeTruthy()
    expect(data.user!.id).toBe(userId)
  })

  it('user can browse the exercise library (canonical exercises are public)', async () => {
    const { data, error } = await client
      .from('exercises')
      .select('id, name')
      .eq('is_custom', false)
      .limit(1)
      .single()
    expect(error).toBeNull()
    expect(data).toBeTruthy()
    exerciseId = data!.id
  })

  it('user can create a program', async () => {
    const { data, error } = await client
      .from('user_programs')
      .insert({ user_id: userId, name: 'My First Program' })
      .select('id')
      .single()
    expect(error).toBeNull()
    expect(data).toBeTruthy()
    programId = data!.id
  })

  it('user can create a split inside their program', async () => {
    const { data, error } = await client
      .from('user_program_splits')
      .insert({ user_program_id: programId, name: 'Push Day', sort_order: 0 })
      .select('id')
      .single()
    expect(error).toBeNull()
    expect(data).toBeTruthy()
    splitId = data!.id
  })

  it('user can start a workout', async () => {
    const { data, error } = await client
      .from('workouts')
      .insert({
        user_id: userId,
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

  it('user can log 3 sets for the workout', async () => {
    const rows = TEST_SETS.map((s) => ({
      workout_id: workoutId,
      exercise_id: exerciseId,
      unit: 'Lbs' as const,
      ...s,
    }))
    const { data, error } = await client.from('sets').insert(rows).select('id')
    expect(error).toBeNull()
    expect(data).toHaveLength(3)
  })

  it('user can read back their workout', async () => {
    const { data, error } = await client
      .from('workouts')
      .select('id, date, user_program_split_id')
      .eq('id', workoutId)
      .single()
    expect(error).toBeNull()
    expect(data!.id).toBe(workoutId)
    expect(data!.user_program_split_id).toBe(splitId)
  })

  it('user can read back all 3 sets with correct weight and reps', async () => {
    const { data, error } = await client
      .from('sets')
      .select('set_number, weight, reps')
      .eq('workout_id', workoutId)
      .order('set_number', { ascending: true })
    expect(error).toBeNull()
    expect(data).toHaveLength(3)
    expect(Number(data![0].weight)).toBe(TEST_SETS[0].weight)
    expect(data![0].reps).toBe(TEST_SETS[0].reps)
    expect(data![2].reps).toBe(TEST_SETS[2].reps)
  })

  afterAll(async () => {
    // Explicit teardown respecting RESTRICT constraint (workouts before splits).
    if (workoutId) await serviceClient.from('workouts').delete().eq('id', workoutId)
    if (splitId) await serviceClient.from('user_program_splits').delete().eq('id', splitId)
    if (programId) await serviceClient.from('user_programs').delete().eq('id', programId)
    if (userId) await serviceClient.auth.admin.deleteUser(userId)
  })
})

/**
 * GYM-83: Reorder exercises within a split.
 *
 * Exercises the lib helper directly (mirrors what the PATCH route does). Asserts:
 *   - new sort_order reflected in DB,
 *   - only rows whose position changed get a fresh updated_at,
 *   - a second user cannot UPDATE the first user's rows (RLS on UPDATE).
 */
describe('GYM-83: reorder exercises within a split', () => {
  const reorderSuffix = Date.now() + 1
  const reorderEmailA = `test-reorder-a-${reorderSuffix}@gym-test.invalid`
  const reorderEmailB = `test-reorder-b-${reorderSuffix}@gym-test.invalid`

  let aUserId: string
  let bUserId: string
  let aClient: SupabaseClient
  let bClient: SupabaseClient
  let rProgramId: string
  let rSplitId: string
  const rowIds: string[] = []      // ordered by initial sort_order 0..2
  const exerciseNames = ['Barbell Bench Press', 'Dumbbell Row', 'Overhead Press']

  beforeAll(async () => {
    const { data: a, error: aErr } = await serviceClient.auth.admin.createUser({ email: reorderEmailA, email_confirm: true })
    if (aErr) throw aErr
    aUserId = a.user!.id
    const { data: b, error: bErr } = await serviceClient.auth.admin.createUser({ email: reorderEmailB, email_confirm: true })
    if (bErr) throw bErr
    bUserId = b.user!.id

    aClient = await signInAs(reorderEmailA)
    bClient = await signInAs(reorderEmailB)

    const { data: prog } = await aClient
      .from('user_programs')
      .insert({ user_id: aUserId, name: 'Reorder Test Program' })
      .select('id').single()
    rProgramId = prog!.id

    const { data: split } = await aClient
      .from('user_program_splits')
      .insert({ user_program_id: rProgramId, name: 'Push', sort_order: 0 })
      .select('id').single()
    rSplitId = split!.id

    for (let i = 0; i < exerciseNames.length; i++) {
      const { data: row } = await aClient
        .from('user_routine_exercises')
        .insert({
          user_id: aUserId,
          user_program_split_id: rSplitId,
          exercise_name: exerciseNames[i],
          canonical_name: exerciseNames[i],
          sets: 3,
          rep_range_min: 8,
          rep_range_max: 12,
          weight_unit: 'lbs',
          sort_order: i,
          added_via: 'manual-add',
        })
        .select('id').single()
      rowIds.push(row!.id)
    }
  })

  it('reorder swaps two adjacent rows and leaves the third untouched', async () => {
    const { reorderExercisesInSplit } = await import('../lib/userRoutine')

    // Capture pre-reorder updated_at for the row that shouldn't move (index 2).
    const { data: beforeRows } = await aClient
      .from('user_routine_exercises')
      .select('id, sort_order, updated_at')
      .eq('user_program_split_id', rSplitId)
      .order('sort_order', { ascending: true })
    const untouchedBefore = beforeRows!.find(r => r.id === rowIds[2])!

    // Wait a beat so updated_at would visibly change if we touched the row.
    await new Promise(r => setTimeout(r, 10))

    // Swap positions 0 and 1; leave position 2 alone.
    const newOrder = [rowIds[1], rowIds[0], rowIds[2]]
    const result = await reorderExercisesInSplit(aClient, aUserId, rSplitId, newOrder)

    expect(result.map(r => r.id)).toEqual(newOrder)
    expect(result.map(r => r.sort_order)).toEqual([0, 1, 2])

    const { data: afterRows } = await aClient
      .from('user_routine_exercises')
      .select('id, sort_order, updated_at')
      .eq('user_program_split_id', rSplitId)
      .order('sort_order', { ascending: true })
    expect(afterRows!.map(r => r.id)).toEqual(newOrder)

    // Minimal-diff: untouched row's updated_at unchanged.
    const untouchedAfter = afterRows!.find(r => r.id === rowIds[2])!
    expect(untouchedAfter.updated_at).toBe(untouchedBefore.updated_at)
  })

  it('user B cannot reorder user A\'s split (RLS blocks UPDATE)', async () => {
    // Direct UPDATE as user B should affect zero rows (RLS filter).
    const { data: updated } = await bClient
      .from('user_routine_exercises')
      .update({ sort_order: 99 })
      .eq('id', rowIds[0])
      .select('id')
    expect(updated ?? []).toHaveLength(0)

    // Confirm A's row is unchanged.
    const { data: stillThere } = await aClient
      .from('user_routine_exercises')
      .select('id, sort_order')
      .eq('id', rowIds[0])
      .single()
    expect(stillThere!.sort_order).not.toBe(99)
  })

  afterAll(async () => {
    for (const id of rowIds) await serviceClient.from('user_routine_exercises').delete().eq('id', id)
    if (rSplitId) await serviceClient.from('user_program_splits').delete().eq('id', rSplitId)
    if (rProgramId) await serviceClient.from('user_programs').delete().eq('id', rProgramId)
    if (aUserId) await serviceClient.auth.admin.deleteUser(aUserId)
    if (bUserId) await serviceClient.auth.admin.deleteUser(bUserId)
  })
})
