// GYM-79: One-shot backfill — clone each user's active curated template into
// user_programs, then re-point existing user_routine_exercises and workouts
// rows to the new user_program_splits. Idempotent.
//
// Run: npx tsx scripts/gym79-backfill-user-programs.ts
//
// Requires SUPABASE_SERVICE_ROLE_KEY in env (loaded via .env.local).

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { getTemplateById } from '../lib/programTemplates'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

async function main() {
  const { data: users, error: usersErr } = await supabase
    .from('users')
    .select('id, active_program_id, active_user_program_id')
  if (usersErr) throw usersErr
  if (!users?.length) {
    console.log('No users — nothing to backfill.')
    return
  }

  for (const user of users) {
    const userId = user.id as string
    if (user.active_user_program_id) {
      console.log(`User ${userId}: already has active_user_program_id — skipping.`)
      continue
    }

    const templateId = (user.active_program_id as string) || 'ppl-default'
    const template = getTemplateById(templateId)
    if (!template) {
      console.warn(`User ${userId}: unknown template "${templateId}" — defaulting to ppl-default`)
    }
    const tpl = template ?? getTemplateById('ppl-default')!

    // Clone template manually (we can't import lib/userProgram cloneTemplate
    // because it expects a SupabaseClient that auth-checks via auth.uid; here
    // we use service role and pass user_id explicitly).
    const { data: program, error: progErr } = await supabase
      .from('user_programs')
      .insert({ user_id: userId, name: tpl.name, source_template_id: tpl.id })
      .select('id')
      .single()
    if (progErr) throw progErr
    const programId = program.id as string
    console.log(`User ${userId}: created user_program ${programId} (${tpl.name})`)

    const splitInserts = tpl.splits.map((s, i) => ({
      user_program_id: programId,
      name: s.name,
      sort_order: i,
    }))
    const { data: splitRows, error: splitErr } = await supabase
      .from('user_program_splits')
      .insert(splitInserts)
      .select('id, name')
    if (splitErr) throw splitErr
    const splitIdByName = new Map<string, string>()
    for (const s of splitRows ?? []) splitIdByName.set(s.name as string, s.id as string)

    // Re-point existing user_routine_exercises rows.
    // Match by training_mode name → split name (they're the same string).
    const { data: tmRows } = await supabase.from('training_modes').select('id, name')
    const tmNameById = new Map<string, string>()
    for (const tm of tmRows ?? []) tmNameById.set(tm.id as string, tm.name as string)

    const { data: ureRows } = await supabase
      .from('user_routine_exercises')
      .select('id, training_mode_id, user_program_split_id')
      .eq('user_id', userId)
    let ureUpdated = 0
    let ureSkipped = 0
    for (const row of ureRows ?? []) {
      if (row.user_program_split_id) { ureSkipped++; continue }
      const splitName = tmNameById.get(row.training_mode_id as string)
      if (!splitName) continue
      const splitId = splitIdByName.get(splitName)
      if (!splitId) continue
      const { error } = await supabase
        .from('user_routine_exercises')
        .update({ user_program_split_id: splitId })
        .eq('id', row.id as string)
      if (error) throw error
      ureUpdated++
    }
    console.log(`User ${userId}: user_routine_exercises updated=${ureUpdated} skipped=${ureSkipped}`)

    const { data: workoutRows } = await supabase
      .from('workouts')
      .select('id, training_mode_id, user_program_split_id')
      .eq('user_id', userId)
    let wUpdated = 0
    let wSkipped = 0
    for (const row of workoutRows ?? []) {
      if (row.user_program_split_id) { wSkipped++; continue }
      const splitName = tmNameById.get(row.training_mode_id as string)
      if (!splitName) continue
      const splitId = splitIdByName.get(splitName)
      if (!splitId) continue
      const { error } = await supabase
        .from('workouts')
        .update({ user_program_split_id: splitId })
        .eq('id', row.id as string)
      if (error) throw error
      wUpdated++
    }
    console.log(`User ${userId}: workouts updated=${wUpdated} skipped=${wSkipped}`)

    const { error: setActiveErr } = await supabase
      .from('users')
      .update({ active_user_program_id: programId })
      .eq('id', userId)
    if (setActiveErr) throw setActiveErr
    console.log(`User ${userId}: set active_user_program_id = ${programId}`)
  }

  console.log('\nBackfill complete. Verify with:')
  console.log('  SELECT count(*) FROM user_routine_exercises WHERE user_program_split_id IS NULL;  -- expect 0')
  console.log('  SELECT count(*) FROM workouts WHERE user_program_split_id IS NULL;                -- expect 0')
}

main().catch(err => {
  console.error('Backfill failed:', err)
  process.exit(1)
})
