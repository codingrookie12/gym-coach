// Simple in-memory session state (no localStorage — all in-session)
import { Split } from './routines'
import { CoachingContext, ExercisePlan } from './coaching'
import { SessionRecord } from './notion'

export interface SetLog {
  weight: number
  reps: number
  completed: boolean
  skipped?: boolean
}

export interface ExerciseLog {
  exerciseName: string
  notionName: string  // Exact name used in Notion DB Exercise select field
  backupName: string
  sets: SetLog[]
  notes?: string
}

// Keyed by `notionName:setNumber` (1-indexed), e.g. "Bench press:1"
export type SavedSnapshot = Record<string, {
  pageId: string
  weight: number
  reps: number
  notes: string
}>

export interface SessionState {
  split: Split | null
  coachingContext: CoachingContext | null
  plan: ExercisePlan[] | null
  sessions: SessionRecord[] | null
  exerciseLogs: ExerciseLog[]
  currentExerciseIndex: number
  startedAt: string | null
}

// Global session state (module-level, survives navigation within SPA)
let _state: SessionState = {
  split: null,
  coachingContext: null,
  plan: null,
  sessions: null,
  exerciseLogs: [],
  currentExerciseIndex: 0,
  startedAt: null,
}

export function getState(): SessionState {
  return _state
}

export function setState(partial: Partial<SessionState>): void {
  _state = { ..._state, ...partial }
}

export function resetSession(): void {
  _state = {
    split: null,
    coachingContext: null,
    plan: null,
    sessions: null,
    exerciseLogs: [],
    currentExerciseIndex: 0,
    startedAt: null,
  }
}
