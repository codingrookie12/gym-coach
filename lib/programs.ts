// ─── Types ────────────────────────────────────────────────────────────────────

export type ProgramTier = 1 | 2 | 3

/** Training style — used for filtering and display. */
export type ProgramStyle = 'hypertrophy' | 'strength' | 'endurance' | 'powerlifting'

/** Origin of the program. */
export type ProgramSource = 'builtin' | 'curated' | 'ai-generated' | 'user-created'

export interface ProgramPresentation {
  tagline: string            // One-line hook
  overview: string           // 2-3 sentence narrative (not bullets)
  whatToExpect: string[]     // 3 concrete, outcome-focused bullets
  daysLabel: string          // "3 DAYS / WEEK"
  sessionLength: string      // "35-50 MIN"
  periodization: string      // "LINEAR LOAD" | "WAVE LOADING" | "VOLUME-BASED" | "DUAL PHASE"
  attribution: string | null // "Jim Wendler" | null
}

export interface Program {
  id: string
  name: string
  shortName: string
  splits: string[]                        // Ordered split names (drives carousel + next-split cycling)
  splitMuscles: Record<string, string[]>  // Carousel muscle labels per split
  tier: ProgramTier
  style: ProgramStyle
  level: 'beginner' | 'intermediate' | 'advanced'
  daysPerWeek: number
  source: ProgramSource
  presentation: ProgramPresentation
}

// ─── Programs ─────────────────────────────────────────────────────────────────

export const PPL_PROGRAM: Program = {
  id: 'ppl-default',
  name: 'Push Pull Legs',
  shortName: 'PPL',
  splits: ['Push', 'Pull', 'Legs'],
  splitMuscles: {
    Push: ['Chest', 'Shoulders', 'Triceps'],
    Pull: ['Back', 'Biceps', 'Rear Delts'],
    Legs: ['Quads', 'Hamstrings', 'Glutes', 'Calves'],
  },
  tier: 1,
  style: 'hypertrophy',
  level: 'intermediate',
  daysPerWeek: 3,
  source: 'builtin',
  presentation: {
    tagline: 'The balanced hypertrophy workhorse',
    overview: 'Push Pull Legs splits training by movement pattern — pushing muscles one day, pulling the next, legs last. Each session targets synergistic muscle groups, giving you high volume per muscle with full recovery between sessions. Run it 3 days a week or double up to 6 for twice-weekly frequency.',
    whatToExpect: [
      '6-8 exercises per session, 60-75 minutes',
      'Each muscle group trained 1-2× per week depending on frequency',
      'Progressive overload tracked per exercise across sessions',
    ],
    daysLabel: '3 DAYS / WEEK',
    sessionLength: '60-75 MIN',
    periodization: 'VOLUME-BASED',
    attribution: null,
  },
}

export const WENDLER_531_PROGRAM: Program = {
  id: 'wendler-531',
  name: '5/3/1',
  shortName: '531',
  splits: ['OHP Day', 'Deadlift Day', 'Bench Day', 'Squat Day'],
  splitMuscles: {
    'OHP Day':      ['Shoulders', 'Triceps', 'Upper Back'],
    'Deadlift Day': ['Hamstrings', 'Glutes', 'Lower Back', 'Core'],
    'Bench Day':    ['Chest', 'Triceps', 'Back', 'Biceps'],
    'Squat Day':    ['Quads', 'Hamstrings', 'Glutes', 'Calves'],
  },
  tier: 1,
  style: 'strength',
  level: 'intermediate',
  daysPerWeek: 4,
  source: 'curated',
  presentation: {
    tagline: 'Slow, steady strength built to last',
    overview: 'Jim Wendler\'s 5/3/1 is built around four barbell lifts — squat, bench, deadlift, and overhead press. Each session starts with one main lift following a 3-week wave at prescribed percentages, then finishes with assistance work. Progress is measured in months, not sessions.',
    whatToExpect: [
      'One main barbell lift per session with percentage-based loading',
      '3-week waves: 5s week → 3s week → 5/3/1 week → deload',
      '45-60 minutes including assistance exercises',
    ],
    daysLabel: '4 DAYS / WEEK',
    sessionLength: '45-60 MIN',
    periodization: 'WAVE LOADING',
    attribution: 'Jim Wendler',
  },
}

export const UPPER_LOWER_PROGRAM: Program = {
  id: 'upper-lower',
  name: 'Upper/Lower',
  shortName: 'U/L',
  splits: ['Upper A', 'Lower A', 'Upper B', 'Lower B'],
  splitMuscles: {
    'Upper A': ['Chest', 'Back', 'Shoulders', 'Arms'],
    'Lower A': ['Quads', 'Hamstrings', 'Glutes', 'Calves'],
    'Upper B': ['Shoulders', 'Back', 'Chest', 'Arms'],
    'Lower B': ['Hamstrings', 'Quads', 'Glutes', 'Calves'],
  },
  tier: 1,
  style: 'hypertrophy',
  level: 'intermediate',
  daysPerWeek: 4,
  source: 'curated',
  presentation: {
    tagline: 'High frequency, balanced volume',
    overview: 'Upper Lower alternates between upper and lower body sessions, hitting each muscle group twice per week. Two distinct sessions per half — A and B — provide compound variety and prevent staleness. Horizontal and vertical push/pull are balanced across the week.',
    whatToExpect: [
      'Every muscle group trained 2× per week for maximum stimulus',
      '6-7 exercises on upper days, 5 on lower — 50-65 minutes total',
      'A/B rotation keeps exercises fresh across the training week',
    ],
    daysLabel: '4 DAYS / WEEK',
    sessionLength: '50-65 MIN',
    periodization: 'DUAL PHASE',
    attribution: null,
  },
}

export const FULL_BODY_3X_PROGRAM: Program = {
  id: 'full-body-3x',
  name: 'Full Body 3x',
  shortName: 'FB3',
  splits: ['Full Body A', 'Full Body B', 'Full Body C'],
  splitMuscles: {
    'Full Body A': ['Chest', 'Back', 'Quads', 'Shoulders'],
    'Full Body B': ['Hamstrings', 'Shoulders', 'Back', 'Quads'],
    'Full Body C': ['Quads', 'Chest', 'Back', 'Hamstrings'],
  },
  tier: 1,
  style: 'strength',
  level: 'beginner',
  daysPerWeek: 3,
  source: 'curated',
  presentation: {
    tagline: 'Maximum results, minimum days',
    overview: 'Three full-body sessions per week, each covering every major movement pattern — squat, hinge, push, and pull. An A/B/C rotation keeps exercises varied while building consistent strength across the whole body. Ideal for beginners or anyone who can only commit to three gym days.',
    whatToExpect: [
      'Every major muscle group trained 3× per week',
      '5 exercises per session, compound-focused — 45-55 minutes',
      'A/B/C rotation adds variety without complexity',
    ],
    daysLabel: '3 DAYS / WEEK',
    sessionLength: '45-55 MIN',
    periodization: 'LINEAR LOAD',
    attribution: null,
  },
}

export const STRONGLIFTS_5X5_PROGRAM: Program = {
  id: 'stronglifts-5x5',
  name: 'StrongLifts 5×5',
  shortName: 'SL5×5',
  splits: ['Day A', 'Day B'],
  splitMuscles: {
    'Day A': ['Quads', 'Chest', 'Back', 'Hamstrings'],
    'Day B': ['Quads', 'Shoulders', 'Hamstrings', 'Back'],
  },
  tier: 1,
  style: 'strength',
  level: 'beginner',
  daysPerWeek: 3,
  source: 'curated',
  presentation: {
    tagline: 'Five reps, five sets, simple progress',
    overview: 'StrongLifts 5×5 alternates two workouts three times per week — both start with squats. Only 3 exercises per session, all barbell compounds. Add 5 lbs every session you complete all reps. Built for beginners who want measurable strength gains with zero complexity. By Mehdi Hadim.',
    whatToExpect: [
      '3 exercises per session in 5×5 format — 35-50 minutes',
      'Add weight every completed session — progress is automatic',
      'Squat every session — the foundation of the entire program',
    ],
    daysLabel: '3 DAYS / WEEK',
    sessionLength: '35-50 MIN',
    periodization: 'LINEAR LOAD',
    attribution: 'Mehdi Hadim',
  },
}

// ─── Library ──────────────────────────────────────────────────────────────────

export const PROGRAM_LIBRARY: Program[] = [
  PPL_PROGRAM,
  WENDLER_531_PROGRAM,
  UPPER_LOWER_PROGRAM,
  FULL_BODY_3X_PROGRAM,
  STRONGLIFTS_5X5_PROGRAM,
]

export function getProgramById(id: string): Program | undefined {
  return PROGRAM_LIBRARY.find(p => p.id === id)
}

// ─── Active program ───────────────────────────────────────────────────────────
// Phase 1: hardcoded PPL.
// Phase 2: load from user profile (Supabase users.active_program_id).

export const ACTIVE_PROGRAM: Program = PPL_PROGRAM
