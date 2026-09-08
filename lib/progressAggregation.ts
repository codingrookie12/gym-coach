/**
 * lib/progressAggregation.ts
 *
 * Pure aggregation logic for ProgressHistoryScreen (Reports tab), extracted
 * out of the component so it's unit-testable without React/Supabase.
 *
 * GYM-92 fix (Phase 4 scope item 1): muscle-group resolution used to be
 * name-only — `EXERCISE_BY_NAME` built from the client-bundled static
 * catalog (lib/exerciseLibrary.ts's ALL_EXERCISES). A set logged against a
 * custom exercise (created via lib/customExercises.ts, living only in the
 * Supabase `exercises` table, never in the static bundle) silently resolved
 * to `group: null` and vanished from every muscle-balance aggregation.
 *
 * The real fix: `exercises.id` (the DB row, uuid) always carries
 * primary_muscles/secondary_muscles/split — for BOTH catalog-seeded rows and
 * user-created custom rows — so resolving by exercise_id against a DB query
 * (see lib/supabase.queries.ts's `fetchExerciseMuscleMetaByIds`) is uniform
 * and correct regardless of origin. NOTE: `ALL_EXERCISES[].id` (the static
 * bundle's own id space) is NOT the same id space as the DB's
 * `sets.exercise_id` (see lib/sessionPlan.ts's docstring on this exact
 * gotcha) — so the static catalog is used here only as a last-resort
 * name-based fallback (pre-existing behavior, kept for defensiveness when
 * `exerciseId` is missing), never as the primary ID-based path.
 */

import { ALL_EXERCISES } from '@/lib/exerciseLibrary'
import type { ExerciseDefinition } from '@/lib/exerciseLibrary'
import { MUSCLE_GROUPS, TARGET_SETS, muscleToGroup, type MuscleGroup } from '@/lib/muscleGroups'
import type { HistoryProgress, ExerciseMuscleMeta } from '@/lib/supabase.queries'

// ─── Helpers ───────────────────────────────────────────────────────────────────

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// Name-based fallback only — see module docstring. Never the primary path.
export const EXERCISE_BY_NAME: Map<string, ExerciseDefinition> = new Map(
  ALL_EXERCISES.map(e => [e.name, e])
)

export interface ResolvedExerciseMeta {
  group: MuscleGroup | null
  split: string | null
}

/**
 * Resolves an exercise's muscle-group + split, preferring the real DB
 * exercise_id lookup (works for catalog and custom exercises alike) and
 * falling back to a name lookup against the static catalog only when no
 * exercise_id is available at all (should be rare/legacy data).
 */
export function resolveExerciseMeta(
  ex: { exerciseId: string | null; name: string },
  metaByExerciseId: Map<string, ExerciseMuscleMeta>
): ResolvedExerciseMeta {
  const dbMeta = ex.exerciseId ? metaByExerciseId.get(ex.exerciseId) : undefined
  if (dbMeta) {
    const primary = dbMeta.primaryMuscles[0]
    return {
      group: primary ? muscleToGroup(primary as any) ?? null : null,
      split: dbMeta.split,
    }
  }
  const catalogDef = EXERCISE_BY_NAME.get(ex.name)
  if (catalogDef?.primaryMuscles[0]) {
    return { group: muscleToGroup(catalogDef.primaryMuscles[0]) ?? null, split: catalogDef.split }
  }
  return { group: null, split: null }
}

// ─── Aggregations ──────────────────────────────────────────────────────────────

export interface ExerciseAggregate {
  exerciseId: string | null
  name: string
  group: MuscleGroup | null
  split: string | null
  sessions: { date: string; topWeight: number; topReps: number; sets: number; unit: string }[]
  pr: number // top weight ever
  lastTrained: string // ISO
  deltaLbs: number // weight change vs the session ~30 days earlier
}

export function aggregateExercises(
  progress: HistoryProgress,
  metaByExerciseId: Map<string, ExerciseMuscleMeta> = new Map()
): ExerciseAggregate[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const thirtyDaysAgo = isoDay(new Date(today.getTime() - 30 * 86400000))

  const out: ExerciseAggregate[] = []
  for (const ex of progress.exercises) {
    const { group, split } = resolveExerciseMeta(ex, metaByExerciseId)

    // group sets by date → top weight that day
    const byDate = new Map<string, { topWeight: number; topReps: number; sets: number; unit: string }>()
    for (const s of ex.sets) {
      const cur = byDate.get(s.date)
      if (!cur || s.weight > cur.topWeight) {
        byDate.set(s.date, {
          topWeight: s.weight,
          topReps: cur && cur.topWeight === s.weight && cur.topReps > s.reps ? cur.topReps : s.reps,
          sets: (cur?.sets ?? 0) + 1,
          unit: s.unit,
        })
      } else {
        cur.sets += 1
      }
    }
    const sessions = Array.from(byDate.entries())
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => (a.date < b.date ? -1 : 1))

    if (!sessions.length) continue

    const pr = Math.max(...sessions.map(s => s.topWeight))
    const lastTrained = sessions[sessions.length - 1].date
    const latest = sessions[sessions.length - 1].topWeight
    const baseline = sessions.find(s => s.date >= thirtyDaysAgo)?.topWeight ?? sessions[0].topWeight
    const deltaLbs = latest - baseline

    out.push({ exerciseId: ex.exerciseId, name: ex.name, group, split, sessions, pr, lastTrained, deltaLbs })
  }

  // Most recent first
  return out.sort((a, b) => (a.lastTrained < b.lastTrained ? 1 : -1))
}

export interface GroupAggregate {
  group: MuscleGroup
  sessionCount: number // unique workout days that hit this muscle in the last 30 days
  setsThisWeek: number
  best: { exerciseName: string; deltaLbs: number } | null // strongest positive delta among exercises in this group
}

export function aggregateGroups(byExercise: ExerciseAggregate[]): GroupAggregate[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const thirtyDaysAgo = isoDay(new Date(today.getTime() - 30 * 86400000))
  const sevenDaysAgo = isoDay(new Date(today.getTime() - 6 * 86400000))

  return MUSCLE_GROUPS.map(group => {
    const exercisesInGroup = byExercise.filter(e => e.group === group)
    const datesHit = new Set<string>()
    let setsThisWeek = 0
    let best: GroupAggregate['best'] = null

    for (const ex of exercisesInGroup) {
      for (const s of ex.sessions) {
        if (s.date >= thirtyDaysAgo) datesHit.add(s.date)
        if (s.date >= sevenDaysAgo) setsThisWeek += s.sets
      }
      if (ex.deltaLbs > 0 && (!best || ex.deltaLbs > best.deltaLbs)) {
        best = { exerciseName: ex.name, deltaLbs: ex.deltaLbs }
      }
    }
    return { group, sessionCount: datesHit.size, setsThisWeek, best }
  })
}

// Derive a workout's split label from the exercises trained that day.
export type SplitColor = 'push' | 'pull' | 'legs' | 'mixed' | 'rest'

export function splitForDay(date: string, exercises: ExerciseAggregate[]): SplitColor {
  const exHit = exercises.filter(e => e.sessions.some(s => s.date === date))
  if (!exHit.length) return 'rest'
  const counts: Record<string, number> = {}
  for (const e of exHit) {
    const s = e.split
    if (s) counts[s] = (counts[s] ?? 0) + 1
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  if (!top) return 'mixed'
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  if (top[1] / total >= 0.6) {
    const lower = top[0].toLowerCase()
    if (lower === 'push' || lower === 'pull' || lower === 'legs') return lower
    return 'mixed'
  }
  return 'mixed'
}

export interface WeeklyVolumePoint {
  label: string
  volume: number
}

/**
 * Total tonnage (weight × reps, summed across every exercise) per calendar
 * week, most recent `weeksCount` weeks (Sunday-anchored, matching
 * FrequencyHeatmap's week alignment). Feeds components/charts/WeeklyVolumeBar
 * — there's no pre-existing aggregator for this exact {label, volume}[]
 * grouping (unlike the daily {date, count}[] shape HistoryProgress.days
 * already provides for FrequencyHeatmap).
 */
export function aggregateWeeklyVolume(progress: HistoryProgress, weeksCount: number = 10): WeeklyVolumePoint[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const currentWeekStart = new Date(today)
  currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay())

  const weekStarts: Date[] = []
  for (let i = weeksCount - 1; i >= 0; i--) {
    const d = new Date(currentWeekStart)
    d.setDate(d.getDate() - i * 7)
    weekStarts.push(d)
  }

  const volumeByWeekIndex = new Array(weeksCount).fill(0)

  for (const ex of progress.exercises) {
    for (const s of ex.sets) {
      const [y, m, d] = s.date.split('-').map(n => parseInt(n, 10))
      const setDate = new Date(y, m - 1, d)
      for (let i = 0; i < weekStarts.length; i++) {
        const start = weekStarts[i]
        const end = new Date(start)
        end.setDate(end.getDate() + 7)
        if (setDate >= start && setDate < end) {
          volumeByWeekIndex[i] += s.weight * s.reps
          break
        }
      }
    }
  }

  return weekStarts.map((d, i) => ({
    label: `${d.getMonth() + 1}/${d.getDate()}`,
    volume: Math.round(volumeByWeekIndex[i]),
  }))
}

export { TARGET_SETS, MUSCLE_GROUPS }
export type { MuscleGroup }
