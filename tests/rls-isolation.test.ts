/**
 * GYM-25 / GYM-79: RLS isolation tests
 * Proves user A cannot read user B's data across all core tables.
 * Requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'
import { describe, it, expect, afterAll } from 'vitest'

config({ path: resolve(__dirname, '../.env.local') })

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const serviceClient = createClient(url, serviceKey, {
  auth: { persistSession: false },
})

// Unique test emails to avoid conflicts between runs
const suffix = Date.now()
const emailA = `test-user-a-${suffix}@gym-test.invalid`
const emailB = `test-user-b-${suffix}@gym-test.invalid`
const testPassword = 'TestPass123!'

let userAId: string
let userBId: string
let workoutId: string
let programId: string
let splitId: string
let routineExerciseId: string

describe('RLS isolation', () => {
  it('sets up: creates two test users via service role', async () => {
    const { data: a, error: errA } = await serviceClient.auth.admin.createUser({
      email: emailA,
      password: testPassword,
      email_confirm: true,
    })
    const { data: b, error: errB } = await serviceClient.auth.admin.createUser({
      email: emailB,
      password: testPassword,
      email_confirm: true,
    })

    expect(errA).toBeNull()
    expect(errB).toBeNull()
    userAId = a.user!.id
    userBId = b.user!.id

    // Create public profile rows (required by FK on workouts.user_id)
    await serviceClient.from('users').insert([
      { id: userAId, display_name: 'Test User A' },
      { id: userBId, display_name: 'Test User B' },
    ])
  })

  it('sets up: creates user A program, split, routine exercise, and workout via service role', async () => {
    // Create a user_program for user A
    const { data: prog, error: progErr } = await serviceClient
      .from('user_programs')
      .insert({
        user_id: userAId,
        name: 'Test Program A',
      })
      .select('id')
      .single()
    expect(progErr).toBeNull()
    programId = prog!.id

    // Create a split
    const { data: split, error: splitErr } = await serviceClient
      .from('user_program_splits')
      .insert({
        user_program_id: programId,
        name: 'Push',
        sort_order: 0,
      })
      .select('id')
      .single()
    expect(splitErr).toBeNull()
    splitId = split!.id

    // Create a routine exercise
    const { data: re, error: reErr } = await serviceClient
      .from('user_routine_exercises')
      .insert({
        user_id: userAId,
        user_program_split_id: splitId,
        exercise_name: 'Barbell Bench Press',
        notion_name: 'Barbell Bench Press',
        sets: 3,
        rep_range_min: 8,
        rep_range_max: 12,
        weight_unit: 'lbs',
        sort_order: 0,
      })
      .select('id')
      .single()
    expect(reErr).toBeNull()
    routineExerciseId = re!.id

    // Create a workout
    const { data: w, error: wErr } = await serviceClient
      .from('workouts')
      .insert({
        user_id: userAId,
        user_program_split_id: splitId,
        date: new Date().toISOString().split('T')[0],
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    expect(wErr).toBeNull()
    workoutId = w!.id
  })

  it('user B cannot read user A\'s user_programs', async () => {
    const clientB = createClient(url, anon)
    await clientB.auth.signInWithPassword({ email: emailB, password: testPassword })

    const { data, error } = await clientB
      .from('user_programs')
      .select('*')
      .eq('id', programId)

    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('user B cannot read user A\'s user_program_splits', async () => {
    const clientB = createClient(url, anon)
    await clientB.auth.signInWithPassword({ email: emailB, password: testPassword })

    const { data, error } = await clientB
      .from('user_program_splits')
      .select('*')
      .eq('id', splitId)

    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('user B cannot read user A\'s user_routine_exercises', async () => {
    const clientB = createClient(url, anon)
    await clientB.auth.signInWithPassword({ email: emailB, password: testPassword })

    const { data, error } = await clientB
      .from('user_routine_exercises')
      .select('*')
      .eq('id', routineExerciseId)

    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('user B cannot read user A\'s workout', async () => {
    const clientB = createClient(url, anon)
    await clientB.auth.signInWithPassword({ email: emailB, password: testPassword })

    const { data, error } = await clientB
      .from('workouts')
      .select('*')
      .eq('id', workoutId)

    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })
})

afterAll(async () => {
  // Cleanup: delete test data then test users
  if (workoutId) await serviceClient.from('workouts').delete().eq('id', workoutId)
  if (routineExerciseId) await serviceClient.from('user_routine_exercises').delete().eq('id', routineExerciseId)
  if (splitId) await serviceClient.from('user_program_splits').delete().eq('id', splitId)
  if (programId) await serviceClient.from('user_programs').delete().eq('id', programId)
  if (userAId) {
    await serviceClient.from('users').delete().eq('id', userAId)
    await serviceClient.auth.admin.deleteUser(userAId)
  }
  if (userBId) {
    await serviceClient.from('users').delete().eq('id', userBId)
    await serviceClient.auth.admin.deleteUser(userBId)
  }
})
