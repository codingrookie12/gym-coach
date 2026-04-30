export type Split = string

export const SPLIT_ORDER = ['Push', 'Pull', 'Legs'] as const

export function getNextSplit(last: Split | null): Split {
  const order = ['Push', 'Pull', 'Legs']
  if (!last) return 'Push'
  return order[(order.indexOf(last) + 1) % order.length]
}

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

export function getAvailableWeightsForEquipment(equipment: string): number[] {
  switch (equipment) {
    case 'Barbell':    return BARBELL
    case 'Dumbbell':   return DB
    case 'Cable':      return CABLE_FULL
    case 'EZ Bar':     return BARBELL
    case 'Machine':    return CABLE_HEAVY
    case 'Kettlebell': return DB
    case 'Bands':
    case 'Bodyweight': return []
    default:           return CABLE_HEAVY
  }
}

// ─── PPL ──────────────────────────────────────────────────────────────────────

export const PUSH_ROUTINE: Exercise[] = [
  { name: 'Wide-grip Barbell Bench Press',                  notionName: 'Wide-grip Barbell Bench Press',        sets: 3, repRange: [6, 8],   backup: 'Dumbbell Bench Press',              split: 'Push', availableWeights: BARBELL },
  { name: 'Incline Dumbbell Press',                        notionName: 'Incline Dumbbell Press',               sets: 3, repRange: [8, 10],  backup: 'Leverage Incline Chest Press',       split: 'Push', availableWeights: DB },
  { name: 'Seated Cable Fly',                              notionName: 'Seated Cable Fly',                     sets: 3, repRange: [12, 12], backup: 'Incline Dumbbell Flyes',             split: 'Push', availableWeights: CABLE_FULL },
  { name: 'Dumbbell Shoulder Press',                       notionName: 'Dumbbell Shoulder Press',              sets: 3, repRange: [8, 10],  backup: 'Leverage Shoulder Press',           split: 'Push', availableWeights: DB },
  { name: 'Side Lateral Raise',                            notionName: 'Side Lateral Raise',                   sets: 3, repRange: [12, 12], backup: null,                                split: 'Push', availableWeights: DB },
  { name: 'Face Pull',                                     notionName: 'Face Pull',                            sets: 3, repRange: [12, 15], backup: 'Reverse Machine Flyes',              split: 'Push', availableWeights: CABLE_FULL },
  { name: 'Triceps Pushdown - Rope Attachment',            notionName: 'Triceps Pushdown - Rope Attachment',   sets: 3, repRange: [10, 12], backup: 'Triceps Pushdown - V-bar Attachment', split: 'Push', availableWeights: CABLE_FULL },
  { name: 'Standing Low-pulley One-arm Triceps Extension', notionName: 'Standing Low-Pulley One-Arm Triceps Extension', split: 'Push', sets: 3, repRange: [10, 12], backup: 'Standing Dumbbell Triceps Extension', availableWeights: CABLE_LIGHT },
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

// ─── 5/3/1 (Wendler) ──────────────────────────────────────────────────────────

const WENDLER_OHP_ROUTINE: Exercise[] = [
  { name: 'Standing Military Press',    notionName: 'Standing Military Press',    sets: 3, repRange: [5, 5],   backup: 'Dumbbell Shoulder Press',              split: 'OHP Day',      availableWeights: BARBELL },
  { name: 'Dumbbell Bench Press',       notionName: 'Dumbbell Bench Press',       sets: 3, repRange: [10, 15], backup: 'Incline Dumbbell Press',               split: 'OHP Day',      availableWeights: DB },
  { name: 'Bent Over Barbell Row',      notionName: 'Bent Over Barbell Row',      sets: 3, repRange: [10, 15], backup: 'Seated Cable Rows',                    split: 'OHP Day',      availableWeights: BARBELL },
  { name: 'Face Pull',                  notionName: 'Face Pull',                  sets: 3, repRange: [15, 20], backup: null,                                   split: 'OHP Day',      availableWeights: CABLE_FULL },
  { name: 'Side Lateral Raise',         notionName: 'Side Lateral Raise',         sets: 3, repRange: [12, 15], backup: 'Bent Over Low-pulley Side Lateral',    split: 'OHP Day',      availableWeights: DB },
]

const WENDLER_DEADLIFT_ROUTINE: Exercise[] = [
  { name: 'Barbell Deadlift',           notionName: 'Barbell Deadlift',           sets: 3, repRange: [5, 5],   backup: 'Romanian Deadlift',                   split: 'Deadlift Day', availableWeights: BARBELL },
  { name: 'Romanian Deadlift',          notionName: 'Romanian Deadlift',          sets: 3, repRange: [8, 12],  backup: 'Barbell Deadlift',                    split: 'Deadlift Day', availableWeights: RDL },
  { name: 'Seated Leg Curl',            notionName: 'Seated Leg Curl',            sets: 3, repRange: [10, 15], backup: null,                                   split: 'Deadlift Day', availableWeights: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20], weightUnit: 'pins' },
  { name: 'Hanging Leg Raise',          notionName: 'Hanging Leg Raise',          sets: 3, repRange: [10, 15], backup: 'Flat Bench Lying Leg Raise',           split: 'Deadlift Day', availableWeights: [] },
  { name: 'Bent Over Barbell Row',      notionName: 'Bent Over Barbell Row',      sets: 3, repRange: [8, 12],  backup: 'Seated Cable Rows',                   split: 'Deadlift Day', availableWeights: BARBELL },
]

const WENDLER_BENCH_ROUTINE: Exercise[] = [
  { name: 'Wide-grip Barbell Bench Press',           notionName: 'Wide-grip Barbell Bench Press',           sets: 3, repRange: [5, 5],   backup: 'Dumbbell Bench Press',                         split: 'Bench Day', availableWeights: BARBELL },
  { name: 'Incline Dumbbell Press',                  notionName: 'Incline Dumbbell Press',                  sets: 3, repRange: [8, 12],  backup: 'Seated Cable Fly',                             split: 'Bench Day', availableWeights: DB },
  { name: 'Seated Cable Rows',                       notionName: 'Seated Cable Rows',                       sets: 3, repRange: [10, 15], backup: 'Bent Over Barbell Row',                        split: 'Bench Day', availableWeights: CABLE_HEAVY },
  { name: 'Triceps Pushdown - Rope Attachment',      notionName: 'Triceps Pushdown - Rope Attachment',      sets: 3, repRange: [10, 15], backup: 'Standing Low-pulley One-arm Triceps Extension', split: 'Bench Day', availableWeights: CABLE_FULL },
  { name: 'Standing Biceps Cable Curl',              notionName: 'Standing Biceps Cable Curl',              sets: 3, repRange: [10, 15], backup: 'Cable Curl (Low Pulley)',                       split: 'Bench Day', availableWeights: CABLE_FULL },
]

const WENDLER_SQUAT_ROUTINE: Exercise[] = [
  { name: 'Barbell Squat',              notionName: 'Barbell Squat',              sets: 3, repRange: [5, 5],   backup: 'Hack Squat',         split: 'Squat Day', availableWeights: BARBELL },
  { name: 'Leg Press',                  notionName: 'Leg Press',                  sets: 3, repRange: [10, 12], backup: 'Hack Squat',         split: 'Squat Day', availableWeights: LEG_PRESS, weightConvention: 'per side' },
  { name: 'Leg Extensions',             notionName: 'Leg Extensions',             sets: 3, repRange: [12, 12], backup: 'Leg Press',          split: 'Squat Day', availableWeights: LEG_EXT },
  { name: 'Seated Leg Curl',            notionName: 'Seated Leg Curl',            sets: 3, repRange: [10, 12], backup: null,                 split: 'Squat Day', availableWeights: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20], weightUnit: 'pins' },
  { name: 'Standing Calf Raises',       notionName: 'Standing Calf Raises',       sets: 3, repRange: [15, 20], backup: null,                 split: 'Squat Day', availableWeights: CALF_RAISE },
]

// ─── Upper / Lower ────────────────────────────────────────────────────────────

const UL_UPPER_A_ROUTINE: Exercise[] = [
  { name: 'Wide-grip Barbell Bench Press',           notionName: 'Wide-grip Barbell Bench Press',           sets: 4, repRange: [6, 8],   backup: 'Dumbbell Bench Press',                         split: 'Upper A', availableWeights: BARBELL },
  { name: 'Bent Over Barbell Row',                   notionName: 'Bent Over Barbell Row',                   sets: 4, repRange: [6, 8],   backup: 'Seated Cable Rows',                            split: 'Upper A', availableWeights: BARBELL },
  { name: 'Dumbbell Shoulder Press',                 notionName: 'Dumbbell Shoulder Press',                 sets: 3, repRange: [8, 10],  backup: 'Standing Military Press',                      split: 'Upper A', availableWeights: DB },
  { name: 'Wide-grip Lat Pulldown',                  notionName: 'Wide-grip Lat Pulldown',                  sets: 3, repRange: [8, 10],  backup: null,                                           split: 'Upper A', availableWeights: CABLE_HEAVY },
  { name: 'Seated Cable Fly',                        notionName: 'Seated Cable Fly',                        sets: 3, repRange: [10, 12], backup: 'Incline Dumbbell Press',                       split: 'Upper A', availableWeights: CABLE_FULL },
  { name: 'Triceps Pushdown - Rope Attachment',      notionName: 'Triceps Pushdown - Rope Attachment',      sets: 3, repRange: [10, 12], backup: 'Standing Low-pulley One-arm Triceps Extension', split: 'Upper A', availableWeights: CABLE_FULL },
  { name: 'Standing Biceps Cable Curl',              notionName: 'Standing Biceps Cable Curl',              sets: 3, repRange: [10, 12], backup: 'Cable Curl (Low Pulley)',                       split: 'Upper A', availableWeights: CABLE_FULL },
]

const UL_LOWER_A_ROUTINE: Exercise[] = [
  { name: 'Barbell Squat',              notionName: 'Barbell Squat',              sets: 4, repRange: [6, 8],   backup: 'Hack Squat',         split: 'Lower A', availableWeights: BARBELL },
  { name: 'Romanian Deadlift',          notionName: 'Romanian Deadlift',          sets: 3, repRange: [8, 10],  backup: 'Barbell Deadlift',   split: 'Lower A', availableWeights: RDL },
  { name: 'Leg Press',                  notionName: 'Leg Press',                  sets: 3, repRange: [10, 12], backup: 'Hack Squat',         split: 'Lower A', availableWeights: LEG_PRESS, weightConvention: 'per side' },
  { name: 'Seated Leg Curl',            notionName: 'Seated Leg Curl',            sets: 3, repRange: [10, 12], backup: null,                 split: 'Lower A', availableWeights: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20], weightUnit: 'pins' },
  { name: 'Standing Calf Raises',       notionName: 'Standing Calf Raises',       sets: 4, repRange: [12, 15], backup: null,                 split: 'Lower A', availableWeights: CALF_RAISE },
]

const UL_UPPER_B_ROUTINE: Exercise[] = [
  { name: 'Standing Military Press',                         notionName: 'Standing Military Press',                         sets: 4, repRange: [6, 8],   backup: 'Dumbbell Shoulder Press',              split: 'Upper B', availableWeights: BARBELL },
  { name: 'Seated Cable Rows',                               notionName: 'Seated Cable Rows',                               sets: 4, repRange: [8, 10],  backup: 'Bent Over Barbell Row',                split: 'Upper B', availableWeights: CABLE_HEAVY },
  { name: 'Incline Dumbbell Press',                          notionName: 'Incline Dumbbell Press',                          sets: 3, repRange: [8, 10],  backup: 'Wide-grip Barbell Bench Press',         split: 'Upper B', availableWeights: DB },
  { name: 'Face Pull',                                       notionName: 'Face Pull',                                       sets: 3, repRange: [12, 15], backup: null,                                   split: 'Upper B', availableWeights: CABLE_FULL },
  { name: 'Side Lateral Raise',                              notionName: 'Side Lateral Raise',                              sets: 3, repRange: [12, 15], backup: 'Bent Over Low-pulley Side Lateral',    split: 'Upper B', availableWeights: DB },
  { name: 'Standing Low-pulley One-arm Triceps Extension',   notionName: 'Standing Low-pulley One-arm Triceps Extension',   sets: 3, repRange: [10, 12], backup: 'Triceps Pushdown - Rope Attachment',   split: 'Upper B', availableWeights: CABLE_LIGHT },
  { name: 'Preacher Hammer Dumbbell Curl',                   notionName: 'Preacher Hammer Dumbbell Curl',                   sets: 3, repRange: [10, 12], backup: 'Standing Biceps Cable Curl',            split: 'Upper B', availableWeights: DB },
]

const UL_LOWER_B_ROUTINE: Exercise[] = [
  { name: 'Barbell Deadlift',           notionName: 'Barbell Deadlift',           sets: 4, repRange: [5, 6],   backup: 'Romanian Deadlift',  split: 'Lower B', availableWeights: BARBELL },
  { name: 'Hack Squat',                 notionName: 'Hack Squat',                 sets: 3, repRange: [8, 10],  backup: 'Leg Press',          split: 'Lower B', availableWeights: HACK_PRESS },
  { name: 'Leg Extensions',             notionName: 'Leg Extensions',             sets: 3, repRange: [10, 12], backup: 'Leg Press',          split: 'Lower B', availableWeights: LEG_EXT },
  { name: 'Seated Leg Curl',            notionName: 'Seated Leg Curl',            sets: 3, repRange: [10, 12], backup: null,                 split: 'Lower B', availableWeights: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20], weightUnit: 'pins' },
  { name: 'Standing Calf Raises',       notionName: 'Standing Calf Raises',       sets: 4, repRange: [12, 15], backup: null,                 split: 'Lower B', availableWeights: CALF_RAISE },
]

// ─── Full Body 3x ─────────────────────────────────────────────────────────────

const FB_A_ROUTINE: Exercise[] = [
  { name: 'Barbell Squat',              notionName: 'Barbell Squat',              sets: 3, repRange: [5, 8],   backup: 'Hack Squat',             split: 'Full Body A', availableWeights: BARBELL },
  { name: 'Wide-grip Barbell Bench Press', notionName: 'Wide-grip Barbell Bench Press', sets: 3, repRange: [5, 8], backup: 'Dumbbell Bench Press',  split: 'Full Body A', availableWeights: BARBELL },
  { name: 'Bent Over Barbell Row',      notionName: 'Bent Over Barbell Row',      sets: 3, repRange: [8, 10],  backup: 'Seated Cable Rows',       split: 'Full Body A', availableWeights: BARBELL },
  { name: 'Dumbbell Shoulder Press',    notionName: 'Dumbbell Shoulder Press',    sets: 2, repRange: [8, 10],  backup: 'Standing Military Press', split: 'Full Body A', availableWeights: DB },
  { name: 'Standing Calf Raises',       notionName: 'Standing Calf Raises',       sets: 2, repRange: [12, 15], backup: null,                      split: 'Full Body A', availableWeights: CALF_RAISE },
]

const FB_B_ROUTINE: Exercise[] = [
  { name: 'Barbell Deadlift',           notionName: 'Barbell Deadlift',           sets: 3, repRange: [5, 6],   backup: 'Romanian Deadlift',       split: 'Full Body B', availableWeights: BARBELL },
  { name: 'Standing Military Press',    notionName: 'Standing Military Press',    sets: 3, repRange: [6, 8],   backup: 'Dumbbell Shoulder Press', split: 'Full Body B', availableWeights: BARBELL },
  { name: 'Wide-grip Lat Pulldown',     notionName: 'Wide-grip Lat Pulldown',     sets: 3, repRange: [8, 10],  backup: 'Seated Cable Rows',       split: 'Full Body B', availableWeights: CABLE_HEAVY },
  { name: 'Leg Press',                  notionName: 'Leg Press',                  sets: 3, repRange: [8, 10],  backup: 'Hack Squat',              split: 'Full Body B', availableWeights: LEG_PRESS, weightConvention: 'per side' },
  { name: 'Face Pull',                  notionName: 'Face Pull',                  sets: 2, repRange: [12, 15], backup: null,                      split: 'Full Body B', availableWeights: CABLE_FULL },
]

const FB_C_ROUTINE: Exercise[] = [
  { name: 'Hack Squat',                 notionName: 'Hack Squat',                 sets: 3, repRange: [8, 10],  backup: 'Leg Press',               split: 'Full Body C', availableWeights: HACK_PRESS },
  { name: 'Incline Dumbbell Press',     notionName: 'Incline Dumbbell Press',     sets: 3, repRange: [8, 10],  backup: 'Wide-grip Barbell Bench Press', split: 'Full Body C', availableWeights: DB },
  { name: 'Seated Cable Rows',          notionName: 'Seated Cable Rows',          sets: 3, repRange: [8, 10],  backup: 'Bent Over Barbell Row',   split: 'Full Body C', availableWeights: CABLE_HEAVY },
  { name: 'Romanian Deadlift',          notionName: 'Romanian Deadlift',          sets: 3, repRange: [8, 10],  backup: 'Barbell Deadlift',        split: 'Full Body C', availableWeights: RDL },
  { name: 'Side Lateral Raise',         notionName: 'Side Lateral Raise',         sets: 2, repRange: [12, 15], backup: null,                      split: 'Full Body C', availableWeights: DB },
]

// ─── StrongLifts 5×5 ──────────────────────────────────────────────────────────

const SL_DAY_A_ROUTINE: Exercise[] = [
  { name: 'Barbell Squat',              notionName: 'Barbell Squat',              sets: 5, repRange: [5, 5], backup: 'Hack Squat',              split: 'Day A', availableWeights: BARBELL },
  { name: 'Wide-grip Barbell Bench Press', notionName: 'Wide-grip Barbell Bench Press', sets: 5, repRange: [5, 5], backup: 'Dumbbell Bench Press', split: 'Day A', availableWeights: BARBELL },
  { name: 'Bent Over Barbell Row',      notionName: 'Bent Over Barbell Row',      sets: 5, repRange: [5, 5], backup: 'Seated Cable Rows',        split: 'Day A', availableWeights: BARBELL },
]

const SL_DAY_B_ROUTINE: Exercise[] = [
  { name: 'Barbell Squat',              notionName: 'Barbell Squat',              sets: 5, repRange: [5, 5], backup: 'Hack Squat',              split: 'Day B', availableWeights: BARBELL },
  { name: 'Standing Military Press',    notionName: 'Standing Military Press',    sets: 5, repRange: [5, 5], backup: 'Dumbbell Shoulder Press',  split: 'Day B', availableWeights: BARBELL },
  { name: 'Barbell Deadlift',           notionName: 'Barbell Deadlift',           sets: 1, repRange: [5, 5], backup: 'Romanian Deadlift',        split: 'Day B', availableWeights: BARBELL },
]

// ─── Program routine registry ─────────────────────────────────────────────────

const PROGRAM_ROUTINES: Record<string, Record<string, Exercise[]>> = {
  'ppl-default': {
    Push: PUSH_ROUTINE,
    Pull: PULL_ROUTINE,
    Legs: LEGS_ROUTINE,
  },
  'wendler-531': {
    'OHP Day':      WENDLER_OHP_ROUTINE,
    'Deadlift Day': WENDLER_DEADLIFT_ROUTINE,
    'Bench Day':    WENDLER_BENCH_ROUTINE,
    'Squat Day':    WENDLER_SQUAT_ROUTINE,
  },
  'upper-lower': {
    'Upper A': UL_UPPER_A_ROUTINE,
    'Lower A': UL_LOWER_A_ROUTINE,
    'Upper B': UL_UPPER_B_ROUTINE,
    'Lower B': UL_LOWER_B_ROUTINE,
  },
  'full-body-3x': {
    'Full Body A': FB_A_ROUTINE,
    'Full Body B': FB_B_ROUTINE,
    'Full Body C': FB_C_ROUTINE,
  },
  'stronglifts-5x5': {
    'Day A': SL_DAY_A_ROUTINE,
    'Day B': SL_DAY_B_ROUTINE,
  },
}

// ─── Program split orders ─────────────────────────────────────────────────────

const PROGRAM_SPLIT_ORDERS: Record<string, string[]> = {
  'ppl-default':    ['Push', 'Pull', 'Legs'],
  'wendler-531':    ['OHP Day', 'Deadlift Day', 'Bench Day', 'Squat Day'],
  'upper-lower':    ['Upper A', 'Lower A', 'Upper B', 'Lower B'],
  'full-body-3x':   ['Full Body A', 'Full Body B', 'Full Body C'],
  'stronglifts-5x5': ['Day A', 'Day B'],
}

// ─── Functions ────────────────────────────────────────────────────────────────

export function getRoutineForProgram(programId: string, splitName: string): Exercise[] {
  return PROGRAM_ROUTINES[programId]?.[splitName] ?? []
}

export function getNextSplitForProgram(programId: string, lastSplit: string | null): string {
  const order = PROGRAM_SPLIT_ORDERS[programId] ?? ['Push', 'Pull', 'Legs']
  if (!lastSplit) return order[0]
  const idx = order.indexOf(lastSplit)
  return order[(idx === -1 ? 0 : idx + 1) % order.length]
}

export function getAllExercisesForProgram(programId: string): Exercise[] {
  const routines = PROGRAM_ROUTINES[programId]
  if (!routines) return []
  return Object.values(routines).flat()
}

/** @deprecated use getRoutineForProgram('ppl-default', split) */
export function getRoutine(split: Split): Exercise[] {
  return getRoutineForProgram('ppl-default', split)
}

/** @deprecated use getAllExercisesForProgram */
export function getAllExercises(): Exercise[] {
  return [...PUSH_ROUTINE, ...PULL_ROUTINE, ...LEGS_ROUTINE]
}

export const CARDIO_RECOMMENDATION: Record<string, string> = {
  // PPL
  Push: 'Stairmaster or Incline Walk',
  Pull: 'Incline Walk',
  Legs: 'Elliptical',
  // 5/3/1
  'OHP Day':      'Incline walk or light bike — protect hips and lower back for big lifts',
  'Deadlift Day': 'Incline walk or light bike — protect hips and lower back for big lifts',
  'Bench Day':    'Incline walk or light bike — protect hips and lower back for big lifts',
  'Squat Day':    'Incline walk or light bike — protect hips and lower back for big lifts',
  // Upper/Lower
  'Upper A': 'Any cardio, 15 min',
  'Lower A': 'Stairmaster or Incline Walk',
  'Upper B': 'Any cardio, 15 min',
  'Lower B': 'Stairmaster or Incline Walk',
  // Full Body 3x
  'Full Body A': '15-20 min steady state — any machine',
  'Full Body B': '15-20 min steady state — any machine',
  'Full Body C': '15-20 min steady state — any machine',
  // StrongLifts
  'Day A': '15-20 min low-intensity — protect linear progression recovery',
  'Day B': '15-20 min low-intensity — protect linear progression recovery',
}
