export type Split = 'Push' | 'Pull' | 'Legs'

export interface Exercise {
  name: string
  notionName: string  // Exact name as stored in the Notion DB Exercise select field
  sets: number
  repRange: [number, number]
  backup: string
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

// Linear Hack Press: barbell with plates, 10lb jumps observed (55→65)
const HACK_PRESS = [25, 35, 45, 55, 65, 75, 85, 95, 105, 115, 125, 135, 145]
// ─────────────────────────────────────────────────────────────────────────────

export const PUSH_ROUTINE: Exercise[] = [
  { name: 'Bench Press',                              notionName: 'Bench press',           sets: 3, repRange: [6, 8],   backup: 'Dumbbell Chest Press',             split: 'Push', availableWeights: BARBELL },
  { name: 'Incline Dumbbell Press',                   notionName: 'Dumbbell incline press', sets: 3, repRange: [8, 10],  backup: 'Machine Chest Press Incline',       split: 'Push', availableWeights: DB },
  { name: 'Seated Cable Fly',                         notionName: 'Chest fly',              sets: 3, repRange: [12, 12], backup: 'Dumbbell Incline Flies',             split: 'Push', availableWeights: CABLE_FULL },
  { name: 'Shoulder Press',                           notionName: 'Shoulder press',         sets: 3, repRange: [8, 10],  backup: 'Machine Shoulder Press',            split: 'Push', availableWeights: DB },
  { name: 'Lateral Raise',                            notionName: 'Lateral Raise',          sets: 3, repRange: [12, 12], backup: 'Cable Lateral Raise Single Arm',     split: 'Push', availableWeights: DB },
  { name: 'Facepull',                                 notionName: 'Facepull',               sets: 3, repRange: [12, 15], backup: 'Rear Delt Fly Machine',              split: 'Push', availableWeights: CABLE_FULL },
  { name: 'Tricep Pushdown (rope)',                   notionName: 'Tricep vertical rope',   sets: 3, repRange: [10, 12], backup: 'Tricep Pushdown Bar',                split: 'Push', availableWeights: CABLE_FULL },
  { name: 'Single-Arm Overhead Tricep Extension (cable)', notionName: 'Tricep iso behind head', sets: 3, repRange: [10, 12], backup: 'Dumbbell Overhead Tricep Extension', split: 'Push', availableWeights: CABLE_LIGHT },
]

export const PULL_ROUTINE: Exercise[] = [
  { name: 'Cable Pulldown (bar)',                     notionName: 'Pulldown bar cable',              sets: 3, repRange: [8, 10],  backup: 'Assisted Pull-Up',          split: 'Pull', availableWeights: CABLE_HEAVY },
  { name: 'Cable Row (wide grip)',                    notionName: 'Row cable wide grip',             sets: 3, repRange: [8, 10],  backup: 'Dumbbell Single-Arm Row',   split: 'Pull', availableWeights: CABLE_HEAVY },
  { name: 'Cable Curl (EZ bar)',                      notionName: 'Cable Curl (EZ bar)',             sets: 3, repRange: [10, 12], backup: 'EZ Bar Curl',                split: 'Pull', availableWeights: CABLE_FULL },
  { name: 'Rope Iso Curl From Below (single arm)',    notionName: 'Rope iso curl from below',        sets: 3, repRange: [12, 12], backup: 'Incline Dumbbell Curl',      split: 'Pull', availableWeights: CABLE_LIGHT },
  { name: 'Single-Arm Preacher Hammer Curl',          notionName: 'Single-Arm Preacher Hammer Curl', sets: 3, repRange: [10, 12], backup: 'Cable Hammer Curl',          split: 'Pull', availableWeights: DB },
  { name: 'Forearm Behind Back',                      notionName: 'Forearm behind back',             sets: 3, repRange: [15, 15], backup: 'Wrist Curl',                 split: 'Pull', availableWeights: CABLE_FULL },
]

export const LEGS_ROUTINE: Exercise[] = [
  { name: 'Linear Hack Press or Squat', notionName: 'Linear Hack Press or Squat', sets: 3, repRange: [8, 10],  backup: 'Standing Hack Squat Machine', split: 'Legs', availableWeights: HACK_PRESS },
  { name: 'Leg Press Pendular',         notionName: 'Leg press pendular',         sets: 3, repRange: [10, 12], backup: 'Linear Hack Press',           split: 'Legs', availableWeights: LEG_PRESS, weightConvention: 'per side' },
  { name: 'Leg Extension',              notionName: 'Leg extension',              sets: 3, repRange: [12, 12], backup: 'Single-Leg Extension',         split: 'Legs', availableWeights: LEG_EXT },
  { name: 'Seated Leg Curl',            notionName: 'Seated Leg Curl',            sets: 3, repRange: [10, 12], backup: 'Prone Leg Curl',               split: 'Legs', availableWeights: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20], weightUnit: 'pins' },
  { name: 'Romanian Deadlift',          notionName: 'Romanian deadlift',          sets: 3, repRange: [10, 12], backup: 'Good Morning',                 split: 'Legs', availableWeights: RDL },
  { name: 'Standing Calf Raise',        notionName: 'Standing Calf Raise',        sets: 3, repRange: [15, 20], backup: 'Seated Calf Raise',            split: 'Legs', availableWeights: CALF_RAISE },
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
