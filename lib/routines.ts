export type Split = 'Push' | 'Pull' | 'Legs'

export interface Exercise {
  name: string
  notionName: string  // Exact name as stored in the Notion DB Exercise select field
  sets: number
  repRange: [number, number]
  backup: string | null
  split: Split
  weightConvention?: string
  availableWeights?: number[]
  weightUnit?: 'lbs' | 'pins'
}

// ─── Weight sequences by equipment type ───────────────────────────────────────
// Dumbbells: 5lb increments, 15–50lbs
const DB = [15, 20, 25, 30, 35, 40, 45, 50]

// Cable light stack: 5lb increments, 10–40lbs
const CABLE_LIGHT = [10, 15, 20, 25, 30, 35, 40]

// Cable heavy stack: 7.5lb increments 42.5–100, then 20lb increments 120–200
const CABLE_HEAVY = [
  42.5, 50, 57.5, 65, 72.5, 80, 87.5, 95,
  100, 120, 140, 160, 180, 200,
]

// Full cable stack (light + heavy combined, for exercises that span both)
const CABLE_FULL = [...CABLE_LIGHT, ...CABLE_HEAVY]

// Barbells (plates logged as total load, bar weight not counted):
// 5lb plate steps: 5, 10 | 25lb plate steps: 25, 30, 35, 50, 55, 60, 75, 80...
// Practical sequence based on available plates:
const BARBELL = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 110, 120, 130, 140, 150]

// Romanian Deadlift fixed bars: 10lb steps 10–100, then barbell (per side, 5lb+ plates)
const RDL = [10, 20, 30, 40, 45, 50, 60, 70, 80, 90, 100, 105, 110, 120, 130, 140, 150]

// Leg Press Pendular: 5lb increments from observed data
const LEG_PRESS = [80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140, 150, 160, 170, 180]

// Leg Extension: fixed stack — track by logged values, extend by 10lb steps
const LEG_EXT = [5, 15, 25, 35, 45, 55, 65, 75, 85, 95, 105, 115, 125]

// Standing Calf Raise: typically a plate-loaded machine — 10lb steps
const CALF_RAISE = [20, 30, 40, 50, 60, 70, 80, 90, 100, 120, 140, 160]

// Hack Squat: plate-loaded, 10lb jumps observed (55→65)
const HACK_PRESS = [25, 35, 45, 55, 65, 75, 85, 95, 105, 115, 125, 135, 145]
// ─────────────────────────────────────────────────────────────────────────────

export const PUSH_ROUTINE: Exercise[] = [
  { name: 'Wide-grip Barbell Bench Press',                  notionName: 'Wide-grip Barbell Bench Press',        sets: 3, repRange: [6, 8],   backup: 'Dumbbell Bench Press',              split: 'Push', availableWeights: BARBELL },
  { name: 'Incline Dumbbell Press',                        notionName: 'Incline Dumbbell Press',               sets: 3, repRange: [8, 10],  backup: 'Leverage Incline Chest Press',       split: 'Push', availableWeights: DB },
  { name: 'Seated Cable Fly',                              notionName: 'Seated Cable Fly',                     sets: 3, repRange: [12, 12], backup: 'Incline Dumbbell Flyes',             split: 'Push', availableWeights: CABLE_FULL },
  { name: 'Dumbbell Shoulder Press',                       notionName: 'Dumbbell Shoulder Press',              sets: 3, repRange: [8, 10],  backup: 'Leverage Shoulder Press',           split: 'Push', availableWeights: DB },
  { name: 'Side Lateral Raise',                            notionName: 'Side Lateral Raise',                   sets: 3, repRange: [12, 12], backup: null,                                split: 'Push', availableWeights: DB },
  { name: 'Face Pull',                                     notionName: 'Face Pull',                            sets: 3, repRange: [12, 15], backup: 'Reverse Machine Flyes',              split: 'Push', availableWeights: CABLE_FULL },
  { name: 'Triceps Pushdown - Rope Attachment',            notionName: 'Triceps Pushdown - Rope Attachment',   sets: 3, repRange: [10, 12], backup: 'Triceps Pushdown - V-bar Attachment', split: 'Push', availableWeights: CABLE_FULL },
  { name: 'Standing Low-Pulley One-Arm Triceps Extension', notionName: 'Standing Low-Pulley One-Arm Triceps Extension', sets: 3, repRange: [10, 12], backup: 'Standing Dumbbell Triceps Extension', split: 'Push', availableWeights: CABLE_LIGHT },
]

export const PULL_ROUTINE: Exercise[] = [
  { name: 'Wide-grip Lat Pulldown',                                     notionName: 'Wide-grip Lat Pulldown',                                sets: 3, repRange: [8, 10],  backup: 'Band Assisted Pull-up',                         split: 'Pull', availableWeights: CABLE_HEAVY },
  { name: 'Seated Cable Rows',                                          notionName: 'Seated Cable Rows',                                     sets: 3, repRange: [8, 10],  backup: 'One-arm Dumbbell Row',                          split: 'Pull', availableWeights: CABLE_HEAVY },
  { name: 'Standing Biceps Cable Curl',                                 notionName: 'Standing Biceps Cable Curl',                             sets: 3, repRange: [10, 12], backup: 'Ez-bar Curl',                                    split: 'Pull', availableWeights: CABLE_FULL },
  { name: 'Cable Curl (Low Pulley)',                                    notionName: 'Cable Curl (Low Pulley)',                                sets: 3, repRange: [12, 12], backup: 'Incline Dumbbell Curl',                          split: 'Pull', availableWeights: CABLE_LIGHT },
  { name: 'Preacher Hammer Dumbbell Curl',                              notionName: 'Preacher Hammer Dumbbell Curl',                          sets: 3, repRange: [10, 12], backup: 'Cable Hammer Curls - Rope Attachment',            split: 'Pull', availableWeights: DB },
  { name: 'Standing Palms-up Barbell Behind the Back Wrist Curl',       notionName: 'Standing Palms-up Barbell Behind the Back Wrist Curl',   sets: 3, repRange: [15, 15], backup: 'Seated Palm-up Barbell Wrist Curl',              split: 'Pull', availableWeights: BARBELL },
]

export const LEGS_ROUTINE: Exercise[] = [
  { name: 'Hack Squat',           notionName: 'Linear Hack Press',    sets: 3, repRange: [8, 10],  backup: 'Barbell Hack Squat',  split: 'Legs', availableWeights: HACK_PRESS },
  { name: 'Leg Press',            notionName: 'Leg Press',            sets: 3, repRange: [10, 12], backup: 'Hack Squat',          split: 'Legs', availableWeights: LEG_PRESS, weightConvention: 'per side' },
  { name: 'Leg Extensions',       notionName: 'Leg Extensions',       sets: 3, repRange: [12, 12], backup: 'Single-leg Leg Extension', split: 'Legs', availableWeights: LEG_EXT },
  { name: 'Seated Leg Curl',      notionName: 'Seated Leg Curl',      sets: 3, repRange: [10, 12], backup: 'Lying Leg Curls',     split: 'Legs', availableWeights: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20], weightUnit: 'pins' },
  { name: 'Romanian Deadlift',    notionName: 'Romanian Deadlift',    sets: 3, repRange: [10, 12], backup: 'Stiff-legged Barbell Deadlift', split: 'Legs', availableWeights: RDL },
  { name: 'Standing Calf Raises', notionName: 'Standing Calf Raises', sets: 3, repRange: [15, 20], backup: 'Seated Calf Raise',   split: 'Legs', availableWeights: CALF_RAISE },
]

export function getRoutine(split: Split): Exercise[] {
  switch (split) {
    case 'Push': return PUSH_ROUTINE
    case 'Pull': return PULL_ROUTINE
    case 'Legs': return LEGS_ROUTINE
  }
}

export function getAllExercises(): Exercise[] {
  return [...PUSH_ROUTINE, ...PULL_ROUTINE, ...LEGS_ROUTINE]
}

export const CARDIO_RECOMMENDATION: Record<Split, string> = {
  Push: 'Stairmaster or Incline Walk',
  Pull: 'Incline Walk',
  Legs: 'Elliptical',
}
