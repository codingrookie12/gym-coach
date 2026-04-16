export type Split = 'Push' | 'Pull' | 'Legs'

export interface Exercise {
  name: string
  sets: number
  repRange: [number, number]
  backup: string
  split: Split
  weightConvention?: string
  availableWeights?: number[]
  weightUnit?: 'lbs' | 'pins'
}

export const PUSH_ROUTINE: Exercise[] = [
  { name: 'Bench Press', sets: 3, repRange: [6, 8], backup: 'Dumbbell Chest Press', split: 'Push' },
  { name: 'Incline Dumbbell Press', sets: 3, repRange: [8, 10], backup: 'Machine Chest Press Incline', split: 'Push' },
  { name: 'Seated Cable Fly', sets: 3, repRange: [12, 12], backup: 'Dumbbell Incline Flies', split: 'Push' },
  { name: 'Shoulder Press', sets: 3, repRange: [8, 10], backup: 'Machine Shoulder Press', split: 'Push' },
  { name: 'Lateral Raise', sets: 3, repRange: [12, 12], backup: 'Cable Lateral Raise Single Arm', split: 'Push' },
  { name: 'Facepull', sets: 3, repRange: [12, 15], backup: 'Rear Delt Fly Machine', split: 'Push' },
  { name: 'Tricep Pushdown (rope)', sets: 3, repRange: [10, 12], backup: 'Tricep Pushdown Bar', split: 'Push' },
  { name: 'Single-Arm Overhead Tricep Extension (cable)', sets: 3, repRange: [10, 12], backup: 'Dumbbell Overhead Tricep Extension', split: 'Push' },
]

export const PULL_ROUTINE: Exercise[] = [
  { name: 'Cable Pulldown (bar)', sets: 3, repRange: [8, 10], backup: 'Assisted Pull-Up', split: 'Pull' },
  { name: 'Cable Row (wide grip)', sets: 3, repRange: [8, 10], backup: 'Dumbbell Single-Arm Row', split: 'Pull' },
  { name: 'Cable Curl (EZ bar)', sets: 3, repRange: [10, 12], backup: 'EZ Bar Curl', split: 'Pull' },
  { name: 'Rope Iso Curl From Below (single arm)', sets: 3, repRange: [12, 12], backup: 'Incline Dumbbell Curl', split: 'Pull' },
  { name: 'Single-Arm Preacher Hammer Curl', sets: 3, repRange: [10, 12], backup: 'Cable Hammer Curl', split: 'Pull' },
  { name: 'Forearm Behind Back', sets: 3, repRange: [15, 15], backup: 'Wrist Curl', split: 'Pull' },
]

export const LEGS_ROUTINE: Exercise[] = [
  { name: 'Linear Hack Press or Squat', sets: 3, repRange: [8, 10], backup: 'Standing Hack Squat Machine', split: 'Legs' },
  { name: 'Leg Press Pendular', sets: 3, repRange: [10, 12], backup: 'Linear Hack Press', split: 'Legs', weightConvention: 'per side' },
  { name: 'Leg Extension', sets: 3, repRange: [12, 12], backup: 'Single-Leg Extension', split: 'Legs', availableWeights: [5, 15, 25, 35, 45, 55, 65, 75, 85, 95] },
  { name: 'Seated Leg Curl', sets: 3, repRange: [10, 12], backup: 'Prone Leg Curl', split: 'Legs', weightUnit: 'pins', availableWeights: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20] },
  { name: 'Romanian Deadlift', sets: 3, repRange: [10, 12], backup: 'Good Morning', split: 'Legs' },
  { name: 'Standing Calf Raise', sets: 3, repRange: [15, 20], backup: 'Seated Calf Raise', split: 'Legs' },
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
