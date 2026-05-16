/**
 * GYM-25 / GYM-79: RLS isolation tests
 * Proves user A cannot read user B's data across all core tables.
 *
 * Passwordless setup (GYM-93): users are created via service-role admin and
 * sessions are minted by exchanging an admin-generated magic link's hashed
 * token via verifyOtp — no password auth anywhere.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { describe, it, expect, afterAll } from 'vitest'

config({ path: resolve(__dirname, '../.env.local') })

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const serviceClient = createClient(url, serviceKey, {
  auth: { persistSession: false },
})

const suffix = Date.now()
const emailA = `test-user-a-${suffix}@gym-test.invalid`
const emailB = `test-user-b-${suffix}@gym-test.invalid`

let userAId: string
let userBId: string
let workoutId: string
let programId: string
let splitId: string
let routineExerciseId: string

async function signInAsB(): Promise<SupabaseClient> {
  // Mint a session via admin-generated magic link, then verify its hashed
  // token on a fresh client. Equivalent to a passwordless email sign-in.
  const { data, error } = await serviceClient.auth.admin.generateLink({
    type: 'magiclink',
    email: emailB,
  })
  if (error) throw error
  const tokenHash = data.properties?.hashed_token
  if (!tokenHash) throw new Error('generateLink returned no hashed_token')

  const client = createClient(url, anon, { auth: { persistSession: false } })
  const { error: verifyErr } = await client.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  })
  if (verifyErr) throw verifyErr
  return client
}

describe('RLS isolation', () => {
  it('sets up: creates two test users via service role', async () => {
    const { data: a, error: errA } = await serviceClient.auth.admin.createUser({
      email: emailA,
      email_confirm: true,
    })
    const { data: b, error: errB } = await serviceClient.auth.admin.createUser({
      email: emailB,
      email_confirm: true,
    })

    expect(errA).toBeNull()
    expect(errB).toBeNull()
    userAId = a.user!.id
    userBId = b.user!.id

    // public.users rows are created automatically by the
    // handle_new_user trigger on auth.users insert.
  })

  it('sets up: creates user A program, split, routine exercise, and workout via service role', async () => {
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

    const { data: re, error: reErr } = await serviceClient
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
    expect(reErr).toBeNull()
    routineExerciseId = re!.id

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
    const clientB = await signInAsB()
    const { data, error } = await clientB
      .from('user_programs')
      .select('*')
      .eq('id', programId)

    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('user B cannot read user A\'s user_program_splits', async () => {
    const clientB = await signInAsB()
    const { data, error } = await clientB
      .from('user_program_splits')
      .select('*')
      .eq('id', splitId)

    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('user B cannot read user A\'s user_routine_exercises', async () => {
    const clientB = await signInAsB()
    const { data, error } = await clientB
      .from('user_routine_exercises')
      .select('*')
      .eq('id', routineExerciseId)

    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('user B cannot read user A\'s workout', async () => {
    const clientB = await signInAsB()
    const { data, error } = await clientB
      .from('workouts')
      .select('*')
      .eq('id', workoutId)

    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })
})

afterAll(async () => {
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
