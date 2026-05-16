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
