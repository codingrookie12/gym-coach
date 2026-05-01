/**
 * seed-program-exercises.ts
 *
 * Seeds the FULL exercise library (exercises.json) into the exercises table.
 * Idempotent — uses upsert with ignoreDuplicates so it's safe to re-run.
 *
 * Run: npx tsx --env-file=.env.local scripts/seed-program-exercises.ts
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key)

const exercisesRaw: any[] = JSON.parse(readFileSync(resolve(root, 'lib/exercises.json'), 'utf8'))

const rows = exercisesRaw.map((ex: any) => ({
  name: ex.name,
  equipment: ex.equipment ?? null,
  primary_muscles: ex.primaryMuscles ?? [],
  secondary_muscles: ex.secondaryMuscles ?? [],
  instructions: ex.instructions ?? [],
  images: ex.images ?? [],
  level: ex.level ?? null,
  mechanic: ex.mechanic ?? null,
  is_custom: false,
  metadata_complete: true,
}))

console.log(`Seeding ${rows.length} exercises from exercises.json...`)

;(async () => {
  const { error } = await supabase
    .from('exercises')
    .upsert(rows, { onConflict: 'name', ignoreDuplicates: true })

  if (error) {
    console.error('Seed failed:', error)
    process.exit(1)
  }

  console.log(`✓ Done — ${rows.length} exercises upserted`)
})()
