import { Equipment, Muscle, Split } from './exerciseLibrary'
import { createSupabaseBrowserClient } from './supabase'

// GYM-68: custom exercises live in Supabase `exercises` table where
// is_custom = true. RLS scopes access to `created_by = auth.uid()`.

export interface PendingExercise {
  id: string
  name: string
  addedAt: string
  metadataComplete: boolean
  createdBy: string | null
  equipment?: Equipment
  primaryMuscles?: Muscle[]
  split?: Split | null
  instructions?: string[]
}

interface DbRow {
  id: string
  name: string
  created_at: string
  metadata_complete: boolean
  created_by: string | null
  equipment: string | null
  primary_muscles: string[] | null
  split: string | null
  instructions: string[] | null
}

function rowToPending(row: DbRow): PendingExercise {
  return {
    id: row.id,
    name: row.name,
    addedAt: row.created_at,
    metadataComplete: row.metadata_complete,
    createdBy: row.created_by ?? null,
    equipment: (row.equipment as Equipment | null) ?? undefined,
    primaryMuscles: (row.primary_muscles as Muscle[] | null) ?? undefined,
    split: (row.split as Split | null) ?? undefined,
    instructions: row.instructions ?? undefined,
  }
}

const SELECT_COLS = 'id, name, created_at, metadata_complete, created_by, equipment, primary_muscles, split, instructions'

export async function getPendingExercises(userId: string): Promise<PendingExercise[]> {
  const supabase = createSupabaseBrowserClient()
  const { data, error } = await supabase
    .from('exercises')
    .select(SELECT_COLS)
    .eq('is_custom', true)
    .or(`created_by.eq.${userId},created_by.is.null`)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return (data as unknown as DbRow[]).map(rowToPending)
}

export async function getIncompletePendingExercises(userId: string): Promise<PendingExercise[]> {
  const supabase = createSupabaseBrowserClient()
  const { data, error } = await supabase
    .from('exercises')
    .select(SELECT_COLS)
    .eq('is_custom', true)
    .or(`created_by.eq.${userId},created_by.is.null`)
    .eq('metadata_complete', false)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return (data as unknown as DbRow[]).map(rowToPending)
}

export async function savePendingExercise(userId: string, name: string): Promise<void> {
  const supabase = createSupabaseBrowserClient()
  const trimmed = name.trim()
  if (!trimmed) return
  // Case-insensitive name uniqueness: skip if already present (canonical or custom).
  const { data: existing } = await supabase
    .from('exercises')
    .select('id')
    .ilike('name', trimmed)
    .limit(1)
  if (existing && existing.length > 0) return
  await supabase.from('exercises').insert({
    name: trimmed,
    is_custom: true,
    metadata_complete: false,
    created_by: userId,
  })
}

export async function completeExerciseMetadata(
  userId: string,
  name: string,
  metadata: { equipment: Equipment; primaryMuscles: Muscle[]; split: Split | null }
): Promise<void> {
  const supabase = createSupabaseBrowserClient()
  await supabase
    .from('exercises')
    .update({
      equipment: metadata.equipment,
      primary_muscles: metadata.primaryMuscles,
      split: metadata.split,
      metadata_complete: true,
    })
    .ilike('name', name)
    .eq('is_custom', true)
    .eq('created_by', userId)
}

export interface CustomExercisePayload {
  name: string
  equipment: Equipment
  primaryMuscles: Muscle[]
  split: Split | null
  instructions: string[]
}

export class CustomExerciseNameTakenError extends Error {
  constructor(public readonly name: string) {
    super(`Exercise "${name}" already exists`)
    this.name = 'CustomExerciseNameTakenError'
  }
}

export async function createCustomExercise(
  userId: string,
  payload: CustomExercisePayload
): Promise<{ id: string; name: string }> {
  const supabase = createSupabaseBrowserClient()
  const trimmed = payload.name.trim()
  const { data: existing } = await supabase
    .from('exercises')
    .select('id, name')
    .ilike('name', trimmed)
    .limit(1)
  if (existing && existing.length > 0) {
    throw new CustomExerciseNameTakenError(existing[0].name)
  }
  const { data, error } = await supabase
    .from('exercises')
    .insert({
      name: trimmed,
      is_custom: true,
      metadata_complete: true,
      created_by: userId,
      equipment: payload.equipment,
      primary_muscles: payload.primaryMuscles,
      split: payload.split,
      instructions: payload.instructions.length > 0 ? payload.instructions : null,
    })
    .select('id, name')
    .single()
  if (error || !data) throw error ?? new Error('Failed to create custom exercise')
  return { id: data.id, name: data.name }
}

export async function updateCustomExercise(
  id: string,
  payload: CustomExercisePayload
): Promise<void> {
  const supabase = createSupabaseBrowserClient()
  const trimmed = payload.name.trim()
  // Allow rename to its own current name, but block collision with any other row.
  const { data: existing } = await supabase
    .from('exercises')
    .select('id')
    .ilike('name', trimmed)
    .neq('id', id)
    .limit(1)
  if (existing && existing.length > 0) {
    throw new CustomExerciseNameTakenError(trimmed)
  }
  const { error } = await supabase
    .from('exercises')
    .update({
      name: trimmed,
      equipment: payload.equipment,
      primary_muscles: payload.primaryMuscles,
      split: payload.split,
      metadata_complete: true,
      instructions: payload.instructions.length > 0 ? payload.instructions : null,
    })
    .eq('id', id)
  if (error) throw error
}

export class CustomExerciseInUseError extends Error {
  constructor() {
    super('Cannot delete: exercise has logged sets')
    this.name = 'CustomExerciseInUseError'
  }
}

export async function deleteCustomExercise(id: string): Promise<void> {
  const supabase = createSupabaseBrowserClient()
  const { error } = await supabase.from('exercises').delete().eq('id', id)
  // ON DELETE RESTRICT from sets.exercise_id → Postgres error 23503
  if (error) {
    if (error.code === '23503') throw new CustomExerciseInUseError()
    throw error
  }
}

// ─── One-time localStorage → Supabase migration ───────────────────────────────
// Legacy localStorage key from pre-GYM-68 builds. Idempotent: replays entries
// through the Supabase APIs, then deletes the key.

const LEGACY_BASE_KEY = 'gym_coach_custom_exercises'
const legacyKeyFor = (userId: string) => `${LEGACY_BASE_KEY}:${userId}`

interface LegacyPending {
  name: string
  addedAt?: string
  metadataComplete: boolean
  equipment?: Equipment
  primaryMuscles?: Muscle[]
  split?: Split | null
}

export async function migrateLegacyLocalStorage(userId: string): Promise<void> {
  if (typeof window === 'undefined') return
  let raw: string | null
  try {
    raw = localStorage.getItem(legacyKeyFor(userId))
  } catch {
    return
  }
  if (!raw) return
  let entries: LegacyPending[]
  try {
    entries = JSON.parse(raw) as LegacyPending[]
  } catch {
    localStorage.removeItem(legacyKeyFor(userId))
    return
  }
  const failed: LegacyPending[] = []
  for (const entry of entries) {
    try {
      if (entry.metadataComplete && entry.equipment && entry.primaryMuscles?.length) {
        await createCustomExercise(userId, {
          name: entry.name,
          equipment: entry.equipment,
          primaryMuscles: entry.primaryMuscles,
          split: entry.split ?? null,
          instructions: [],
        })
      } else {
        await savePendingExercise(userId, entry.name)
      }
    } catch (e) {
      // Name already taken means it's already in Supabase — safe to discard.
      // Any other error means the save genuinely failed; keep for retry.
      if (!(e instanceof CustomExerciseNameTakenError)) {
        failed.push(entry)
      }
    }
  }
  if (failed.length > 0) {
    // Preserve failed entries so the next app load retries them.
    try {
      localStorage.setItem(legacyKeyFor(userId), JSON.stringify(failed))
    } catch {
      localStorage.removeItem(legacyKeyFor(userId))
    }
  } else {
    localStorage.removeItem(legacyKeyFor(userId))
  }
}
