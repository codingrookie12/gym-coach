/**
 * GYM-25: RLS isolation test
 * Proves user A cannot read user B's workout data.
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

describe('RLS isolation — workouts table', () => {
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

  it('user A inserts a workout row', async () => {
    const clientA = createClient(url, anon)
    const { error: signInErr } = await clientA.auth.signInWithPassword({
      email: emailA,
      password: testPassword,
    })
    expect(signInErr).toBeNull()

    // Fetch a training_mode_id to satisfy FK
    const { data: modes } = await clientA.from('training_modes').select('id').limit(1)
    const trainingModeId = modes?.[0]?.id

    const { data, error } = await clientA
      .from('workouts')
      .insert({
        user_id: userAId,
        training_mode_id: trainingModeId ?? null,
        date: new Date().toISOString().split('T')[0],
      })
      .select()
      .single()

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    workoutId = data!.id
  })

  it('user B cannot read user A\'s workout', async () => {
    const clientB = createClient(url, anon)
    const { error: signInErr } = await clientB.auth.signInWithPassword({
      email: emailB,
      password: testPassword,
    })
    expect(signInErr).toBeNull()

    const { data, error } = await clientB
      .from('workouts')
      .select('*')
      .eq('id', workoutId)

    // RLS returns empty array (not an error) when row is invisible
    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })
})

afterAll(async () => {
  // Cleanup: delete test users (cascades to workouts/sets via FK)
  if (userAId) await serviceClient.auth.admin.deleteUser(userAId)
  if (userBId) await serviceClient.auth.admin.deleteUser(userBId)
})
