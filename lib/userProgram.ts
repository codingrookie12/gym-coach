// GYM-79: User-owned programs — single source of truth for ALL programs.
//
// In the delete-first architecture, every program in the running app is a
// `user_programs` row. There is no runtime distinction between "curated" and
// "custom" — both live in the same tables. Curated programs (PPL, 5/3/1, etc.)
// originate as code-level templates (lib/programTemplates.ts) that get cloned
// into the user's account at selection time.
//
// This module provides the CRUD surface for user_programs +
// user_program_splits + user_routine_exercises, plus the async resolver that
// shapes a stored program back into the runtime `Program` type the UI uses.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Program, ProgramPresentation, ProgramStyle } from './programs'
import type { Exercise } from './routines'
import type { ProgramTemplate, TemplateExercise } from './programTemplates'
import { getTemplateById } from './programTemplates'
import { getAvailableWeightsForEquipment } from './routines'
import { findExerciseByName } from './exerciseLibrary'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserProgramSummary {
  id: string
  name: string
  sourceTemplateId: string | null
  style: ProgramStyle | null
  level: 'beginner' | 'intermediate' | 'advanced' | null
  splitCount: number
  exerciseCount: number
  createdAt: string
  updatedAt: string
}

export interface UserProgramSplit {
  id: string
  name: string
  sortOrder: number
  archivedAt: string | null
  exercises: UserRoutineExercise[]
}

export interface UserRoutineExercise {
  id: string
  exerciseName: string
  canonicalName: string
  sets: number
  repRangeMin: number
  repRangeMax: number
  backupName: string | null
  weightUnit: 'lbs' | 'pins'
  weightConvention: string | null
  equipment: string | null
  programNote: string | null
  sortOrder: number
}

export interface HydratedUserProgram {
  id: string
  userId: string
  name: string
  sourceTemplateId: string | null
  splits: UserProgramSplit[]    // Ordered, INCLUDES archived splits (callers filter as needed)
  createdAt: string
  updatedAt: string
}

// ─── List & fetch ─────────────────────────────────────────────────────────────

export async function listUserPrograms(
  supabase: SupabaseClient,
  userId: string
): Promise<UserProgramSummary[]> {
  const { data: programs, error } = await supabase
    .from('user_programs')
    .select('id, name, source_template_id, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (error) throw error
  if (!programs?.length) return []

  const programIds = programs.map(p => p.id as string)

  // Fetch all splits for these programs (with id → program_id mapping for
  // exercise count rollup) in parallel with exercise list.
  const [splitsRes, exercisesRes] = await Promise.all([
    supabase.from('user_program_splits').select('id, user_program_id').in('user_program_id', programIds),
    supabase
      .from('user_routine_exercises')
      .select('user_program_split_id')
      .not('user_program_split_id', 'is', null),
  ])
  if (splitsRes.error) throw splitsRes.error
  if (exercisesRes.error) throw exercisesRes.error

  const splitIdToProgramId = new Map<string, string>()
  const splitCountByProgram = new Map<string, number>()
  for (const s of splitsRes.data ?? []) {
    splitIdToProgramId.set(s.id as string, s.user_program_id as string)
    splitCountByProgram.set(
      s.user_program_id as string,
      (splitCountByProgram.get(s.user_program_id as string) ?? 0) + 1,
    )
  }
  const exerciseCountByProgram = new Map<string, number>()
  for (const e of exercisesRes.data ?? []) {
    const pid = splitIdToProgramId.get(e.user_program_split_id as string)
    if (!pid) continue
    exerciseCountByProgram.set(pid, (exerciseCountByProgram.get(pid) ?? 0) + 1)
  }

  return programs.map(p => {
    const templateId = (p.source_template_id as string | null) ?? null
    const template = templateId ? getTemplateById(templateId) : undefined
    return {
      id: p.id as string,
      name: p.name as string,
      sourceTemplateId: templateId,
      style: template?.style ?? null,
      level: template?.level ?? null,
      splitCount: splitCountByProgram.get(p.id as string) ?? 0,
      exerciseCount: exerciseCountByProgram.get(p.id as string) ?? 0,
      createdAt: p.created_at as string,
      updatedAt: p.updated_at as string,
    }
  })
}

export async function getUserProgram(
  supabase: SupabaseClient,
  programId: string
): Promise<HydratedUserProgram | null> {
  const { data: program, error: progErr } = await supabase
    .from('user_programs')
    .select('id, user_id, name, source_template_id, created_at, updated_at')
    .eq('id', programId)
    .maybeSingle()
  if (progErr) throw progErr
  if (!program) return null

  const { data: splits, error: splitErr } = await supabase
    .from('user_program_splits')
    .select('id, name, sort_order, archived_at')
    .eq('user_program_id', programId)
    .order('sort_order', { ascending: true })
  if (splitErr) throw splitErr

  const splitIds = (splits ?? []).map(s => s.id as string)
  let exercises: any[] = []
  if (splitIds.length) {
    const { data: exRows, error: exErr } = await supabase
      .from('user_routine_exercises')
      .select('id, user_program_split_id, exercise_name, canonical_name, sets, rep_range_min, rep_range_max, backup_name, weight_unit, weight_convention, equipment, program_note, sort_order')
      .in('user_program_split_id', splitIds)
      .order('sort_order', { ascending: true })
    if (exErr) throw exErr
    exercises = exRows ?? []
  }

  const exercisesBySplit = new Map<string, UserRoutineExercise[]>()
  for (const ex of exercises) {
    const arr = exercisesBySplit.get(ex.user_program_split_id as string) ?? []
    arr.push({
      id: ex.id as string,
      exerciseName: ex.exercise_name as string,
      canonicalName: ex.canonical_name as string,
      sets: ex.sets as number,
      repRangeMin: ex.rep_range_min as number,
      repRangeMax: ex.rep_range_max as number,
      backupName: (ex.backup_name as string | null) ?? null,
      weightUnit: ex.weight_unit as 'lbs' | 'pins',
      weightConvention: (ex.weight_convention as string | null) ?? null,
      equipment: (ex.equipment as string | null) ?? null,
      programNote: (ex.program_note as string | null) ?? null,
      sortOrder: ex.sort_order as number,
    })
    exercisesBySplit.set(ex.user_program_split_id as string, arr)
  }

  return {
    id: program.id as string,
    userId: program.user_id as string,
    name: program.name as string,
    sourceTemplateId: (program.source_template_id as string | null) ?? null,
    splits: (splits ?? []).map(s => ({
      id: s.id as string,
      name: s.name as string,
      sortOrder: s.sort_order as number,
      archivedAt: (s.archived_at as string | null) ?? null,
      exercises: exercisesBySplit.get(s.id as string) ?? [],
    })),
    createdAt: program.created_at as string,
    updatedAt: program.updated_at as string,
  }
}

// ─── Async resolver — shapes a hydrated program into the runtime `Program` ───

/**
 * Single canonical program resolver. All UI/coaching code that needs a
 * runtime Program must use this.
 *
 * The shape mirrors lib/programs.ts::Program so existing UI code continues to
 * work — we just source the data from Supabase instead of static constants.
 */
export async function getProgramByIdAsync(
  supabase: SupabaseClient,
  programId: string
): Promise<Program | null> {
  const hydrated = await getUserProgram(supabase, programId)
  if (!hydrated) return null

  const activeSplits = hydrated.splits.filter(s => s.archivedAt == null)
  const splitMuscles: Record<string, string[]> = {}
  for (const split of activeSplits) {
    splitMuscles[split.name] = inferSplitMuscles(split.exercises.map(e => e.canonicalName))
  }

  // If the program was cloned from a curated template, preserve that template's
  // presentation metadata (tagline, overview, etc.). Fully-custom programs get
  // a placeholder presentation — UI can render a minimal card.
  const template = hydrated.sourceTemplateId ? getTemplateById(hydrated.sourceTemplateId) : undefined
  const presentation: ProgramPresentation = template?.presentation ?? CUSTOM_PRESENTATION

  return {
    id: hydrated.id,
    name: hydrated.name,
    shortName: template?.shortName ?? hydrated.name.slice(0, 8).toUpperCase(),
    splits: activeSplits.map(s => s.name),
    splitMuscles,
    tier: template?.tier ?? 1,
    style: template?.style ?? 'hypertrophy',
    level: template?.level ?? 'intermediate',
    daysPerWeek: template?.daysPerWeek ?? activeSplits.length,
    source: hydrated.sourceTemplateId ? 'curated' : 'user-created',
    presentation,
  }
}

const CUSTOM_PRESENTATION: ProgramPresentation = {
  tagline: 'Your custom program',
  overview: 'A program you built yourself.',
  whatToExpect: [],
  daysLabel: '',
  sessionLength: '',
  periodization: '',
  attribution: null,
}

// ─── Clone (curated template → user account) ──────────────────────────────────

export async function cloneTemplate(
  supabase: SupabaseClient,
  userId: string,
  templateId: string,
  opts: { nameOverride?: string } = {}
): Promise<string> {
  const template = getTemplateById(templateId)
  if (!template) throw new Error(`Unknown template: ${templateId}`)

  const name = opts.nameOverride ?? template.name

  const { data: program, error: progErr } = await supabase
    .from('user_programs')
    .insert({ user_id: userId, name, source_template_id: template.id })
    .select('id')
    .single()
  if (progErr) throw progErr
  const programId = program.id as string

  const splitInserts = template.splits.map((split, i) => ({
    user_program_id: programId,
    name: split.name,
    sort_order: i,
  }))
  const { data: splitRows, error: splitErr } = await supabase
    .from('user_program_splits')
    .insert(splitInserts)
    .select('id, name')
  if (splitErr) throw splitErr

  const splitIdByName = new Map<string, string>()
  for (const s of splitRows ?? []) splitIdByName.set(s.name as string, s.id as string)

  const exerciseRows: any[] = []
  for (const split of template.splits) {
    const splitId = splitIdByName.get(split.name)
    if (!splitId) continue
    split.exercises.forEach((ex, i) => {
      exerciseRows.push({
        user_id: userId,
        user_program_split_id: splitId,
        exercise_name: ex.name,
        canonical_name: ex.canonicalName,
        sets: ex.sets,
        rep_range_min: ex.repRange[0],
        rep_range_max: ex.repRange[1],
        backup_name: ex.backup ?? null,
        weight_unit: ex.weightUnit ?? 'lbs',
        weight_convention: ex.weightConvention ?? null,
        equipment: equipmentFromExercise(ex),
        program_note: ex.programNote ?? null,
        sort_order: i,
        added_via: 'template-clone',
      })
    })
  }

  if (exerciseRows.length) {
    const { error: exErr } = await supabase.from('user_routine_exercises').insert(exerciseRows)
    if (exErr) throw exErr
  }

  return programId
}

function equipmentFromExercise(ex: TemplateExercise): string | null {
  const def = findExerciseByName(ex.canonicalName)
  return def?.equipment ?? null
}

// ─── Create blank custom program ─────────────────────────────────────────────

export interface CreateBlankProgramInput {
  name: string
  splits: Array<{
    name: string
    exercises: Array<{
      name: string
      sets: number
      repRange: [number, number]
    }>
  }>
}

export async function createBlankProgram(
  supabase: SupabaseClient,
  userId: string,
  input: CreateBlankProgramInput
): Promise<string> {
  if (input.name.trim().length < 3) throw new Error('Program name must be at least 3 characters')
  if (!input.splits.length) throw new Error('Program must have at least one split')
  if (input.splits.length > 7) throw new Error('Program cannot have more than 7 splits')

  const { data: program, error: progErr } = await supabase
    .from('user_programs')
    .insert({ user_id: userId, name: input.name.trim(), source_template_id: null })
    .select('id')
    .single()
  if (progErr) throw progErr
  const programId = program.id as string

  const splitInserts = input.splits.map((split, i) => ({
    user_program_id: programId,
    name: split.name,
    sort_order: i,
  }))
  const { data: splitRows, error: splitErr } = await supabase
    .from('user_program_splits')
    .insert(splitInserts)
    .select('id, name, sort_order')
  if (splitErr) throw splitErr

  const splitIdByOrder = new Map<number, string>()
  for (const s of splitRows ?? []) splitIdByOrder.set(s.sort_order as number, s.id as string)

  const exerciseRows: any[] = []
  input.splits.forEach((split, splitIdx) => {
    const splitId = splitIdByOrder.get(splitIdx)
    if (!splitId) return
    split.exercises.forEach((ex, i) => {
      const def = findExerciseByName(ex.name)
      exerciseRows.push({
        user_id: userId,
        user_program_split_id: splitId,
        exercise_name: ex.name,
        canonical_name: ex.name,
        sets: ex.sets,
        rep_range_min: ex.repRange[0],
        rep_range_max: ex.repRange[1],
        backup_name: null,
        weight_unit: 'lbs',
        weight_convention: null,
        equipment: def?.equipment ?? null,
        program_note: null,
        sort_order: i,
        added_via: 'custom-program-create',
      })
    })
  })

  if (exerciseRows.length) {
    const { error: exErr } = await supabase.from('user_routine_exercises').insert(exerciseRows)
    if (exErr) throw exErr
  }

  return programId
}

// ─── Mutate ───────────────────────────────────────────────────────────────────

export async function renameUserProgram(
  supabase: SupabaseClient,
  programId: string,
  name: string
): Promise<void> {
  if (name.trim().length < 3) throw new Error('Program name must be at least 3 characters')
  const { error } = await supabase.from('user_programs').update({ name: name.trim() }).eq('id', programId)
  if (error) throw error
}

export async function addSplit(
  supabase: SupabaseClient,
  programId: string,
  name: string
): Promise<string> {
  // Append at the end — find current max sort_order
  const { data: existing } = await supabase
    .from('user_program_splits')
    .select('sort_order')
    .eq('user_program_id', programId)
    .order('sort_order', { ascending: false })
    .limit(1)
  const nextOrder = ((existing?.[0]?.sort_order as number) ?? -1) + 1
  const { data, error } = await supabase
    .from('user_program_splits')
    .insert({ user_program_id: programId, name, sort_order: nextOrder })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function renameSplit(
  supabase: SupabaseClient,
  splitId: string,
  name: string
): Promise<void> {
  const { error } = await supabase.from('user_program_splits').update({ name }).eq('id', splitId)
  if (error) throw error
}

export async function reorderSplits(
  supabase: SupabaseClient,
  orderedSplitIds: string[]
): Promise<void> {
  // Two-phase update to avoid violating UNIQUE (user_program_id, sort_order):
  // Phase 1: bump every sort_order by 1000 to clear the original space.
  // Phase 2: write the final sort_order for each id.
  for (let i = 0; i < orderedSplitIds.length; i++) {
    const { error } = await supabase
      .from('user_program_splits')
      .update({ sort_order: 1000 + i })
      .eq('id', orderedSplitIds[i])
    if (error) throw error
  }
  for (let i = 0; i < orderedSplitIds.length; i++) {
    const { error } = await supabase
      .from('user_program_splits')
      .update({ sort_order: i })
      .eq('id', orderedSplitIds[i])
    if (error) throw error
  }
}

/** Soft-archive a split. Used when the split has logged workouts. */
export async function archiveSplit(supabase: SupabaseClient, splitId: string): Promise<void> {
  const { error } = await supabase
    .from('user_program_splits')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', splitId)
  if (error) throw error
}

/**
 * Removes a split. Cascades to user_routine_exercises (CASCADE FK).
 * Workouts have ON DELETE RESTRICT, so this throws if any workouts exist
 * — caller should detect and call archiveSplit instead.
 */
export async function deleteSplit(supabase: SupabaseClient, splitId: string): Promise<void> {
  const { error } = await supabase.from('user_program_splits').delete().eq('id', splitId)
  if (error) throw error
}

/** True if at least one workout references this split — caller must archive instead. */
export async function splitHasWorkoutHistory(
  supabase: SupabaseClient,
  splitId: string
): Promise<boolean> {
  const { count } = await supabase
    .from('workouts')
    .select('id', { count: 'exact', head: true })
    .eq('user_program_split_id', splitId)
  return (count ?? 0) > 0
}

// ─── Delete program ──────────────────────────────────────────────────────────

/**
 * Atomic delete: if this program is the user's active program, the FK's
 * ON DELETE SET NULL clears `users.active_user_program_id` automatically.
 * Splits and routine_exercises cascade via CASCADE FK.
 *
 * Will throw if any of this program's splits have workout history (workouts
 * have ON DELETE RESTRICT on user_program_split_id).
 */
export async function deleteUserProgram(
  supabase: SupabaseClient,
  programId: string
): Promise<void> {
  const { error } = await supabase.from('user_programs').delete().eq('id', programId)
  if (error) throw error
}

// ─── Active program ──────────────────────────────────────────────────────────

export async function setActiveUserProgram(
  supabase: SupabaseClient,
  userId: string,
  programId: string | null
): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ active_user_program_id: programId })
    .eq('id', userId)
  if (error) throw error
}

// ─── Coaching engine bridge ──────────────────────────────────────────────────

/**
 * Returns the user's exercises for a given split, shaped as the runtime
 * `Exercise` objects the coaching engine expects.
 */
export async function getRoutineAsExercises(
  supabase: SupabaseClient,
  splitId: string
): Promise<Exercise[]> {
  // Fetch the split (for the name + program lookup) and exercises in parallel.
  const [splitRes, exRes] = await Promise.all([
    supabase.from('user_program_splits').select('name').eq('id', splitId).maybeSingle(),
    supabase
      .from('user_routine_exercises')
      .select('exercise_name, canonical_name, sets, rep_range_min, rep_range_max, backup_name, weight_unit, weight_convention, equipment, program_note')
      .eq('user_program_split_id', splitId)
      .order('sort_order', { ascending: true }),
  ])
  if (splitRes.error) throw splitRes.error
  if (exRes.error) throw exRes.error
  const splitName = (splitRes.data?.name as string | undefined) ?? ''

  return (exRes.data ?? []).map(row => ({
    name: row.exercise_name as string,
    canonicalName: row.canonical_name as string,
    sets: row.sets as number,
    repRange: [row.rep_range_min as number, row.rep_range_max as number] as [number, number],
    backup: (row.backup_name as string | null) ?? null,
    split: splitName,
    weightUnit: (row.weight_unit as 'lbs' | 'pins'),
    weightConvention: (row.weight_convention as string | null) ?? undefined,
    programNote: (row.program_note as string | null) ?? undefined,
    availableWeights: row.equipment ? getAvailableWeightsForEquipment(row.equipment as string) : [],
  }))
}

// ─── Cycling helpers ─────────────────────────────────────────────────────────

/**
 * Returns the next non-archived split in the cycle, given the last split id.
 * Returns null if no active splits exist (caller should send the user back to
 * the program library / builder).
 */
export function getNextSplit(
  splits: UserProgramSplit[],
  lastSplitId: string | null
): UserProgramSplit | null {
  const active = splits.filter(s => s.archivedAt == null).sort((a, b) => a.sortOrder - b.sortOrder)
  if (!active.length) return null
  if (!lastSplitId) return active[0]
  const idx = active.findIndex(s => s.id === lastSplitId)
  if (idx === -1) return active[0]
  return active[(idx + 1) % active.length]
}

// ─── Muscle inference ────────────────────────────────────────────────────────

/**
 * Infers split muscle labels for the carousel. Top 3 primary_muscles by
 * frequency across the split's exercises. Returns empty array if no
 * exercises or no resolvable muscles.
 */
export function inferSplitMuscles(exerciseNames: string[]): string[] {
  const counts = new Map<string, number>()
  for (const name of exerciseNames) {
    const def = findExerciseByName(name)
    if (!def) continue
    for (const muscle of def.primaryMuscles) {
      counts.set(muscle, (counts.get(muscle) ?? 0) + 1)
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([m]) => titleCase(m))
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, c => c.toUpperCase())
}
