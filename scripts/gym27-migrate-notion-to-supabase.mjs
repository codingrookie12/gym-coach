// GYM-27: Migrate historical Notion workout data into Supabase
// Usage:
//   Dry-run:  node --env-file=.env.local scripts/gym27-migrate-notion-to-supabase.mjs
//   Import:   node --env-file=.env.local scripts/gym27-migrate-notion-to-supabase.mjs --import
//   Re-run:   node --env-file=.env.local scripts/gym27-migrate-notion-to-supabase.mjs --import --force

import { createClient } from '@supabase/supabase-js'
import { parse } from 'csv-parse/sync'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const IS_IMPORT = process.argv.includes('--import')
const IS_FORCE  = process.argv.includes('--force')
const USER_EMAIL = 'sanchez92.j@gmail.com'
const CSV_PATH   = join(ROOT, 'exports', 'notion-gym-progress-2026-04-23.csv')

// ─── Exercise name map ────────────────────────────────────────────────────────
// Maps the CSV `exercise` column value → canonical exercises.json name.
// Any value not listed here is skipped.
const EXERCISE_MAP = {
  // Push
  'Wide-grip Barbell Bench Press':                         'Wide-grip Barbell Bench Press',
  'Incline Dumbbell Press':                                'Incline Dumbbell Press',
  'Seated Cable Fly':                                      'Seated Cable Fly',
  'Dumbbell Shoulder Press':                               'Dumbbell Shoulder Press',
  'Side Lateral Raise':                                    'Side Lateral Raise',
  'Face Pull':                                             'Face Pull',
  'Triceps Pushdown - Rope Attachment':                    'Triceps Pushdown - Rope Attachment',
  'Standing Low-Pulley One-Arm Triceps Extension':         'Standing Low-pulley One-arm Triceps Extension',
  'Tricep rope horizontal':                                'Cable Triceps Extension (Horizontal)',
  'Single-Arm Tricep Pushdown':                            'Cable One Arm Tricep Extension',
  // Pull
  'Wide-grip Lat Pulldown':                                'Wide-grip Lat Pulldown',
  'Seated Cable Rows':                                     'Seated Cable Rows',
  'Standing Biceps Cable Curl':                            'Standing Biceps Cable Curl',
  'Cable Curl (Low Pulley)':                               'Cable Curl (Low Pulley)',
  'Preacher Hammer Dumbbell Curl':                         'Preacher Hammer Dumbbell Curl',
  'Standing Palms-up Barbell Behind the Back Wrist Curl':  'Standing Palms-up Barbell Behind the Back Wrist Curl',
  'Cable Curl (EZ bar) — close grip':                 'Cable Curl (EZ Bar) — Close Grip',
  'Cable Curl (EZ bar) — wide grip':                  'Cable Curl (EZ Bar) — Wide Grip',
  'Hammer curl':                                           'Hammer Curls',
  'Incline Dumbbell Curl':                                 'Incline Dumbbell Curl',
  'Dumbbell Single-Arm Row':                               'One-arm Dumbbell Row',
  // Legs
  'Linear Hack Press':                                     'Linear Hack Press',
  'Linear hack press':                                     'Linear Hack Press',
  'Leg Press':                                             'Leg Press',
  'Leg Extensions':                                        'Leg Extensions',
  'Seated Leg Curl':                                       'Seated Leg Curl',
  'Romanian Deadlift':                                     'Romanian Deadlift',
  'Romanian deadlift':                                     'Romanian Deadlift',
  'Standing Calf Raises':                                  'Standing Calf Raises',
  'Seated Calf Raise':                                     'Seated Calf Raise',
  'Prone Leg Curl':                                        'Lying Leg Curls',
  'Prone Leg Curl (Machine)':                              'Lying Leg Curls',
}

// Split assignment for exercises not in the main routines
const EXTRA_SPLIT = {
  'Cable Triceps Extension (Horizontal)': 'Push',
  'Cable One Arm Tricep Extension':       'Push',
  'Cable Curl (EZ Bar) — Close Grip': 'Pull',
  'Cable Curl (EZ Bar) — Wide Grip':  'Pull',
  'Hammer Curls':                         'Pull',
  'Incline Dumbbell Curl':                'Pull',
  'One-arm Dumbbell Row':                 'Pull',
  'Seated Calf Raise':                    'Legs',
  'Lying Leg Curls':                      'Legs',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function abort(msg) {
  console.error(`\n❌  ${msg}`)
  process.exit(1)
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) abort('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// 1. Find user
console.log(`\n🔍  Looking up user ${USER_EMAIL}…`)
const { data: { users }, error: usersErr } = await supabase.auth.admin.listUsers({ perPage: 1000 })
if (usersErr) abort(`listUsers failed: ${usersErr.message}`)
const authUser = users.find(u => u.email === USER_EMAIL)
if (!authUser) abort(`No auth user found for ${USER_EMAIL}. Sign up first.`)
const userId = authUser.id
console.log(`✅  Found user: ${userId}`)

// 2. Fetch training_mode IDs
const { data: modes, error: modesErr } = await supabase.from('training_modes').select('id, name')
if (modesErr) abort(`training_modes query failed: ${modesErr.message}`)
const modeMap = Object.fromEntries(modes.map(m => [m.name, m.id]))
if (!modeMap.Push || !modeMap.Pull || !modeMap.Legs) abort('training_modes missing Push/Pull/Legs rows')
console.log(`✅  training_modes: Push=${modeMap.Push.slice(0,8)}… Pull=${modeMap.Pull.slice(0,8)}… Legs=${modeMap.Legs.slice(0,8)}…`)

// 3. Parse CSV
console.log(`\n📄  Parsing CSV…`)
const csvRaw = readFileSync(CSV_PATH, 'utf-8')
const rows = parse(csvRaw, { columns: true, skip_empty_lines: true })
console.log(`    Total rows: ${rows.length}`)

// 4. Filter rows
const filtered = []
let skippedNoSet = 0
let skippedNoMap = 0

for (const row of rows) {
  const setNum = row.set?.trim()
  if (!setNum) { skippedNoSet++; continue }

  const canonicalName = EXERCISE_MAP[row.exercise?.trim()]
  if (!canonicalName) { skippedNoMap++; continue }

  filtered.push({ ...row, _canonical: canonicalName, _setNum: parseInt(setNum, 10) })
}

console.log(`    Skipped (no set #): ${skippedNoSet}`)
console.log(`    Skipped (unmapped):  ${skippedNoMap}`)
console.log(`    To import:           ${filtered.length}`)

// Workout grouping
const workoutMap = new Map() // key → { date, split, rows[] }
for (const row of filtered) {
  const key = `${row.date}__${row.split}`
  if (!workoutMap.has(key)) workoutMap.set(key, { date: row.date, split: row.split, rows: [] })
  workoutMap.get(key).rows.push(row)
}
console.log(`    Unique sessions:     ${workoutMap.size}`)

// Per-split breakdown
const splitCount = {}
for (const { split } of workoutMap.values()) splitCount[split] = (splitCount[split] || 0) + 1
console.log(`    Push sessions: ${splitCount.Push || 0}  Pull: ${splitCount.Pull || 0}  Legs: ${splitCount.Legs || 0}`)

// Per-exercise set counts
const exCount = {}
for (const row of filtered) exCount[row._canonical] = (exCount[row._canonical] || 0) + 1
console.log(`\n    Sets per exercise:`)
for (const [name, count] of Object.entries(exCount).sort((a,b) => b[1]-a[1]))
  console.log(`      ${count.toString().padStart(3)}  ${name}`)

if (!IS_IMPORT) {
  console.log(`\n✅  Dry-run complete. Pass --import to write to Supabase.\n`)
  process.exit(0)
}

// ─── IMPORT ───────────────────────────────────────────────────────────────────

// Guard: check for existing data
const { count: existingSets } = await supabase
  .from('sets')
  .select('id', { count: 'exact', head: true })
  .eq('workout_id', supabase.from('workouts').select('id').eq('user_id', userId))

// Simpler guard via workouts table
const { count: existingWorkouts, error: wcErr } = await supabase
  .from('workouts')
  .select('id', { count: 'exact', head: true })
  .eq('user_id', userId)
if (wcErr) abort(`workouts count failed: ${wcErr.message}`)

if (existingWorkouts > 0) {
  if (!IS_FORCE) {
    abort(`User already has ${existingWorkouts} workout(s) in DB.\nPass --force to delete and re-import.`)
  }
  console.log(`\n⚠️   --force: deleting existing workouts (and sets via cascade) for user…`)
  const { error: delErr } = await supabase.from('workouts').delete().eq('user_id', userId)
  if (delErr) abort(`Delete failed: ${delErr.message}`)
  console.log(`    Deleted.`)
}

// 5. Seed exercises
console.log(`\n📦  Seeding exercises table…`)
const exercisesJson = JSON.parse(readFileSync(join(ROOT, 'lib', 'exercises.json'), 'utf-8'))
const exByName = Object.fromEntries(exercisesJson.map(e => [e.name, e]))

// Determine split for every canonical name we'll import
const canonicalNames = [...new Set(Object.values(EXERCISE_MAP))]
const routineSplits = {
  'Wide-grip Barbell Bench Press':                        'Push',
  'Incline Dumbbell Press':                               'Push',
  'Seated Cable Fly':                                     'Push',
  'Dumbbell Shoulder Press':                              'Push',
  'Side Lateral Raise':                                   'Push',
  'Face Pull':                                            'Push',
  'Triceps Pushdown - Rope Attachment':                   'Push',
  'Standing Low-pulley One-arm Triceps Extension':        'Push',
  'Wide-grip Lat Pulldown':                               'Pull',
  'Seated Cable Rows':                                    'Pull',
  'Standing Biceps Cable Curl':                           'Pull',
  'Cable Curl (Low Pulley)':                              'Pull',
  'Preacher Hammer Dumbbell Curl':                        'Pull',
  'Standing Palms-up Barbell Behind the Back Wrist Curl': 'Pull',
  'Linear Hack Press':                                    'Legs',
  'Leg Press':                                            'Legs',
  'Leg Extensions':                                       'Legs',
  'Seated Leg Curl':                                      'Legs',
  'Romanian Deadlift':                                    'Legs',
  'Standing Calf Raises':                                 'Legs',
  ...EXTRA_SPLIT,
}

const exerciseRows = []
for (const canonName of canonicalNames) {
  const ex = exByName[canonName]
  if (!ex) { console.warn(`  ⚠️  Not found in exercises.json: ${canonName}`); continue }
  const split = routineSplits[canonName]
  if (!split) { console.warn(`  ⚠️  No split assigned for: ${canonName}`); continue }
  exerciseRows.push({
    name:              canonName,
    training_mode_id:  modeMap[split],
    equipment:         ex.equipment ?? null,
    primary_muscles:   ex.primaryMuscles ?? [],
    secondary_muscles: ex.secondaryMuscles ?? [],
    force:             ex.force ?? null,
    level:             ex.level ?? null,
    mechanic:          ex.mechanic ?? null,
    category:          ex.category ?? null,
    is_custom:         false,
    metadata_complete: true,
  })
}

const { error: exErr } = await supabase.from('exercises').upsert(exerciseRows, { onConflict: 'name', ignoreDuplicates: true })
if (exErr) abort(`exercises upsert failed: ${exErr.message}`)

// Fetch all exercise IDs by name
const { data: dbExercises, error: fetchExErr } = await supabase.from('exercises').select('id, name')
if (fetchExErr) abort(`exercises fetch failed: ${fetchExErr.message}`)
const exerciseIdMap = Object.fromEntries(dbExercises.map(e => [e.name, e.id]))
console.log(`✅  Exercises seeded: ${exerciseRows.length} rows (${dbExercises.length} total in DB)`)

// 6. Insert workouts
console.log(`\n🏋️   Inserting ${workoutMap.size} workouts…`)
const workoutInserts = []
for (const { date, split, rows: wRows } of workoutMap.values()) {
  const startedAt = wRows
    .map(r => r.created)
    .filter(Boolean)
    .sort()[0] ?? null
  workoutInserts.push({
    user_id:          userId,
    training_mode_id: modeMap[split],
    date,
    started_at:       startedAt || null,
  })
}

const { error: wErr } = await supabase
  .from('workouts')
  .upsert(workoutInserts, { onConflict: 'user_id,date,training_mode_id', ignoreDuplicates: true })
if (wErr) abort(`workouts insert failed: ${wErr.message}`)

// Fetch inserted workout IDs
const { data: dbWorkouts, error: fetchWErr } = await supabase
  .from('workouts')
  .select('id, date, training_mode_id')
  .eq('user_id', userId)
if (fetchWErr) abort(`workouts fetch failed: ${fetchWErr.message}`)

const workoutIdMap = Object.fromEntries(
  dbWorkouts.map(w => [`${w.date}__${w.training_mode_id}`, w.id])
)
console.log(`✅  Workouts inserted: ${dbWorkouts.length}`)

// 7. Insert sets
console.log(`\n📝  Inserting ${filtered.length} sets…`)
const setInserts = []
for (const row of filtered) {
  const canonName  = row._canonical
  const exerciseId = exerciseIdMap[canonName]
  if (!exerciseId) { console.warn(`  ⚠️  No exercise_id for: ${canonName}`); continue }

  const trainingModeId = modeMap[row.split]
  const workoutId = workoutIdMap[`${row.date}__${trainingModeId}`]
  if (!workoutId) { console.warn(`  ⚠️  No workout_id for ${row.date} ${row.split}`); continue }

  const rawUnit = row.unit?.trim()
  const unit = ['Lbs', 'Kg', 'Pins'].includes(rawUnit) ? rawUnit : 'Lbs'

  setInserts.push({
    workout_id:  workoutId,
    exercise_id: exerciseId,
    set_number:  row._setNum,
    weight:      row.weight ? parseFloat(row.weight) : null,
    reps:        row.reps   ? parseInt(row.reps, 10)  : null,
    unit,
    completed:   true,
    skipped:     false,
    notes:       row.notes?.trim() || null,
  })
}

let insertedSets = 0
for (const batch of chunk(setInserts, 100)) {
  const { error: sErr } = await supabase.from('sets').insert(batch)
  if (sErr) abort(`sets insert failed: ${sErr.message}`)
  insertedSets += batch.length
  process.stdout.write(`\r    ${insertedSets}/${setInserts.length} sets inserted…`)
}
console.log(`\n✅  Sets inserted: ${insertedSets}`)

// 8. Seed exercise_weight_override with latest weight per exercise
console.log(`\n⚖️   Seeding exercise_weight_override…`)

// Find most recent set per exercise: group by exercise_id, pick the one from the latest date
const latestByExercise = {}
for (const row of filtered) {
  const canonName = row._canonical
  const exId = exerciseIdMap[canonName]
  if (!exId) continue
  const existing = latestByExercise[exId]
  if (!existing || row.date > existing.date) {
    const rawUnit = row.unit?.trim()
    const unit = ['Lbs', 'Kg', 'Pins'].includes(rawUnit) ? rawUnit : 'Lbs'
    latestByExercise[exId] = { date: row.date, weight: parseFloat(row.weight), unit }
  }
}

const overrideInserts = Object.entries(latestByExercise)
  .filter(([, v]) => !isNaN(v.weight) && v.weight > 0)
  .map(([exerciseId, { weight, unit }]) => ({
    user_id:         userId,
    exercise_id:     exerciseId,
    override_weight: weight,
    unit,
  }))

const { error: ovErr } = await supabase
  .from('exercise_weight_override')
  .upsert(overrideInserts, { onConflict: 'user_id,exercise_id' })
if (ovErr) abort(`exercise_weight_override upsert failed: ${ovErr.message}`)
console.log(`✅  Weight overrides seeded: ${overrideInserts.length}`)

// 9. Final verification counts
console.log(`\n📊  Final DB counts:`)
const { count: finalWorkouts } = await supabase.from('workouts').select('id', { count: 'exact', head: true }).eq('user_id', userId)
const { count: finalOverrides } = await supabase.from('exercise_weight_override').select('id', { count: 'exact', head: true }).eq('user_id', userId)

// Count sets via join — use a direct query
const { data: setsCountData } = await supabase
  .from('sets')
  .select('id, workouts!inner(user_id)', { count: 'exact', head: false })
  .eq('workouts.user_id', userId)

console.log(`    Workouts:          ${finalWorkouts}`)
console.log(`    Sets:              ${setInserts.length} inserted this run`)
console.log(`    Weight overrides:  ${finalOverrides}`)
console.log(`\n🎉  Migration complete!\n`)
console.log(`Next step: set Notion DB to read-only (archive), then implement GYM-69.\n`)
